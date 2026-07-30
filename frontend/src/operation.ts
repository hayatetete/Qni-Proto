import { AntiControlGate } from "./anti-control-gate";
import { BlochSphere } from "./bloch-sphere";
import { ControlGate } from "./control-gate";
import { HGate } from "./h-gate";
import { MeasurementGate } from "./measurement-gate";
import { PhaseGate } from "./phase-gate";
import { QftDaggerGate } from "./qft-dagger-gate";
import { QftGate } from "./qft-gate";
import { RnotGate } from "./rnot-gate";
import { RxGate } from "./rx-gate";
import { RyGate } from "./ry-gate";
import { RzGate } from "./rz-gate";
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
  | typeof PhaseGate
  | typeof RxGate
  | typeof RyGate
  | typeof RzGate
  | typeof SwapGate
  | typeof ControlGate
  | typeof AntiControlGate
  | typeof Write0Gate
  | typeof Write1Gate
  | typeof MeasurementGate
  | typeof BlochSphere
  | typeof QftGate
  | typeof QftDaggerGate;

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
  | PhaseGate
  | RxGate
  | RyGate
  | RzGate
  | SwapGate
  | ControlGate
  | AntiControlGate
  | Write0Gate
  | Write1Gate
  | MeasurementGate
  | BlochSphere
  | QftGate
  | QftDaggerGate;
