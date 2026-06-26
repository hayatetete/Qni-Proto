import { CIRCUIT_STEP_EVENTS, OPERATION_EVENTS } from "./events";
import { DropzoneList } from "./dropzone-list";
import { CircuitStepState } from "./circuit-step-state";
import { Container } from "pixi.js";
import { Dropzone } from "./dropzone";
import { Operation } from "./operation";
import { groupBy, need } from "./util";
import { SerializedOperation } from "./types";
import { isControllable } from "./controllable-mixin";
import { OperationComponent } from "./operation-component";
import { HGate } from "./h-gate";
import { XGate } from "./x-gate";
import { YGate } from "./y-gate";
import { ZGate } from "./z-gate";
import { SGate } from "./s-gate";
import { SDaggerGate } from "./s-dagger-gate";
import { TGate } from "./t-gate";
import { TDaggerGate } from "./t-dagger-gate";
import { RnotGate } from "./rnot-gate";
import { Write0Gate } from "./write0-gate";
import { Write1Gate } from "./write1-gate";
import { MeasurementGate } from "./measurement-gate";
import { ControlGate } from "./control-gate";
import { SwapGate } from "./swap-gate";

/**
 * Represents a single step in a quantum circuit.
 *
 * This class manages a collection of Dropzones, each corresponding to a qubit in the circuit.
 * It handles the placement and interaction of operations within the step, including
 * special operations like swap gates and controlled operations.
 */
export class CircuitStep extends Container {
  /** The padding space around the dropzones within the circuit step. */
  static readonly PADDING = Dropzone.sizeInPx / 2;

  private dropzoneList!: DropzoneList;
  private state!: CircuitStepState;

  /**
   *  Returns the number of wires (qubits) in this circuit step.
   */
  get wireCount() {
    return this.dropzoneList.size;
  }

  /**
   * Returns all {@link Dropzone}s in this circuit step.
   */
  get dropzones(): Dropzone[] {
    return this.dropzoneList.all;
  }

  /**
   *  Returns true if all dropzones in this circuit step are empty (have no operations).
   */
  get isEmpty(): boolean {
    return this.dropzones.every((each) => each.operation === null);
  }

  /**
   * Returns the number of the highest qubit with an operation placed on it.
   * Qubit numbers start from 1.
   * Returns 0 if all qubits are empty (no operations placed).
   *
   * Examples:
   * - [X, _, H, _] => returns 3 (3rd qubit is the last with an operation)
   * - [_, _, _, X] => returns 4 (4th qubit is the last with an operation)
   * - [H, _, _, _] => returns 1 (only the 1st qubit has an operation)
   * - [_, _, _, _] => returns 0 (all qubits are empty)
   */
  get highestOccupiedQubitNumber() {
    return this.dropzones.reduce(
      (maxIndex, dropzone, currentIndex) =>
        dropzone.isOccupied() ? currentIndex + 1 : maxIndex,
      0
    );
  }

  /**
   * Checks if the pointer is currently over this circuit step.
   *
   * Returns true if the pointer is over the circuit step, false otherwise.
   */
  get isHovered(): boolean {
    return this.state.isHover();
  }

  /**
   * Checks if this circuit step is currently in an active state.
   *
   * Returns true if the circuit step is active, false otherwise.
   */
  get isActive(): boolean {
    return this.state.isActive();
  }

  private get occupiedDropzones() {
    return this.dropzoneList.occupied;
  }

  private get operations(): Operation[] {
    return this.occupiedDropzones.map((each) => each.operation as Operation);
  }

  private get controlBits(): number[] {
    return this.dropzoneList
      .filterByOperationType(ControlGate)
      .map((dropzone) => this.qubitNumberOf(dropzone));
  }

  /**
   * Creates a new CircuitStep instance.
   *
   * @param wireCount The number of wires (qubits) in this circuit step.
   */
  constructor(wireCount: number) {
    super();

    this.initializeState();
    this.initializeDropzoneList();
    this.createDropzones(wireCount);
    this.setupEventListeners();
  }

