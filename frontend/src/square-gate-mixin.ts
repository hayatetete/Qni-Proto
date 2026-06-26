import { Constructor } from "./constructor";
import { OperationComponent } from "./operation-component";
import { GateShapeConfig } from "./types";
import { Spacing } from "./spacing";
import {
  GateStyleMixin,
  GateStyle,
  GateStyleConstructor,
} from "./gate-style-mixin";

export declare class SquareGate extends GateStyle {}

export function SquareGateMixin<TBase extends Constructor<OperationComponent>>(
  Base: TBase
): Constructor<SquareGate> & TBase & GateStyleConstructor {
  const GateStyleBase = GateStyleMixin(Base);

  return class SquareGateMixinClass extends GateStyleBase {
    static SHAPE_CONFIG: GateShapeConfig = {
      cornerRadius: Spacing.cornerRadius.gate,
      strokeAlignment: 1,
    };
  };
}
