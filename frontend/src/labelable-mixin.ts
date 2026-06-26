import { Constructor } from "./constructor";
import { OperationComponent } from "./operation-component";
import { NotImplementedError } from "./not-implemented-error";

export declare class Labelable {
  get label(): string;
}

export function LabelableMixin<TBase extends Constructor<OperationComponent>>(
  Base: TBase
): Constructor<Labelable> & TBase {
  class LabelableMixinClass extends Base {
    get label(): string {
      throw new NotImplementedError("label", this.constructor.name);
    }
  }

  return LabelableMixinClass as Constructor<Labelable> & TBase;
}
