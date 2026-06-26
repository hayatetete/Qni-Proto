module QDraw
  class Circuit
    attr_reader :cols

    # =========================
    # 初期化
    # =========================
    #
    # cols:
    #   [
    #     ["H", 1],
    #     ["•", "X"]
    #   ]
    #
    # のような、
    # stepごとの量子ゲート配列を受け取る
    #
    def initialize(cols)
      unless cols.is_a?(Array)
        raise ArgumentError, 'JSON must include "cols" Array'
      end

      @cols = cols
    end

    # =========================
    # 元データ上の step 数
    # =========================
    def step_count_in_data
      cols.size
    end

    # =========================
    # 元データ上の qubit 数
    # =========================
    #
    # 列ごとにサイズが違う可能性があるので
    # 最大値を採用する
    #
    def qubit_count_in_data
      cols.map { |col| col.is_a?(Array) ? col.size : 0 }.max || 0
    end

    # =========================
    # 描画用 step 数
    # =========================
    #
    # 最低描画サイズを保証する
    #
    def step_count
      [
        step_count_in_data,
        QDraw::Constants::MIN_STEP_COUNT
      ].max
    end

    # =========================
    # 描画用 qubit 数
    # =========================
    #
    # 最低描画サイズを保証する
    #
    def qubit_count
      [
        qubit_count_in_data,
        QDraw::Constants::MIN_QUBIT_COUNT
      ].max
    end

    # =========================
    # 指定stepの列取得
    # =========================
    def column(step_index)
      cols[step_index]
    end

    # =========================
    # 各列を列挙
    # =========================
    def each_column
      cols.each_with_index do |col, step_index|
        yield col, step_index
      end
    end

    # =========================
    # 各セルを列挙
    # =========================
    #
    # yield:
    #   gate
    #   step_index
    #   qubit_index
    #
    def each_cell
      cols.each_with_index do |col, step_index|
        next unless col.is_a?(Array)

        col.each_with_index do |gate, qubit_index|
          yield gate, step_index, qubit_index
        end
      end
    end

    # =========================
    # 入力検証
    # =========================
    #
    # 対応外ゲートを落とす。
    # renderer側で分岐を増やさないため。
    #
    def validate!
      each_cell do |gate, step_index, qubit_index|
        next if QDraw::Gate.supported?(gate)

        raise ArgumentError,
              "Unsupported gate at step #{step_index}, " \
              "qubit #{qubit_index}: #{gate.inspect}"
      end
    end
  end
end
