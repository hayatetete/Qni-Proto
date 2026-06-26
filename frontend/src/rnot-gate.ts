import { OperationComponent } from "./operation-component";
import { JsonableMixin } from "./jsonable-mixin";
import { LabelableMixin } from "./labelable-mixin";
import { SerializeableMixin } from "./serializeable-mixin";
import { SquareGateMixin } from "./square-gate-mixin";
import { ControllableMixin } from "./controllable-mixin";

export class RnotGate extends SquareGateMixin(
  ControllableMixin(
    SerializeableMixin(JsonableMixin(LabelableMixin(OperationComponent)))
  )
) {
  get operationType(): string {
    return "RnotGate";
  }

  get label(): string {
    return "√X";
  }

  get jsonLabel(): string {
    return "X^½";
  }
}
