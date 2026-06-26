module QDraw
  class Cli
    class << self
      # =========================
      # CLI解析
      # =========================
      #
      # 返却:
      # {
      #   select_positions:
      #   paste_positions:
      #   step_bar_index:
      #   out_svg:
      #   json_text:
      # }
      #
      def parse(argv)
        select_positions = nil
        paste_positions  = nil
        step_bar_index   = nil
        out_svg          = nil
        json_text        = nil

        args = argv.dup
        arg_i = 0

        while arg_i < args.length
          current_arg = args[arg_i]

          case current_arg
          when "--select"
            value = option_value!(
              args,
              arg_i,
              "--select requires value like 1,0 or 1,0;1,1"
            )

            select_positions = parse_positions(value)
            arg_i += 2

          when "--paste"
            value = option_value!(
              args,
              arg_i,
              "--paste requires value like 1,0 or 1,0;1,1"
            )

            paste_positions = parse_positions(value)
            arg_i += 2

          when "--step-bar"
            value = option_value!(
              args,
              arg_i,
              "--step-bar requires step index"
            )

            step_bar_index = Integer(value)
            arg_i += 2

          when "--output"
            value = option_value!(
              args,
              arg_i,
              "--output requires filename"
            )

            out_svg = value
            arg_i += 2

          else
            if current_arg.start_with?("--")
              raise ArgumentError, "Unknown option: #{current_arg}"
            end

            if json_text
              raise ArgumentError, "Multiple JSON inputs are not allowed"
            end

            json_text = current_arg
            arg_i += 1
          end
        end

        raise ArgumentError, "JSON input is required" if json_text.nil?

        {
          select_positions: select_positions,
          paste_positions:  paste_positions,
          step_bar_index:   step_bar_index,
          out_svg:          out_svg,
          json_text:        json_text
        }
      end

      private

      # =========================
      # オプション値取得
      # =========================
      def option_value!(args, arg_i, error_message)
        value = args[arg_i + 1]

        if value.nil? || value.start_with?("--")
          raise ArgumentError, error_message
        end

        value
      end

      # =========================
      # 座標文字列解析
      # =========================
      #
      # "1,0;1,1"
      #   ↓
      # [
      #   [1,0],
      #   [1,1]
      # ]
      #
      def parse_positions(text)
        text.split(";").map do |pair|
          parts = pair.split(",")

          unless parts.size == 2
            raise ArgumentError,
                  "position must be like step,qubit"
          end

          begin
            parts.map { |part| Integer(part, 10) }
          rescue ArgumentError
            raise ArgumentError,
                  "position must be like step,qubit"
          end
        end
      end
    end
  end
end
