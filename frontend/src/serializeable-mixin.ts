import { Constructor } from "./constructor";
import { OperationComponent } from "./operation-component";
import { SerializedGate } from "./types";

export declare class Serializeable {
  get serializeType(): string;
  serialize(targetBits: number[], _controlBits?: number[]): SerializedGate;
}

export function SerializeableMixin<
  TBase extends Constructor<OperationComponent>
>(Base: TBase): Constructor<Serializeable> & TBase {
  return class SerializeableMixinClass extends Base {
    get serializeType(): string {
      if (!("jsonLabel" in this) || typeof this.jsonLabel !== "string") {
        throw new Error("SerializeableMixin must be used with JsonableMixin");
      }

      return this.jsonLabel;
    }

    serialize(targetBits: number[]): SerializedGate {
      return { type: this.serializeType, targets: targetBits };
    }
  };
}
