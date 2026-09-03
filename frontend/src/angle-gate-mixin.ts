import { Constructor } from "./constructor";
import { OperationComponent } from "./operation-component";
import { SerializedGate } from "./types";

export const DEFAULT_ROTATION_ANGLE = "π/2";

type SerializableOperationComponent = OperationComponent & {
  serialize(
    targetBits: number[],
    controlBits?: number[],
    antiControlBits?: number[]
  ): SerializedGate;
};

export declare class AngleGate {
  get rotationAngle(): string;
  set rotationAngle(value: string);
  serialize(
    targetBits: number[],
    controlBits?: number[],
    antiControlBits?: number[]
  ): SerializedGate;
}

export function AngleGateMixin<
  TBase extends Constructor<SerializableOperationComponent>
>(
  Base: TBase
): Constructor<AngleGate> & TBase {
  return class AngleGateMixinClass extends Base {
    private _rotationAngle = DEFAULT_ROTATION_ANGLE;

    /** Notebookから復元した角度。未指定時だけ既定角を使う。 */
    get rotationAngle(): string {
      return this._rotationAngle;
    }

    set rotationAngle(value: string) {
      this._rotationAngle = value;
    }

    /**
     * 既存の制御情報に角度を付け足し、バックエンドへ渡せる形にする。
     */
    serialize(
      targetBits: number[],
      controlBits?: number[],
      antiControlBits?: number[]
    ): SerializedGate {
      const serialized = super.serialize(
        targetBits,
        controlBits,
        antiControlBits
      );

      return { ...serialized, angle: this.rotationAngle };
    }
  };
}
