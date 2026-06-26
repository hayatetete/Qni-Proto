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

export declare class OutlinedGate extends GateStyle {}

export function OutlinedGateMixin<
  TBase extends Constructor<OperationComponent>
>(Base: TBase): Constructor<OutlinedGate> & TBase & GateStyleConstructor {
  const GateStyleBase = GateStyleMixin(Base);

  return class OutlinedGateMixinClass extends GateStyleBase {
    static SHAPE_CONFIG: GateShapeConfig = {
      cornerRadius: Spacing.cornerRadius.gate,
      strokeAlignment: 1,
    };

    protected readonly styleMap: Record<GateState, GateStyleOptions> = {
      idle: {
        cursor: "default",
        iconColor: Colors["icon-brand"],
        fillColor: "transparent",
        borderColor: Colors["border-hover"],
        borderAlpha: 0,
      },
      hover: {
        cursor: "grab",
        iconColor: Colors["icon-brand"],
        fillColor: "transparent",
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
        iconColor: Colors["icon-brand"],
        fillColor: "transparent",
        borderColor: Colors["border-active"],
        borderAlpha: 1,
      },
    };
  };
}
