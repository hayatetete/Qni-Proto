module QDraw
  class Renderer
    include QDraw::Constants

    def initialize(
      circuit:,
      select_positions: nil,
      paste_positions: nil,
      step_bar_index: nil
    )
      @circuit = circuit
      @select_positions = select_positions
      @paste_positions = paste_positions
      @step_bar_index = step_bar_index
    end

    # =========================
    # SVG生成
    # =========================
    def render
      svg = SvgBuilder.new

      svg.add %(<svg xmlns="http://www.w3.org/2000/svg" width="#{svg_width}" height="#{svg_height}">)

      # ---- 背景
      svg.add %(<rect x="0" y="0" width="100%" height="100%" fill="#{BACKGROUND_FILL}"/>)

      # ---- ワイヤ
      add_wire_svgs(svg)

      # ---- ペアゲート接続線
      add_pair_wire_svgs(svg)

      # ---- ステップ右側の縦棒
      add_step_bar_svg(svg)

      # ---- ゲート描画
      add_gate_svgs(svg)

      svg.add %(</svg>)

      svg.to_s
    end

    private

    attr_reader(
      :circuit,
      :select_positions,
      :paste_positions,
      :step_bar_index
    )

    # =========================
    # SVG幅
    # =========================
    def svg_width
      CANVAS_MARGIN * 2 +
        circuit.step_count * STEP_WIDTH
    end

    # =========================
    # SVG高さ
    # =========================
    def svg_height
      CANVAS_MARGIN * 2 +
        circuit.qubit_count * QUBIT_HEIGHT
    end

    # =========================
    # 横ワイヤ描画
    # =========================
    def add_wire_svgs(svg)
      circuit.qubit_count.times do |qubit_index|
        wire_y =
          CANVAS_MARGIN +
          qubit_index * QUBIT_HEIGHT +
          QUBIT_HEIGHT / 2

        svg.add %(<line x1="0" y1="#{wire_y}" x2="#{svg_width}" y2="#{wire_y}" stroke="#{WIRE_COLOR}" stroke-width="#{WIRE_STROKE_WIDTH}"/>)
      end
    end

    # =========================
    # ペアゲート接続線描画
    # =========================
    def add_pair_wire_svgs(svg)
      circuit.each_column do |col, step_index|
        next unless col.is_a?(Array)

        analysis = QDraw::Selection.analyze_column(col)

        control_indices = analysis[:controls]
        target_indices  = analysis[:targets]
        swap_indices    = analysis[:swaps]

        # 同じstepに control と target がある場合
        if control_indices.any? && target_indices.any?
          pair_indices =
            (control_indices + target_indices).sort

          wire_x =
            step_center_x(step_index)

          wire_y1 =
            qubit_center_y(pair_indices.first)

          wire_y2 =
            qubit_center_y(pair_indices.last)

          svg.add %(<line x1="#{wire_x}" y1="#{wire_y1}" x2="#{wire_x}" y2="#{wire_y2}" stroke="#{NORMAL_FILL}" stroke-width="#{PAIR_WIRE_STROKE_WIDTH}"/>)
        end

        # SWAP は × が2つある場合のみ
        if swap_indices.size == 2
          wire_x =
            step_center_x(step_index)

          wire_y1 =
            qubit_center_y(swap_indices.first)

          wire_y2 =
            qubit_center_y(swap_indices.last)

          svg.add %(<line x1="#{wire_x}" y1="#{wire_y1}" x2="#{wire_x}" y2="#{wire_y2}" stroke="#{NORMAL_FILL}" stroke-width="#{PAIR_WIRE_STROKE_WIDTH}"/>)
        end
      end
    end

    # =========================
    # step bar描画
    # =========================
    def add_step_bar_svg(svg)
      return if step_bar_index.nil?

      if step_bar_index < 0 || step_bar_index >= circuit.step_count
        raise ArgumentError,
              "step_bar_index must be within 0...#{circuit.step_count}, got #{step_bar_index}"
      end

      min_qubit_index = 0
      max_qubit_index = circuit.qubit_count - 1

      gate_right_x =
        CANVAS_MARGIN +
        step_bar_index * STEP_WIDTH +
        STEP_WIDTH / 2 +
        GATE_SIZE / 2

      bar_x =
        gate_right_x +
        STEP_BAR_OFFSET_X

      bar_y =
        qubit_center_y(min_qubit_index) -
        (GATE_SIZE / 2) -
        STEP_BAR_PADDING_Y

      bar_height =
        ((max_qubit_index - min_qubit_index) * QUBIT_HEIGHT) +
        GATE_SIZE +
        (STEP_BAR_PADDING_Y * 2)

      svg.add %(<rect x="#{bar_x}" y="#{bar_y}" width="#{STEP_BAR_WIDTH}" height="#{bar_height}" fill="#{NORMAL_FILL}"/>)
    end

    # =========================
    # ゲート描画
    # =========================
    def add_gate_svgs(svg)
      circuit.step_count.times do |step_index|
        col = circuit.column(step_index)
    
        circuit.qubit_count.times do |qubit_index|
          gate =
            if col.is_a?(Array)
              QDraw::Gate.normalize(col[qubit_index])
            else
              nil
            end

          rect =
            gate_rect(step_index, qubit_index)

          state =
            if paste_positions&.include?(
              [step_index, qubit_index]
            )
              :paste

            elsif select_positions&.include?(
              [step_index, qubit_index]
            )
              :selected

            else
              :normal
            end

          border_color = NORMAL_STROKE
          fill_color   = NORMAL_FILL
          border_dash  = nil

          case state
          when :selected
            border_color = SELECT_STROKE
            fill_color   = SELECT_FILL

          when :paste
            border_color = PASTE_STROKE
            fill_color   = PASTE_FILL
            border_dash  = PASTE_STROKE_DASHARRAY
          end

          dash_attr =
            border_dash ?
              %(stroke-dasharray="#{border_dash}") :
              ""

          # =========================
          # 空白セル
          # =========================
          # 
          # 描画範囲内の空白セルを select / paste で指定した場合は枠だけ描画する。
          #
          unless QDraw::Gate.drawable?(gate)
            unless state == :normal
              svg.add %(<rect x="#{rect[:x]}" y="#{rect[:y]}" width="#{GATE_SIZE}" height="#{GATE_SIZE}" rx="#{GATE_CORNER_RADIUS}" fill="none" stroke="#{border_color}" stroke-width="#{GATE_STROKE_WIDTH}" #{dash_attr}/>)
            end

            next
          end

          # =========================
          # control gate
          # =========================
          if QDraw::Gate.control?(gate)
          
            # control gate は通常時は小さい丸だけを描画する。
            # 選択・ペースト時は、通常ゲートと同じサイズの角丸枠を外側に表示する。
            unless state == :normal
              svg.add %(<rect x="#{rect[:x]}" y="#{rect[:y]}" width="#{GATE_SIZE}" height="#{GATE_SIZE}" rx="#{GATE_CORNER_RADIUS}" fill="none" stroke="#{border_color}" stroke-width="#{GATE_STROKE_WIDTH}" #{dash_attr}/>)
            end
          
            svg.add %(<circle cx="#{rect[:cx]}" cy="#{rect[:cy]}" r="#{CONTROL_RADIUS}" fill="#{fill_color}"/>)
          
          # =========================
          # swap gate
          # =========================
          elsif QDraw::Gate.swap?(gate)
          
            # SWAP gate は通常時は × だけを描画する。
            # 選択・ペースト時は、通常ゲートと同じサイズの角丸枠を外側に表示する。
            unless state == :normal
              svg.add %(<rect x="#{rect[:x]}" y="#{rect[:y]}" width="#{GATE_SIZE}" height="#{GATE_SIZE}" rx="#{GATE_CORNER_RADIUS}" fill="none" stroke="#{border_color}" stroke-width="#{GATE_STROKE_WIDTH}" #{dash_attr}/>)
            end

            svg.add %(<line x1="#{rect[:cx] - SWAP_SIZE}" y1="#{rect[:cy] - SWAP_SIZE}" x2="#{rect[:cx] + SWAP_SIZE}" y2="#{rect[:cy] + SWAP_SIZE}" stroke="#{fill_color}" stroke-width="#{SWAP_STROKE_WIDTH}" stroke-linecap="round"/>)

            svg.add %(<line x1="#{rect[:cx] - SWAP_SIZE}" y1="#{rect[:cy] + SWAP_SIZE}" x2="#{rect[:cx] + SWAP_SIZE}" y2="#{rect[:cy] - SWAP_SIZE}" stroke="#{fill_color}" stroke-width="#{SWAP_STROKE_WIDTH}" stroke-linecap="round"/>)

          # =========================
          # X gate
          # =========================
          elsif QDraw::Gate.circle_x?(gate)
            svg.add %(<circle cx="#{rect[:cx]}" cy="#{rect[:cy]}" r="#{GATE_SIZE / 2}" fill="#{fill_color}" stroke="#{border_color}" stroke-width="#{GATE_STROKE_WIDTH}" #{dash_attr}/>)

            svg.add %(<text x="#{rect[:cx]}" y="#{rect[:cy] + GATE_TEXT_Y_OFFSET}" font-size="#{GATE_FONT_SIZE}" text-anchor="#{TEXT_ANCHOR}" dominant-baseline="#{DOMINANT_BASELINE}" font-family="#{GATE_FONT_FAMILY}" fill="#{TEXT_COLOR}">#{QDraw::Gate.label(gate)}</text>)

          # =========================
          # 通常ゲート
          # =========================
          else
            svg.add %(<rect x="#{rect[:x]}" y="#{rect[:y]}" width="#{GATE_SIZE}" height="#{GATE_SIZE}" rx="#{GATE_CORNER_RADIUS}" fill="#{fill_color}" stroke="#{border_color}" stroke-width="#{GATE_STROKE_WIDTH}" #{dash_attr}/>)

            svg.add %(<text x="#{rect[:x] + GATE_SIZE / 2}" y="#{rect[:y] + GATE_SIZE / 2 + GATE_TEXT_Y_OFFSET}" font-size="#{GATE_FONT_SIZE}" text-anchor="#{TEXT_ANCHOR}" dominant-baseline="#{DOMINANT_BASELINE}" font-family="#{GATE_FONT_FAMILY}" fill="#{TEXT_COLOR}">#{QDraw::Gate.label(gate)}</text>)
          end
        end
      end
    end

    # =========================
    # gate座標
    # =========================
    def gate_rect(step_index, qubit_index)
      gate_x =
        CANVAS_MARGIN +
        step_index * STEP_WIDTH +
        STEP_WIDTH / 2 -
        GATE_SIZE / 2

      gate_y =
        CANVAS_MARGIN +
        qubit_index * QUBIT_HEIGHT +
        QUBIT_HEIGHT / 2 -
        GATE_SIZE / 2

      {
        x: gate_x,
        y: gate_y,
        cx: gate_x + GATE_SIZE / 2,
        cy: gate_y + GATE_SIZE / 2
      }
    end

    # =========================
    # step中央X座標
    # =========================
    def step_center_x(step_index)
      CANVAS_MARGIN +
        step_index * STEP_WIDTH +
        STEP_WIDTH / 2
    end

    # =========================
    # qubit中央Y座標
    # =========================
    def qubit_center_y(qubit_index)
      CANVAS_MARGIN +
        qubit_index * QUBIT_HEIGHT +
        QUBIT_HEIGHT / 2
    end
  end
end