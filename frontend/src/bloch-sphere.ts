import { OperationComponent } from "./operation-component";
import { JsonableMixin } from "./jsonable-mixin";
import { LabelableMixin } from "./labelable-mixin";
import { OutlinedGateMixin } from "./outlined-gate-mixin";
import { SerializeableMixin } from "./serializeable-mixin";
import { Colors } from "./colors";
import { Graphics } from "pixi.js";

export class BlochSphere extends OutlinedGateMixin(
  SerializeableMixin(JsonableMixin(LabelableMixin(OperationComponent)))
) {
  private _x = 0;
  private _y = 0;
  private _z = 1;
  private vectorGraphics: Graphics;

  constructor() {
    super();

    this.vectorGraphics = new Graphics();
    this.addChild(this.vectorGraphics);
    this.updateBlochVector();
  }

  /**
   * アイコン読み込みとパレット管理で使う表示操作の種別を返す。
   */
  get operationType(): string {
    return "BlochSphere";
  }

  /**
   * JSON、URL、バックエンドへ渡すブロッホ球表示のラベルを返す。
   */
  get label(): string {
    return "Bloch";
  }

  set x(value: number) {
    this._x = value;
    this.updateBlochVector();
  }

  get x(): number {
    return this._x;
  }

  set y(value: number) {
    this._y = value;
    this.updateBlochVector();
  }

  get y(): number {
    return this._y;
  }

  set z(value: number) {
    this._z = value;
    this.updateBlochVector();
  }

  get z(): number {
    return this._z;
  }

  /**
   * シミュレータから返った局所状態を、球内のベクトルとして描画する。
   */
  setBlochVector(vector: { x: number; y: number; z: number }): void {
    this._x = vector.x;
    this._y = vector.y;
    this._z = vector.z;
    this.updateBlochVector();
  }

  private updateBlochVector(): void {
    const center = this.sizeInPx / 2;
    const radius = this.sizeInPx * 0.36;
    const projectedX = center + this._x * radius + this._y * radius * 0.3;
    const projectedY = center - this._z * radius - this._y * radius * 0.3;

    this.vectorGraphics
      .clear()
      .moveTo(center, center)
      .lineTo(projectedX, projectedY)
      .stroke({ color: Colors["border-active"], width: 2 })
      .circle(projectedX, projectedY, Math.max(2, this.sizeInPx * 0.07))
      .fill(Colors["border-active"]);

    // 非同期で追加されるアイコンより前面に、最新のベクトルを表示する。
    this.addChild(this.vectorGraphics);
  }
}
