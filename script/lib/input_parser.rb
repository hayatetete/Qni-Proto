require "cgi"

module QDraw
  class InputParser
    class << self
      # --------------------------------------
      # extract_json_text(input_text)
      # 役割:
      #   入力文字列から回路JSON文字列を取り出す
      # --------------------------------------
      def extract_json_text(input_text)
        text = input_text.to_s.strip

        # 1. 生JSON
        return text if text.start_with?("{")

        # 2. URLエンコード済みJSON
        decoded_text = CGI.unescape(text)
        return decoded_text if decoded_text.start_with?("{")

        # 3. #circuit=... を含むURL
        if text.include?("#circuit=")
          circuit_text = text.split("#circuit=", 2)[1]
          decoded_circuit_text = CGI.unescape(circuit_text)
          return decoded_circuit_text if decoded_circuit_text.start_with?("{")
        end

        # 4. circuit=... だけ渡された場合
        if text.start_with?("circuit=")
          circuit_text = text.sub(/\Acircuit=/, "")
          decoded_circuit_text = CGI.unescape(circuit_text)
          return decoded_circuit_text if decoded_circuit_text.start_with?("{")
        end

        # 5. URLのパス末尾がURLエンコードJSONの場合
        if text =~ /\Ahttps?:\/\//
          path_part = text.split(/[?#]/, 2).first
          last_segment = path_part.split("/").reject(&:empty?).last
          if last_segment
            decoded_last_segment = CGI.unescape(last_segment)
            return decoded_last_segment if decoded_last_segment.start_with?("{")
          end
        end

        raise ArgumentError,
              "Input must be raw JSON, URL-encoded JSON, URL containing #circuit=..., circuit=..., or URL whose last path segment is encoded JSON"
      end
    end
  end
end