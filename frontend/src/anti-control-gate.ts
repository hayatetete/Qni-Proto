import { OperationComponent } from "./operation-component";
import { JsonableMixin } from "./jsonable-mixin";
import { LabelableMixin } from "./labelable-mixin";
import { OutlinedGateMixin } from "./outlined-gate-mixin";
import { SerializeableMixin } from "./serializeable-mixin";
import { Colors } from "./colors";
import { Graphics } from "pixi.js";

export class AntiControlGate extends OutlinedGateMixin(
  SerializeableMixin(JsonableMixin(LabelableMixin(OperationComponent)))
) {
  constructor() {
    super();

    // The vertical control connection is rendered by the parent dropzone.
    // Occlude it inside the hollow marker so anti-control never looks filled.
    const connectionOccluder = new Graphics()
      .circle(this.sizeInPx / 2, this.sizeInPx / 2, 5)
      .fill(Colors["bg-component"]);
    this.addChildAt(connectionOccluder, 1);
  }

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