  private initializeState(): void {
    this.state = new CircuitStepState();
  }

  private initializeDropzoneList(): void {
    this.dropzoneList = new DropzoneList({
      padding: CircuitStep.PADDING,
    });
    this.addChild(this.dropzoneList);
  }

  private createDropzones(wireCount: number): void {
    for (let i = 0; i < wireCount; i++) {
      this.appendNewDropzone();
    }
  }

  private setupEventListeners(): void {
    this.on("pointerover", this.maybeSetHoverState, this)
      .on("pointerout", this.maybeSetIdleState, this)
      .on("pointerdown", this.activate, this);
    this.eventMode = "static";
  }

  /**
   * Retrieves a Dropzone at the specified index.
   *
   * @param index The index of the Dropzone to fetch.
   *
   * This method returns the Dropzone at the specified index.
   * If the index is out of bounds, it throws an error.
   */
  fetchDropzone(index: number) {
    return this.dropzoneList.fetch(index);
  }

  /**
   * Checks if an operation is present at the specified qubit index.
   *
   * @param index The index of the qubit to check.
   *
   * This method returns true if there is an operation placed on the dropzone
   * at the specified qubit index, and false otherwise.
   * If the qubit index is out of bounds, it will throw an error.
   */
  hasOperationAt(index: number) {
    const dropzone = this.fetchDropzone(index);

    return dropzone.isOccupied();
  }

  /**
   * Appends a new Dropzone to the end of the circuit step.
   * The method returns the newly created and appended Dropzone.
   */
  appendNewDropzone() {
    const dropzone = this.dropzoneList.append();

    dropzone.on(OPERATION_EVENTS.SNAPPED, this.onDropzoneSnap, this);
    dropzone.on(OPERATION_EVENTS.GRABBED, (operation, globalPosition) => {
      this.emit(OPERATION_EVENTS.GRABBED, operation, globalPosition);
    });

    return dropzone;
  }

  /**
   * Removes the last Dropzone from the circuit step.
   *
   * This method removes the Dropzone at the end of the dropzone list.
   * If the list is already empty, this method has no effect.
   */
  removeLastDropzone() {
    this.dropzoneList.removeLast();
  }

  /**
   * Activates this circuit step.
   *
   * If the step is already active, this method has no effect.
   */
  activate() {
    if (this.isActive) {
      return;
    }

    this.state.setActive();
    this.emit(CIRCUIT_STEP_EVENTS.ACTIVATED, this);
  }

  /**
   * Deactivates this circuit step.
   *
   * Sets the state of the circuit step to idle.
   */
  deactivate() {
    this.state.setIdle();
  }

  /**
   * Updates the connections between operations in the circuit step.
   * This method handles the visual connections for swap operations and controlled operations.
   */
  updateConnections(): void {
    this.updateSwapConnections();
    this.updateControlledUConnections();
  }

  /**
   * Serializes the current state of the circuit step into a JSON-compatible format.
   *
   * This method converts the operations in the circuit step into a serialized representation,
   * including information about the type of operation and target qubits. For controlled operations,
   * it also includes control qubits.
   *
   * Returns an array of serialized operations, each represented as an object.
   */
  serialize(): SerializedOperation[] {
    const result: SerializedOperation[] = [];
    const operations = this.operations;

    for (const [operationClass, sameOps] of groupBy(
      operations,
      (op) => op.constructor
    )) {
      if (
        operationClass === ControlGate &&
        operations.some((op) => isControllable(op))
      ) {
        continue;
      }

      // const sameOperations = sameOps as Operation[];
      const targetBits = sameOps.map((each) =>
        this.dropzoneList.findIndexOf(each)
      );
      const operation = sameOps[0];
      const serializedGate = isControllable(operation)
        ? operation.serialize(targetBits, this.controlBits)
        : operation.serialize(targetBits);
      result.push(serializedGate);
    }

    return result;
  }

  toJSON() {
    const jsons = this.dropzones.map((each) => each.toJSON());
    return `[${jsons.join(",")}]`;
  }

