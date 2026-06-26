import { OperationComponent } from "./operation-component";
import { JsonableMixin } from "./jsonable-mixin";
import { LabelableMixin } from "./labelable-mixin";
import { SerializeableMixin } from "./serializeable-mixin";
import { WriteGateMixin } from "./write-gate-mixin";

export class Write1Gate extends WriteGateMixin(
  SerializeableMixin(JsonableMixin(LabelableMixin(OperationComponent)))
) {
  get operationType(): string {
    return "Write1Gate";
  }

  get label(): string {
    return "1";
  }

  get jsonLabel(): string {
    return "|1>";
  }
}
