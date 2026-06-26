import { ControlGate } from "./control-gate";
import { HGate } from "./h-gate";
import { MeasurementGate } from "./measurement-gate";
import { RnotGate } from "./rnot-gate";
import { SDaggerGate } from "./s-dagger-gate";
import { SGate } from "./s-gate";
import { SwapGate } from "./swap-gate";
import { TDaggerGate } from "./t-dagger-gate";
import { TGate } from "./t-gate";
import { Write0Gate } from "./write0-gate";
import { Write1Gate } from "./write1-gate";
import { XGate } from "./x-gate";
import { YGate } from "./y-gate";
import { ZGate } from "./z-gate";

export type OperationClass =
  | typeof HGate
  | typeof XGate
  | typeof YGate
  | typeof ZGate
  | typeof RnotGate
  | typeof SGate
  | typeof SDaggerGate
  | typeof TGate
  | typeof TDaggerGate
  | typeof SwapGate
  | typeof ControlGate
  | typeof Write0Gate
  | typeof Write1Gate
  | typeof MeasurementGate;

export type Operation =
  | HGate
  | XGate
  | YGate
  | ZGate
  | RnotGate
  | SGate
  | SDaggerGate
  | TGate
  | TDaggerGate
  | SwapGate
  | ControlGate
  | Write0Gate
  | Write1Gate
  | MeasurementGate;
