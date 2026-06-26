import { CircularGateMixin } from "./circular-gate-mixin";
import { OperationComponent } from "./operation-component";
import { JsonableMixin } from "./jsonable-mixin";
import { LabelableMixin } from "./labelable-mixin";
import { ControllableMixin } from "./controllable-mixin";
import { Spacing } from "./spacing";
import { SerializeableMixin } from "./serializeable-mixin";

export class XGate extends CircularGateMixin(
  ControllableMixin(
    SerializeableMixin(JsonableMixin(LabelableMixin(OperationComponent)))
  )
) {
  static readonly cornerRadius = Spacing.cornerRadius.full;

  get operationType(): string {
    return "XGate";
  }

  get label(): string {
    return "X";
  }
}
