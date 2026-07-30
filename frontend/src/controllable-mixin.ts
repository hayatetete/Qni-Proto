import { Constructor } from "./constructor";
import { OperationComponent } from "./operation-component";
import { SerializedGate } from "./types";
import { SerializeableMixin } from "./serializeable-mixin";

export declare class Controllable {
  get controls(): number[];
  set controls(value: number[]);
  get antiControls(): number[];
  set antiControls(value: number[]);
}

export function ControllableMixin<
  TBase extends Constructor<OperationComponent>
>(Base: TBase): Constructor<Controllable> & TBase {
  return class ControllableMixinClass extends SerializeableMixin(Base) {
    private _controls: number[] = [];
    private _antiControls: number[] = [];

    /**
     * 制御条件が 1 の量子ビット番号を返す。
     */
    get controls(): number[] {
      return this._controls;
    }

    /**
     * 制御条件が 1 の量子ビット番号を保存する。
     */
    set controls(value: number[]) {
      this._controls = value.sort();
    }

    /**
     * 制御条件が 0 の量子ビット番号を返す。
     */
    get antiControls(): number[] {
      return this._antiControls;
    }

    /**
     * 制御条件が 0 の量子ビット番号を保存する。
     */
    set antiControls(value: number[]) {
      this._antiControls = value.sort();
    }

    serialize(
      targetBits: number[],
      controlBits?: number[],
      antiControlBits?: number[]
    ): SerializedGate {
      const allControlBits = [...(controlBits ?? []), ...(antiControlBits ?? [])];
      if (allControlBits.some((bit) => targetBits.includes(bit))) {
        throw new Error(
          "Overlap detected between target bits and control bits."
        );
      }

      const serialized: SerializedGate = {
        type: this.serializeType,
        targets: targetBits,
      };

      if (controlBits && controlBits.length > 0) {
        serialized.controls = controlBits;
      }

      if (antiControlBits && antiControlBits.length > 0) {
        serialized.antiControls = antiControlBits;
      }

      return serialized;
    }
  };
}

export function isControllable(arg: unknown): arg is Controllable {
  return typeof arg === "object" && arg !== null && "controls" in arg;
}
