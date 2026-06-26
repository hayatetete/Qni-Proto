import { OperationComponent } from "./operation-component";
import { JsonableMixin } from "./jsonable-mixin";
import { LabelableMixin } from "./labelable-mixin";
import { SerializeableMixin } from "./serializeable-mixin";
import { SquareGateMixin } from "./square-gate-mixin";
import { ControllableMixin } from "./controllable-mixin";

export class HGate extends SquareGateMixin(
  ControllableMixin(
    SerializeableMixin(JsonableMixin(LabelableMixin(OperationComponent)))
  )
) {
  get operationType(): string {
    return "HGate";
  }

  get label(): string {
    return "H";
  }
}
