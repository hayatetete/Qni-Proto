import { OperationComponent } from "./operation-component";
import { JsonableMixin } from "./jsonable-mixin";
import { LabelableMixin } from "./labelable-mixin";
import { SerializeableMixin } from "./serializeable-mixin";
import { SquareGateMixin } from "./square-gate-mixin";
import { SerializedGate } from "./types";

export class QftGate extends SquareGateMixin(
  SerializeableMixin(JsonableMixin(LabelableMixin(OperationComponent)))
) {
  /**
   * アイコン読み込みとパレット管理で使うゲート種別を返す。
   */
  get operationType(): string {
    return "QftGate";
  }

  /**
   * JSON、URL、シミュレータへ渡す QFT ゲートのラベルを返す。
   */
  get label(): string {
    return "QFT";
  }

  /**
   * 同一ステップに並ぶ QFT ゲート数を QFT の作用幅として保存する。
   */
  serialize(targetBits: number[]): SerializedGate {
    return { type: this.serializeType, targets: targetBits, span: targetBits.length };
  }
}
