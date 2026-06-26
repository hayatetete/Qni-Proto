module QDraw
  module Constants
    # ======================================
    # Quantum Circuit SVG Renderer (qdraw)
    # ======================================
    #
    # 量子回路をJSON入力からSVGで図示します。
    # ゲートごとに配置・選択状態・貼り付け状態を強調表示します。
    #
    # このファイルは、描画や出力で使う定数をまとめる場所です。
    # 色・サイズ・余白・出力先など、設定値だけを置きます。

    # =========================
    # 最低描画サイズ
    # =========================
    MIN_STEP_COUNT  = 5
    MIN_QUBIT_COUNT = 2

    # =========================
    # レイアウト設定
    # =========================
    STEP_WIDTH              = 60
    QUBIT_HEIGHT            = 60
    GATE_SIZE               = 36
    CANVAS_MARGIN           = 20

    # step bar
    STEP_BAR_WIDTH          = 6
    STEP_BAR_OFFSET_X       = 10
    STEP_BAR_PADDING_Y      = 28

    # gate text
    GATE_FONT_SIZE          = 24
    GATE_TEXT_Y_OFFSET      = 2
    GATE_FONT_FAMILY        = "Arial, sans-serif"

    # gate rect
    GATE_CORNER_RADIUS      = 6
    GATE_STROKE_WIDTH       = 2

    # control gate
    CONTROL_RADIUS          = 7

    # swap gate
    SWAP_SIZE               = 10
    SWAP_STROKE_WIDTH       = 3

    # pair wire
    PAIR_WIRE_STROKE_WIDTH  = 3

    # wire
    WIRE_STROKE_WIDTH       = 2

    # paste border dash
    PASTE_DASH_LENGTH       = 4
    PASTE_GAP_LENGTH        = 3
    PASTE_STROKE_DASHARRAY  = "#{PASTE_DASH_LENGTH},#{PASTE_GAP_LENGTH}"

    # background
    BACKGROUND_FILL         = "white"

    # svg text align
    TEXT_ANCHOR             = "middle"
    DOMINANT_BASELINE       = "middle"

    # output dir
    OUTPUT_DIR = File.expand_path("../../doc/image", File.realpath(__dir__))
    # =========================
    # 色設定
    # =========================
    WIRE_COLOR    = "#E4E4E7"
    NORMAL_STROKE = "#0369A1"
    NORMAL_FILL   = "#0EA5E9"
    SELECT_STROKE = "#5EEAD4"
    PASTE_STROKE  = "#6B15A8"
    TEXT_COLOR    = "#FFFFFF"

    SELECT_FILL = NORMAL_FILL
    PASTE_FILL  = NORMAL_FILL
  end
end