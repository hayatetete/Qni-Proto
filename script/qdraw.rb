#!/usr/bin/env ruby
require "json"
require "fileutils"

require_relative "lib/constants"
require_relative "lib/cli"
require_relative "lib/file_namer"
require_relative "lib/gate"
require_relative "lib/input_parser"
require_relative "lib/circuit"
require_relative "lib/selection"
require_relative "lib/svg_builder"
require_relative "lib/renderer"

# ======================================
# Quantum Circuit SVG Renderer (qdraw)
# ======================================
#
# 量子回路をJSON入力からSVGで図示します。
# ゲートごとに配置・選択状態・貼り付け状態を強調表示します。
#
# --- 使い方(コマンド例) ---
#   ruby script/qdraw.rb '{"cols":[["H",1],["•","X"]]}' --output circuit.svg
#   ruby script/qdraw.rb '%7B"cols"%3A%5B%5B"H"%5D%5D%7D' --output encoded.svg
#   ruby script/qdraw.rb 'http://localhost:5173/#circuit={"cols":[["H","H"],["H","H"],["H",1]]}' --output from_url.svg
#   ruby script/qdraw.rb --select 0,0 --paste 1,1 'https://qniapp.net/%7B%22cols%22%3A%5B%5B%22H%22%2C%22H%22%5D%2C%5B%22H%22%2C%22H%22%5D%5D%7D' --output out.svg
#
# --- 入力仕様 ---
#   cols: 回路ステップごとのゲート配列
#     例: [["H"], ["•", "X"]]
#   --select: 選択ゲート座標（例: "1,0" → 1ステップ0番キュービット）
#   --paste : 貼り付けゲート座標
#   --output: 出力ファイル名（SVG）
#
# --- 対応入力 ---
#   1. 生JSON
#   2. URLエンコード済みJSON
#   3. #circuit=... を含むURL
#   4. circuit=... だけ渡された場合
#   5. URLのパス末尾がURLエンコードJSONの場合
#
# --- 出力 ---
#   SVGファイル（命名規則に基づく自動付与）
#   生成先ディレクトリ:
#   qni-gl/doc/image
#   --output を指定した場合も、このディレクトリ配下に出力する
#   同名ファイルが存在する場合は、末尾に _1, _2 ... を付けて保存する
#
# --- 外観 ---
#   ・通常ゲートは青枠(#0369A1)、塗りは水色(#0EA5E9)
#   ・選択ゲートは青緑枠(#5EEAD4)
#   ・貼り付けゲートは紫(#6B15A8)の点線枠
#   ・塗りはすべて共通(#0EA5E9)
#   ・文字は白(#FFFFFF)
#   ・量子ビット線はグレー(#E4E4E7)
#   ・全ゲートは角丸矩形
#   ・描画範囲は最低でも 5ステップ × 2量子ビット を確保する
#
# --- Iゲートの扱い ---
#   ・1 は Iゲート扱い
#   ・Iゲートは配置情報としては存在するが、図には描画しない
#
# =======================================

options = QDraw::Cli.parse(ARGV)

json_text = QDraw::InputParser.extract_json_text(options[:json_text])

data = JSON.parse(json_text)
circuit = QDraw::Circuit.new(data["cols"])
circuit.validate!

svg_text = QDraw::Renderer.new(
  circuit: circuit,
  select_positions: options[:select_positions],
  paste_positions: options[:paste_positions],
  step_bar_index: options[:step_bar_index]
).render

# =========================
# SVGファイル書き出し
# =========================
FileUtils.mkdir_p(QDraw::Constants::OUTPUT_DIR)

file_name = options[:out_svg] || QDraw::FileNamer.make_svg_name(
  circuit.cols,
  options[:select_positions],
  options[:paste_positions]
)

svg_path = QDraw::FileNamer.next_svg_name(
  File.join(QDraw::Constants::OUTPUT_DIR, File.basename(file_name))
)

File.write(svg_path, svg_text)

puts "OUTPUT_DIR: #{QDraw::Constants::OUTPUT_DIR}"
puts "generated: #{svg_path}"