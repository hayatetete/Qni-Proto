#!/usr/bin/env ruby
require "json"
require "open3"

# ======================================
# QDraw Pattern Runner
# ======================================
#
# pattern実証用ケース定義ファイル
#   script/cases/qdraw_cases.json
# を読み込み、
# qdraw.rb をケースごとに順番に実行する。
#
# このスクリプトはコピー＆ペースト仕様や入力形式の実証用SVGを
# 一括生成するための補助CLIである。
#
# --- 使い方 ---
#   ruby script/run_cases.rb script/cases/qdraw_cases.json
#   ruby script/run_cases.rb script/cases/qdraw_cases.json --only pattern-10-copy-cnot-group-selected-by-control
#   ruby script/run_cases.rb script/cases/qdraw_cases.json --filter cnot
#
# --- 入力 ---
#   cases JSON
#   各caseは以下のような情報を持つ:
#   - name
#   - description
#   - input
#   - select (任意)
#   - paste  (任意)
#   - output
#
# --- オプション ---
#   --only <name>
#     指定した name の case 1件だけ実行する
#
#   --filter <text>
#     name に text を含む case のみ実行する
#
# --- 出力 ---
#   各caseごとに qdraw.rb を実行し、
#   qni-gl/doc/image 配下へSVGを生成する。
#
# ======================================

def normalize_positions(value, case_name, key)
  return nil if value.nil?
  return nil if value == []

  unless value.is_a?(Array)
    raise ArgumentError, "case #{case_name}: #{key} must be an Array"
  end

  positions =
    if value.all? { |item| item.is_a?(Integer) }
      [value]
    else
      value
    end

  positions.each do |position|
    unless position.is_a?(Array) &&
           position.size == 2 &&
           position.all? { |item| item.is_a?(Integer) }
      raise ArgumentError,
            "case #{case_name}: #{key} must be [[step, qubit], ...]"
    end
  end

  positions
end

cases_file = ARGV[0]

# --------------------------------------
# CLI options
# --------------------------------------
only_name = nil
filter_text = nil

args = ARGV[1..] || []

i = 0
while i < args.length
  case args[i]
  when "--only"
    value = args[i + 1]

    if value.nil? || value.start_with?("--")
      raise ArgumentError, "--only requires case name"
    end

    only_name = value
    i += 2

  when "--filter"
    value = args[i + 1]

    if value.nil? || value.start_with?("--")
      raise ArgumentError, "--filter requires text"
    end

    filter_text = value
    i += 2

  else
    if args[i].start_with?("--")
      raise ArgumentError, "Unknown option: #{args[i]}"
    end

    raise ArgumentError, "Unknown argument: #{args[i]}"
  end
end

raise ArgumentError, "cases json file is required" if cases_file.nil?

data = JSON.parse(File.read(cases_file))
cases = data["cases"]

raise ArgumentError, '"cases" must be an Array' unless cases.is_a?(Array)

qdraw_path = File.expand_path("qdraw.rb", __dir__)

success_count = 0
failure_count = 0
matched_count = 0

cases.each_with_index do |test_case, index|
  name = test_case["name"] || "case_#{index + 1}"

  # --- only filter ---
  next if only_name && name != only_name

  # --- text filter ---
  next if filter_text && !name.include?(filter_text)

  matched_count += 1

  description = test_case["description"]
  input       = test_case["input"]
  output      = test_case["output"]
  select      = normalize_positions(test_case["select"], name, "select")
  paste       = normalize_positions(test_case["paste"],  name, "paste")

  raise ArgumentError, "case #{name}: input is required" if input.nil?
  raise ArgumentError, "case #{name}: output is required" if output.nil?

  cmd = ["ruby", qdraw_path]

  if select
    cmd << "--select"
    
    cmd << select.map { |position|
      "#{position[0]},#{position[1]}"
    }.join(";")
  end

  if paste
    cmd << "--paste"

    cmd << paste.map { |position|
      "#{position[0]},#{position[1]}"
    }.join(";")
  end

  cmd << input
  cmd << "--output"
  cmd << output

  puts "=================================================="
  puts "[#{index + 1}/#{cases.size}] #{name}"
  puts description if description
  puts "CMD: #{cmd.join(' ')}"

  stdout, stderr, status = Open3.capture3(*cmd)

  if status.success?
    success_count += 1
    puts "STATUS: OK"
    puts stdout
  else
    failure_count += 1
    puts "STATUS: FAIL"
    puts stdout unless stdout.empty?
    puts stderr unless stderr.empty?
  end
end

if only_name && matched_count == 0
  warn "ERROR: --only target not found: #{only_name}"
  exit(1)
end

puts "=================================================="
puts "DONE"
puts "success: #{success_count}"
puts "failure: #{failure_count}"

exit(1) if failure_count > 0