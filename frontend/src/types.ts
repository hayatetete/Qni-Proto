import { MAX_QUBIT_COUNT } from "./constants";

export type Enumerate<
  N extends number,
  Acc extends number[] = []
> = Acc["length"] extends N
  ? Acc[number]
  : Enumerate<N, [...Acc, Acc["length"]]>;

export type QubitCount =
  | Exclude<Enumerate<typeof MAX_QUBIT_COUNT>, 0>
  | typeof MAX_QUBIT_COUNT;

export enum WireType {
  Quantum = "quantum",
  Classical = "classical",
}

export interface SerializedGate {
  type: string;
  targets: number[];
  controls?: number[];
}

export type GateShapeConfig = {
  cornerRadius: number;
  strokeAlignment: number;
};

export type GateState = "idle" | "hover" | "grabbed" | "active";

export type GateStyleOptions = {
  cursor: string;
  iconInverse?: boolean;
  iconColor?: string;
  fillColor: string;
  borderColor: string;
  borderAlpha: number;
};

export type SerializedOperation = {
  type: string;
  targets: number[];
  controls?: number[];
};