  /**
   * JSONデータからCircuitStepのインスタンスを生成する
   * @param stepJson ステップのJSONデータ
   * @returns 復元されたCircuitStepのインスタンス
   */
  static fromJSON(stepJson: any[]): CircuitStep {
    if (!Array.isArray(stepJson)) {
      console.error("Invalid step data format:", stepJson);
      return new CircuitStep(1);
    }

    const circuitStep = new CircuitStep(stepJson.length);

    // 各ドロップゾーンにゲートを生成
    const ops: (OperationComponent | null)[] = stepJson.map((state) => {
      let label: string | null = null;
      if (typeof state === "string") {
        label = state;
      } else if (Array.isArray(state) && typeof state[0] === "string") {
        label = state[0];
      }
      if (label) {
        const operation = this.createOperationFromLabel(label);
        if (!operation) {
          // エラーメッセージとともに例外を投げる
          throw new Error(`Unknown operation label encountered during deserialization: ${label}`);
        }
        return operation;
      }
      return null;
    });

    // Swapゲートのペアリング
    const swapIdx = ops
      .map((op, i) => (op instanceof SwapGate ? i : -1))
      .filter((i) => i !== -1);

    // コントロールゲートとXゲートの関係
    const controlIdx = ops
      .map((op, i) => (op instanceof ControlGate ? i : -1))
      .filter((i) => i !== -1);
    const xIdx = ops
      .map((op, i) => (op instanceof XGate ? i : -1))
      .filter((i) => i !== -1);
    if (controlIdx.length > 0 && xIdx.length > 0) {
      for (const i of xIdx) {
        const xOp = ops[i];
        if (xOp && "controls" in xOp) {
          xOp.controls = controlIdx;
        }
      }
    }

    // ゲートをドロップゾーンに配置
    ops.forEach((op, i) => {
      if (op) circuitStep.fetchDropzone(i).assign(op);
    });
    circuitStep.updateOperationAttributes();
    circuitStep.updateConnections();
    return circuitStep;
  }

  /**
   * 指定された文字列ラベルに対応するゲートインスタンスを生成する
   * @param label ゲートのラベル文字列
   * @returns 生成されたOperationComponentインスタンス、または対応するラベルがない場合はnull
   */
  private static createOperationFromLabel(
    label: string
  ): OperationComponent | null {
    switch (label) {
      case "H":
        return new HGate();
      case "X":
        return new XGate();
      case "Y":
        return new YGate();
      case "Z":
        return new ZGate();
      case "S":
        return new SGate();
      case "S†":
        return new SDaggerGate();
      case "T":
        return new TGate();
      case "T†":
        return new TDaggerGate();
      case "X^½":
        return new RnotGate();
      case "|0>":
        return new Write0Gate();
      case "|1>":
        return new Write1Gate();
      case "Measure":
        return new MeasurementGate();
      case "•":
        return new ControlGate();
      case "Swap":
        return new SwapGate();
      default:
        console.warn(`Unknown operation label in JSON: ${label}. Skipping.`);
        return null;
    }
  }

  /**
   * ゲート間の接続やコントロール関係を再構築する
   */
  updateOperationAttributes(): void {
    // 全てのdropzoneの上下接続をリセット
    for (const dropzone of this.dropzones) {
      dropzone.connectTop = false;
      dropzone.connectBottom = false;
    }

    const controlDropzones =
      this.dropzoneList.filterByOperationType(ControlGate);
    const controllableDropzones = this.controllableDropzones();

    // コントロールゲートの初期化
    for (const dz of controllableDropzones) {
      if (isControllable(dz.operation)) {
        dz.operation.controls = [];
      }
    }

    this.updateSwapConnections();

    if (controlDropzones.length === 1 && controllableDropzones.length === 0) {
      return;
    }

    // コントロール線の接続を更新
    if (controlDropzones.length > 0) {
      if (controllableDropzones.length === 0) {
        this.updateControlControlConnections();
      } else {
        this.updateControlledUConnections();
      }
    }

    this.applyConnectionUpdates();
  }

