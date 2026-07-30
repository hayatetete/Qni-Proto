import { OperationComponent } from "./operation-component";
import { JsonableMixin } from "./jsonable-mixin";
import { LabelableMixin } from "./labelable-mixin";
import { SerializeableMixin } from "./serializeable-mixin";
import { SquareGateMixin } from "./square-gate-mixin";
import { ControllableMixin } from "./controllable-mixin";
import { AngleGateMixin } from "./angle-gate-mixin";

export class RyGate extends SquareGateMixin(
  AngleGateMixin(
    ControllableMixin(
      SerializeableMixin(JsonableMixin(LabelableMixin(OperationComponent)))
    )
  )
) {
  /**
   * アイコン読み込みとパレット管理で使うゲート種別を返す。
   */
  get operationType(): string {
    return "RyGate";
  }

  /**
   * JSON、URL、シミュレータへ渡す Y 軸回転ゲートのラベルを返す。
   */
  get label(): string {
    return "Ry";
  }
}
