import { OperationComponent } from "./operation-component";
import { JsonableMixin } from "./jsonable-mixin";
import { LabelableMixin } from "./labelable-mixin";
import { SerializeableMixin } from "./serializeable-mixin";
import { SquareGateMixin } from "./square-gate-mixin";
import { ControllableMixin } from "./controllable-mixin";

export class SDaggerGate extends SquareGateMixin(
  ControllableMixin(
    SerializeableMixin(JsonableMixin(LabelableMixin(OperationComponent)))
  )
) {
  get operationType(): string {
    return "SDaggerGate";
  }

  get label(): string {
    return "S†";
  }
}