  /**
   * コントロールゲート同士の上下接続を更新
   */
  private updateControlControlConnections(): void {
    const controlDropzones =
      this.dropzoneList.filterByOperationType(ControlGate);
    const controlBits = controlDropzones.map((dz) => this.qubitNumberOf(dz));
    for (const dz of controlDropzones) {
      dz.connectTop = controlBits.some((bit) => this.qubitNumberOf(dz) > bit);
      dz.connectBottom = controlBits.some(
        (bit) => this.qubitNumberOf(dz) < bit
      );
    }
  }

  private qubitNumberOf(dropzone: Dropzone): number {
    const num = this.dropzones.indexOf(dropzone);
    need(num !== -1, "dropzone not found.");

    return num;
  }

  private updateSwapConnections(): void {
    const swapDropzones = this.dropzoneList.filterByOperationType(SwapGate);
    const swapBits = swapDropzones.map((each) => this.qubitNumberOf(each));

    if (swapDropzones.length !== 2) {
      for (const dropzone of this.dropzones) {
        dropzone.swapConnectTop = false;
        dropzone.swapConnectBottom = false;
      }
    } else {
      const [minBit, maxBit] = [Math.min(...swapBits), Math.max(...swapBits)];

      for (const dropzone of this.dropzones) {
        const bit = this.qubitNumberOf(dropzone);
        dropzone.swapConnectTop = bit > minBit && bit <= maxBit;
        dropzone.swapConnectBottom = bit >= minBit && bit < maxBit;
      }
    }

    this.applyConnectionUpdates();
  }

  private updateControlledUConnections(): void {
    const controllableDropzones = this.controllableDropzones();
    const controlDropzones =
      this.dropzoneList.filterByOperationType(ControlGate);
    const allControlBits = controlDropzones.map((dz) => this.qubitNumberOf(dz));

    const activeControlBits = allControlBits.slice(0, controlDropzones.length);
    const controllableBits = controllableDropzones.map((dz) =>
      this.qubitNumberOf(dz)
    );
    const activeOperationBits = activeControlBits.concat(controllableBits);

    if (activeControlBits.length > 0 && activeOperationBits.length > 0) {
      const [minBit, maxBit] = [
        Math.min(...activeOperationBits),
        Math.max(...activeOperationBits),
      ];

      for (const dropzone of this.dropzones) {
        const bit = this.qubitNumberOf(dropzone);
        dropzone.controlConnectTop = bit > minBit && bit <= maxBit;
        dropzone.controlConnectBottom = bit >= minBit && bit < maxBit;
      }

      // Set controls for XGates
      for (const each of controllableDropzones) {
        need(isControllable(each.operation), "operation is not Controllable");
        each.operation.controls = allControlBits;
      }
    } else {
      for (const dropzone of this.dropzones) {
        dropzone.controlConnectTop = false;
        dropzone.controlConnectBottom = false;
      }
    }

    this.applyConnectionUpdates();
  }

  private applyConnectionUpdates(): void {
    for (const dropzone of this.dropzones) {
      dropzone.connectTop =
        dropzone.swapConnectTop || dropzone.controlConnectTop;
      dropzone.connectBottom =
        dropzone.swapConnectBottom || dropzone.controlConnectBottom;
    }
  }

  private controllableDropzones(): Dropzone[] {
    return this.dropzoneList.occupied.filter((dropzone) =>
      isControllable(dropzone.operation)
    );
  }

  private onDropzoneSnap(dropzone: Dropzone) {
    this.emit(OPERATION_EVENTS.SNAPPED, this, dropzone);
  }

  private maybeSetHoverState() {
    if (this.state.isIdle()) {
      this.state.setHover();
    }
    this.emit(CIRCUIT_STEP_EVENTS.HOVERED, this);
  }

  private maybeSetIdleState() {
    if (this.state.isHover()) {
      this.state.setIdle();
    }
  }
}
