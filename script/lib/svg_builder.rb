module QDraw
  class SvgBuilder
    def initialize
      @parts = []
    end

    def add(text)
      @parts << text
    end

    def to_s
      @parts.join("\n")
    end
  end
end