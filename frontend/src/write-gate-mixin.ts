import { Constructor } from "./constructor";
import { OperationComponent } from "./operation-component";
import { GateShapeConfig, GateState, GateStyleOptions } from "./types";
import { Spacing } from "./spacing";
import { Colors } from "./colors";
import {
  GateStyleMixin,
  GateStyle,
  GateStyleConstructor,
} from "./gate-style-mixin";

export declare class WriteGate extends GateStyle {}

export function WriteGateMixin<TBase extends Constructor<OperationComponent>>(
  Base: TBase
): Constructor<WriteGate> & TBase & GateStyleConstructor {
  const GateStyleBase = GateStyleMixin(Base);

  return class WriteGateMixinClass extends GateStyleBase {
    static SHAPE_CONFIG: GateShapeConfig = {
      cornerRadius: Spacing.cornerRadius.gate,
      strokeAlignment: 1,
    };

    protected readonly styleMap: Record<GateState, GateStyleOptions> = {
      idle: {
        cursor: "default",
        fillColor: "transparent",
        borderColor: Colors["border-hover"],
        borderAlpha: 0,
      },
      hover: {
        cursor: "grab",
        fillColor: "transparent",
        borderColor: Colors["border-hover"],
        borderAlpha: 1,
      },
      grabbed: {
        cursor: "grabbing",
        iconInverse: true,
        fillColor: Colors["bg-active"],
        borderColor: Colors["border-pressed"],
        borderAlpha: 1,
      },
      active: {
        cursor: "grab",
        fillColor: "transparent",
        borderColor: Colors["border-active"],
        borderAlpha: 1,
      },
    };
  };
}
