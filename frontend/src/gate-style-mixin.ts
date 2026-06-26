import { Colors } from "./colors";
import { Constructor } from "./constructor";
import { OperationComponent } from "./operation-component";
import { Spacing } from "./spacing";
import { GateShapeConfig, GateState, GateStyleOptions } from "./types";
import { need } from "./util";

export declare class GateStyle {
  get borderWidth(): number;
  get cornerRadius(): number;
  applyIdleStyle(): void;
  applyHoverStyle(): void;
  applyGrabbedStyle(): void;
  applyActiveStyle(): void;
}

export interface GateStyleConstructor {
  SHAPE_CONFIG: GateShapeConfig;
}

export function GateStyleMixin<TBase extends Constructor<OperationComponent>>(
  Base: TBase
): Constructor<GateStyle> & TBase & GateStyleConstructor {
  return class GateStyleMixinClass extends Base {
    protected readonly styleMap: Record<GateState, GateStyleOptions> = {
      idle: {
        cursor: "default",
        iconColor: Colors["icon-onbrand"],
        fillColor: Colors["bg-brand"],
        borderColor: Colors["border-onbrand"],
        borderAlpha: 1,
      },
      hover: {
        cursor: "grab",
        iconColor: Colors["icon-onbrand"],
        fillColor: Colors["bg-brand-hover"],
        borderColor: Colors["border-hover"],
        borderAlpha: 1,
      },
      grabbed: {
        cursor: "grabbing",
        iconColor: Colors["icon-onbrand"],
        fillColor: Colors["bg-active"],
        borderColor: Colors["border-pressed"],
        borderAlpha: 1,
      },
      active: {
        cursor: "grab",
        iconColor: Colors["icon-onbrand"],
        fillColor: Colors["bg-brand"],
        borderColor: Colors["border-active"],
        borderAlpha: 1,
      },
    };

    static SHAPE_CONFIG: GateShapeConfig = {
      cornerRadius: 0,
      strokeAlignment: 0,
    };

    applyIdleStyle(): void {
      this.applyStyleForState("idle");
      this.zIndex = 0;
    }

    applyHoverStyle(): void {
      this.applyStyleForState("hover");
      this.zIndex = 0;
    }

    applyGrabbedStyle(): void {
      this.applyStyleForState("grabbed");
      this.zIndex = 10;
    }

    applyActiveStyle(): void {
      this.applyStyleForState("active");
      this.zIndex = 0;
    }

    protected applyStyleForState(state: GateState): void {
      this.applyStyle(this.styleMap[state]);
    }

    protected applyStyle(options: GateStyleOptions): void {
      this.setCursor(options.cursor);
      this.drawShape(
        options.iconColor,
        options.iconInverse || false,
        options.fillColor,
        options.borderColor,
        options.borderAlpha
      );
      this.validateBounds();
    }

    protected setCursor(cursor: string): void {
      this._shape.cursor = cursor;
    }

    protected drawShape(
      iconColor: string | undefined,
      iconInverse: boolean,
      fillColor: string,
      borderColor: string,
      borderAlpha: number
    ): void {
      const constructor = this.constructor as typeof GateStyleMixinClass;
      const { strokeAlignment } = constructor.SHAPE_CONFIG;

      this._shape
        .clear()
        .roundRect(
          this.borderWidth / 2,
          this.borderWidth / 2,
          this.borderSize,
          this.borderSize,
          this.cornerRadius
        )
        .fill(fillColor)
        .stroke({
          color: borderColor,
          width: this.borderWidth,
          alignment: strokeAlignment,
          alpha: borderAlpha,
        });

      if (iconColor) {
        this.sprite.tint = iconColor;
      }

      if (iconInverse) {
        this.sprite.visible = false;
        this.whiteSprite.visible = true;
      } else {
        this.sprite.visible = true;
        this.whiteSprite.visible = false;
      }
    }

    protected get borderSize(): number {
      return this.sizeInPx - this.borderWidth;
    }

    get borderWidth(): number {
      return Spacing.borderWidth.gate[this.size];
    }

    get cornerRadius(): number {
      const constructor = this.constructor as typeof GateStyleMixinClass;
      const { cornerRadius } = constructor.SHAPE_CONFIG;

      return cornerRadius;
    }

    protected validateBounds(): void {
      const bounds = this.getLocalBounds();
      this.validateBoundsSize(bounds);
      this.validateBoundsPosition(bounds);
    }

    private validateBoundsSize(bounds: { width: number; height: number }) {
      const expectedSize = this.sizeInPx;
      need(
        bounds.width === expectedSize && bounds.height === expectedSize,
        `Size is incorrect: ${bounds.width}x${bounds.height}, expected: ${expectedSize}x${expectedSize}`
      );
    }

    private validateBoundsPosition(bounds: { x: number; y: number }) {
      need(
        bounds.x === 0 && bounds.y === 0,
        `Position is incorrect: (${bounds.x}, ${bounds.y}), expected: (0, 0)`
      );
    }
  };
}
