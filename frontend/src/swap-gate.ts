import { OperationComponent } from "./operation-component";
import { JsonableMixin } from "./jsonable-mixin";
import { LabelableMixin } from "./labelable-mixin";
import { OutlinedGateMixin } from "./outlined-gate-mixin";
import { SerializeableMixin } from "./serializeable-mixin";

export class SwapGate extends OutlinedGateMixin(
  SerializeableMixin(JsonableMixin(LabelableMixin(OperationComponent)))
) {
  get operationType(): string {
    return "SwapGate";
  }

  get label(): string {
    return "×";
  }

  get jsonLabel(): string {
    return "Swap";
  }
}
