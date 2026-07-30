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
    /**
     * 角度入力 UI が未実装のため、回転系ゲートは既定角を使う。
     */
    get rotationAngle(): string {
      return DEFAULT_ROTATION_ANGLE;
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
