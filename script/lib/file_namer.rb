module QDraw
  class FileNamer
    class << self
      # =========================
      # SVGファイル名生成
      # =========================
      #
      # Iゲート:
      #   1 / "1" / "I"
      # はファイル名に含めない
      #
      # 例:
      #   Select-CNOT.svg
      #   Paste-H-H.svg
      #
      # 補足:
      #   描画はセル単位だが、
      #   ファイル名は step / column 単位でゲート名を判定する
      #
      # 例:
      #   ["•", "X"]      => CNOT
      #   ["•", "H"]      => CtrlH
      #   ["•", "Z"]      => CtrlZ
      #   ["•", "1"]      => CTRL
      #   ["•", "•", "X"] => CCNOT
      #   ["×", "×"]      => SWAP
      #
      def make_svg_name(
        cols,
        select_positions = nil,
        paste_positions = nil
      )
        gate_names = []

        cols.each do |col|
          next unless col.is_a?(Array)

          normalized_col =
            col.map { |gate| QDraw::Gate.normalize(gate) }

          gate_name =
            convert_column_to_file_name(
              normalized_col
            )

          next if gate_name.nil?
          next if gate_name.empty?

          gate_names << gate_name
        end

        prefix = build_prefix(
          select_positions,
          paste_positions
        )

        body =
          if gate_names.empty?
            "empty"
          else
            gate_names.join("-")
          end

        "#{prefix}#{body}.svg"
      end

      # =========================
      # 重複回避ファイル名
      # =========================
      #
      # sample.svg
      # sample_1.svg
      # sample_2.svg
      #
      def next_svg_name(base_name)
        return base_name unless File.exist?(base_name)

        dir  = File.dirname(base_name)
        ext  = File.extname(base_name)
        stem = File.basename(base_name, ext)

        suffix_number = 1

        loop do
          new_name =
            File.join(
              dir,
              "#{stem}_#{suffix_number}#{ext}"
            )

          return new_name unless File.exist?(new_name)

          suffix_number += 1
        end
      end

      private

      # =========================
      # 接頭辞生成
      # =========================
      def build_prefix(select_positions, paste_positions)
        prefix = ""

        prefix << "Select-" if select_positions

        if paste_positions &&
           paste_positions != select_positions
          prefix << "Paste-"
        end

        prefix
      end

      # =========================
      # column単位のファイル名変換
      # =========================
      #
      # 同じ step にあるゲートの組み合わせから、
      # ファイル名用のゲート名を決める
      #
      def convert_column_to_file_name(normalized_col)
        controls = []
        targets  = []
        swaps    = []

        normalized_col.each do |gate|
          next unless QDraw::Gate.drawable?(gate)

          if QDraw::Gate.control?(gate)
            controls << gate
          elsif QDraw::Gate.swap?(gate)
            swaps << gate
          else
            targets << gate
          end
        end

        return nil if controls.empty? &&
                      targets.empty? &&
                      swaps.empty?

        return convert_swap_name(swaps) if swaps.any?

        if controls.any?
          return convert_controlled_gate_name(
            controls.size,
            targets
          )
        end

        targets.map { |gate| convert_gate_name_for_file_name(gate) }.join("-")
      end

      # =========================
      # 制御ゲート名変換
      # =========================
      #
      # ["•", "X"]      => CNOT
      # ["•", "H"]      => CtrlH
      # ["•", "Z"]      => CtrlZ
      # ["•", "1"]      => CTRL
      # ["•", "•", "X"] => CCNOT
      #
      def convert_controlled_gate_name(control_count, targets)
        if targets.empty?
          return "CTRL" if control_count == 1

          return "C#{control_count}CTRL"
        end

        if targets.size > 1
          target_name =
            targets.map { |gate| convert_gate_name_for_file_name(gate) }.join("-")

          return "#{control_prefix(control_count)}#{target_name}"
        end

        target_gate = targets.first

        case [control_count, target_gate]
        when [1, "X"]
          "CNOT"
        when [2, "X"]
          "CCNOT"
        else
          "#{control_prefix(control_count)}#{convert_gate_name_for_file_name(target_gate)}"
        end
      end

      # =========================
      # control数の接頭辞
      # =========================
      #
      # 1 control  => Ctrl
      # 2 controls => CCtrl
      # 3 controls => C3Ctrl
      #
      def control_prefix(control_count)
        return "Ctrl" if control_count == 1
        return "CCtrl" if control_count == 2

        "C#{control_count}Ctrl"
      end

      # =========================
      # SWAPゲート名変換
      # =========================
      def convert_swap_name(swaps)
        return "SWAP" if swaps.size == 2

        "SWAP#{swaps.size}"
      end

      # =========================
      # ファイル名用ゲート名変換
      # =========================
      def convert_gate_name_for_file_name(gate)
        case gate
        when "√X"
          "SqrtX"

        when "S†"
          "Sdag"

        when "T†"
          "Tdag"

        when "Φ"
          "Phi"

        when "×"
          "SWAP"

        else
          gate.to_s
        end
      end
    end
  end
end