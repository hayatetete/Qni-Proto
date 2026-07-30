import { OperationComponent } from "./operation-component";
import { JsonableMixin } from "./jsonable-mixin";
import { LabelableMixin } from "./labelable-mixin";
import { OutlinedGateMixin } from "./outlined-gate-mixin";
import { SerializeableMixin } from "./serializeable-mixin";

export class AntiControlGate extends OutlinedGateMixin(
  SerializeableMixin(JsonableMixin(LabelableMixin(OperationComponent)))
) {
  /**
   * アイコン読み込みとパレット管理で使うゲート種別を返す。
   */
  get operationType(): string {
    return "AntiControlGate";
  }

  /**
   * JSON、URL、シミュレータへ渡す反制御点のラベルを返す。
   */
  get label(): string {
    return "◦";
  }
}
