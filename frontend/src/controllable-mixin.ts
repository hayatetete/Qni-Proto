import { Constructor } from "./constructor";
import { OperationComponent } from "./operation-component";
import { SerializedGate } from "./types";
import { SerializeableMixin } from "./serializeable-mixin";

export declare class Controllable {
  get controls(): number[];
  set controls(value: number[]);
}

export function ControllableMixin<
  TBase extends Constructor<OperationComponent>
>(Base: TBase): Constructor<Controllable> & TBase {
  return class ControllableMixinClass extends SerializeableMixin(Base) {
    private _controls: number[] = [];

    get controls(): number[] {
      return this._controls;
    }

    set controls(value: number[]) {
      this._controls = value.sort();
    }

    serialize(targetBits: number[], controlBits?: number[]): SerializedGate {
      if (controlBits && controlBits.some((bit) => targetBits.includes(bit))) {
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

      return serialized;
    }
  };
}

export function isControllable(arg: unknown): arg is Controllable {
  return typeof arg === "object" && arg !== null && "controls" in arg;
}
