module QDraw
  module Gate
    # =========================
    # 対応ゲート
    # =========================
    SUPPORTED_SINGLE_GATES = [
      "H", "X", "Y", "Z", "√X", "S", "S†", "T", "T†", "Φ", "RX", "RY", "RZ"
    ].freeze

    SUPPORTED_PAIR_GATES = [
      "×", "•", "・"
    ].freeze

    module_function

    # --------------------------------------
    # identity_gate?(gate)
    # 役割:
    #   Iゲート扱いかどうかを返す
    # 仕様:
    #   - 1 は Iゲート
    #   - "I" も Iゲートとして扱う
    # --------------------------------------
    def identity?(gate)
      gate == 1 || gate == "1" || gate == "I"
    end

    # --------------------------------------
    # normalize_gate(gate)
    # 役割:
    #   ゲート表記を正規化する
    #   入力ゆれをここで吸収して、以降の判定を単純にする
    # --------------------------------------
    def normalize(gate)
      return gate if gate.nil?
      return gate if gate.is_a?(Numeric)

      text = gate.to_s

      return "√X" if text == "X^½"
      return "•"  if text == "・"
      return "×" if text == "Swap" || text == "SWAP"
      return "RX" if text == "Rx"
      return "RY" if text == "Ry"
      return "RZ" if text == "Rz"

      text
    end

    # --------------------------------------
    # drawable_gate?(gate)
    # 役割:
    #   描画対象のゲートかどうかを返す
    # --------------------------------------
    def drawable?(gate)
      return false if gate.nil?
      return false if identity?(gate)

      true
    end

    # --------------------------------------
    # supported_gate?(gate)
    # 役割:
    #   対応ゲートかどうかを返す
    #   normalize後の値で判定するので、入力ゆれも許容できる
    # --------------------------------------
    def supported?(gate)
      return true if gate.nil?
      return true if identity?(gate)

      normalized_gate = normalize(gate)

      SUPPORTED_SINGLE_GATES.include?(normalized_gate) ||
        SUPPORTED_PAIR_GATES.include?(normalized_gate)
    end

    # --------------------------------------
    # gate_label(gate)
    # 役割:
    #   ゲート表示文字を返す
    #   内部判定は X のまま使い、見た目だけ ＋ にする
    # --------------------------------------
    def label(gate)
      normalized_gate = normalize(gate)
      return "＋" if normalized_gate == "X"

      normalized_gate.to_s
    end

    # --------------------------------------
    # control_gate?(gate)
    # 役割:
    #   コントロールゲートかどうかを返す
    # --------------------------------------
    def control?(gate)
      normalize(gate) == "•"
    end

    # --------------------------------------
    # swap_gate?(gate)
    # 役割:
    #   SWAPゲートかどうかを返す
    # --------------------------------------
    def swap?(gate)
      normalize(gate) == "×"
    end

    # --------------------------------------
    # circle_x_gate?(gate)
    # 役割:
    #   丸く描画するXゲートかどうかを返す
    #   表示文字は ＋ でも、内部的には X として扱う
    # --------------------------------------
    def circle_x?(gate)
      normalize(gate) == "X"
    end
  end
end