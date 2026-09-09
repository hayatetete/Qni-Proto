import {
  CIRCUIT_STEP_EVENTS,
  OPERATION_EVENTS,
} from "./events";
import { DropzoneList } from "./dropzone-list";
import { CircuitStepState } from "./circuit-step-state";
import { Container, Rectangle } from "pixi.js";
import { AntiControlGate } from "./anti-control-gate";
import { BlochSphere } from "./bloch-sphere";
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
import { PhaseGate } from "./phase-gate";
import { QftDaggerGate } from "./qft-dagger-gate";
import { QftGate } from "./qft-gate";
import { ControlGate } from "./control-gate";
import { SwapGate } from "./swap-gate";
import { RxGate } from "./rx-gate";
import { RyGate } from "./ry-gate";
import { RzGate } from "./rz-gate";

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
      0,
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
   * このステップ内で 0 条件の制御点が置かれている量子ビット番号を返す。
   */
  private get antiControlBits(): number[] {
    return this.dropzoneList
      .filterByOperationType(AntiControlGate)
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

  setHovered(hovered: boolean): void {
    if (hovered && this.state.isIdle()) {
      this.state.setHover();
    } else if (!hovered && this.state.isHover()) {
      this.state.setIdle();
    }
    this.emit(CIRCUIT_STEP_EVENTS.HOVERED, this);
  }

  setPresentationMode(enabled: boolean): void {
    // Read-only presentation still allows selecting a step so that the
    // original whole-column hover can drive state-vector inspection.
    this.eventMode = "static";
    this.interactiveChildren = !enabled;
    this.hitArea = enabled ? new Rectangle(0, 0, this.width, this.height) : null;
    this.dropzones.forEach((dropzone) => dropzone.setPresentationMode(enabled));
  }

  setDisplayScale(scale: number): void {
    this.dropzones.forEach((dropzone) => dropzone.setDisplayScale(scale));
  }

  /**
   * Updates the connections between operations in the circuit step.
   * This method handles the visual connections for swap operations and controlled operations.
   */
  updateConnections(): void {
    this.updateSwapConnections();
    this.updateQftConnections();
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
      (op) => op.constructor,
    )) {
      if (operationClass === QftGate || operationClass === QftDaggerGate) {
        continue;
      }

      if (
        (operationClass === ControlGate ||
          operationClass === AntiControlGate) &&
        operations.some((op) => isControllable(op))
      ) {
        continue;
      }

      // const sameOperations = sameOps as Operation[];
      const targetBits = sameOps.map((each) =>
        this.dropzoneList.findIndexOf(each),
      );
      const operation = sameOps[0];
      const serializedGate = isControllable(operation)
        ? operation.serialize(
            targetBits,
            this.controlBits,
            this.antiControlBits,
          )
        : operation.serialize(targetBits);
      result.push(serializedGate);
    }

    result.push(...this.serializeQftOperations(QftGate));
    result.push(...this.serializeQftOperations(QftDaggerGate));

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
  static fromJSON(stepJson: unknown[]): CircuitStep {
    if (!Array.isArray(stepJson)) {
      console.error("Invalid step data format:", stepJson);
      return new CircuitStep(1);
    }

    const labels = stepJson.map((state) => {
      if (typeof state === "string") {
        return state;
      }
      if (Array.isArray(state) && typeof state[0] === "string") {
        return state[0];
      }
      return null;
    });
    const requiredWireCount = labels.reduce((wireCount, label, index) => {
      const span = CircuitStep.qftSpanFromLabel(label);
      return span === null ? wireCount : Math.max(wireCount, index + span);
    }, stepJson.length);
    const circuitStep = new CircuitStep(requiredWireCount);

    // 各ドロップゾーンにゲートを生成
    const ops: (OperationComponent | null)[] = labels.map((label) => {
      if (label) {
        const operation = this.createOperationFromLabel(
          CircuitStep.baseLabelFromResizableQftLabel(label),
        );
        if (!operation) {
          // エラーメッセージとともに例外を投げる
          throw new Error(
            `Unknown operation label encountered during deserialization: ${label}`,
          );
        }
        return operation;
      }
      return null;
    });
    while (ops.length < requiredWireCount) {
      ops.push(null);
    }

    // Notebook URLから渡された数値回転角を、復元したゲートへ保持する。
    stepJson.forEach((state, index) => {
      if (!Array.isArray(state) || typeof state[1] !== "object" || !state[1]) {
        return;
      }
      const angle = (state[1] as { angle?: unknown }).angle;
      const operation = ops[index];
      if (
        typeof angle === "string" &&
        operation &&
        "rotationAngle" in operation
      ) {
        operation.rotationAngle = angle;
      }
    });

    // 旧 Qni の "QFT3" / "QFT†3" を、現行の隣接 QFT 配置へ展開する。
    labels.forEach((label, index) => {
      const span = CircuitStep.qftSpanFromLabel(label);
      if (span === null || span <= 1) {
        return;
      }

      const operationClass = label?.startsWith("QFT†")
        ? QftDaggerGate
        : QftGate;
      for (let offset = 1; offset < span; offset++) {
        ops[index + offset] = new operationClass();
      }
    });

    // コントロールゲートとXゲートの関係
    const controlIdx = ops
      .map((op, i) => (op instanceof ControlGate ? i : -1))
      .filter((i) => i !== -1);
    const antiControlIdx = ops
      .map((op, i) => (op instanceof AntiControlGate ? i : -1))
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
    if (antiControlIdx.length > 0 && xIdx.length > 0) {
      for (const i of xIdx) {
        const xOp = ops[i];
        if (xOp && "antiControls" in xOp) {
          xOp.antiControls = antiControlIdx;
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
  /**
   * JSONやクリップボードに保存されたラベルから、対応するゲートを復元する。
   */
  static createOperationFromLabel(label: string): OperationComponent | null {
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
      case "P":
        return new PhaseGate();
      case "Rx":
        return new RxGate();
      case "Ry":
        return new RyGate();
      case "Rz":
        return new RzGate();
      case "QFT":
        return new QftGate();
      case "QFT†":
        return new QftDaggerGate();
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
      case "◦":
        return new AntiControlGate();
      case "Swap":
        return new SwapGate();
      case "Bloch":
        return new BlochSphere();
      default:
        console.warn(`Unknown operation label in JSON: ${label}. Skipping.`);
        return null;
    }
  }

  private static baseLabelFromResizableQftLabel(label: string): string {
    if (/^QFT†\d+$/.test(label)) {
      return "QFT†";
    }
    if (/^QFT\d+$/.test(label)) {
      return "QFT";
    }
    return label;
  }

  private static qftSpanFromLabel(label: string | null): number | null {
    if (label === null) {
      return null;
    }

    const match = label.match(/^QFT(?:†)?(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
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
    const antiControlDropzones =
      this.dropzoneList.filterByOperationType(AntiControlGate);
    const controllableDropzones = this.controllableDropzones();

    // コントロールゲートの初期化
    for (const dz of controllableDropzones) {
      if (isControllable(dz.operation)) {
        dz.operation.controls = [];
        dz.operation.antiControls = [];
      }
    }

    this.updateSwapConnections();
    this.updateQftConnections();

    if (
      controlDropzones.length + antiControlDropzones.length === 1 &&
      controllableDropzones.length === 0
    ) {
      return;
    }

    // コントロール線の接続を更新
    if (controlDropzones.length > 0 || antiControlDropzones.length > 0) {
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
    const antiControlDropzones =
      this.dropzoneList.filterByOperationType(AntiControlGate);
    const markerDropzones = controlDropzones.concat(antiControlDropzones);
    const controlBits = markerDropzones.map((dz) => this.qubitNumberOf(dz));
    for (const dz of markerDropzones) {
      dz.connectTop = controlBits.some((bit) => this.qubitNumberOf(dz) > bit);
      dz.connectBottom = controlBits.some(
        (bit) => this.qubitNumberOf(dz) < bit,
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

  /**
   * 隣接する QFT/QFT† を 1 つの縦長ゲートとして見せるため、接続線を更新する。
   */
  private updateQftConnections(): void {
    for (const dropzone of this.dropzones) {
      dropzone.qftConnectTop = false;
      dropzone.qftConnectBottom = false;
    }

    this.updateQftConnectionFor(QftGate);
    this.updateQftConnectionFor(QftDaggerGate);

    this.applyConnectionUpdates();
  }

  private updateQftConnectionFor(
    operationClass: typeof QftGate | typeof QftDaggerGate,
  ): void {
    for (const group of this.contiguousDropzoneGroups(operationClass)) {
      if (group.length < 2) {
        continue;
      }

      for (const dropzone of group) {
        const bit = this.qubitNumberOf(dropzone);
        const bits = group.map((each) => this.qubitNumberOf(each));
        dropzone.qftConnectTop = bits.some((each) => bit > each);
        dropzone.qftConnectBottom = bits.some((each) => bit < each);
      }
    }
  }

  private updateControlledUConnections(): void {
    const controllableDropzones = this.controllableDropzones();
    const controlDropzones =
      this.dropzoneList.filterByOperationType(ControlGate);
    const antiControlDropzones =
      this.dropzoneList.filterByOperationType(AntiControlGate);
    const allControlBits = controlDropzones.map((dz) => this.qubitNumberOf(dz));
    const allAntiControlBits = antiControlDropzones.map((dz) =>
      this.qubitNumberOf(dz),
    );

    const activeControlBits = allControlBits.concat(allAntiControlBits);
    const controllableBits = controllableDropzones.map((dz) =>
      this.qubitNumberOf(dz),
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
        each.operation.antiControls = allAntiControlBits;
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
        dropzone.swapConnectTop ||
        dropzone.controlConnectTop ||
        dropzone.qftConnectTop;
      dropzone.connectBottom =
        dropzone.swapConnectBottom ||
        dropzone.controlConnectBottom ||
        dropzone.qftConnectBottom;
    }
  }

  /**
   * 隣り合う同種 QFT ゲートを 1 操作にまとめて、span と targets を保存する。
   */
  private serializeQftOperations(
    operationClass: typeof QftGate | typeof QftDaggerGate,
  ): SerializedOperation[] {
    return this.contiguousDropzoneGroups(operationClass).map((group) => {
      const operation = group[0].operation;
      need(operation !== null, "operation is null");
      const targetBits = group.map((dropzone) => this.qubitNumberOf(dropzone));
      return operation.serialize(targetBits);
    });
  }

  private contiguousDropzoneGroups(
    operationClass: typeof QftGate | typeof QftDaggerGate,
  ): Dropzone[][] {
    const groups: Dropzone[][] = [];
    let currentGroup: Dropzone[] = [];

    for (const dropzone of this.dropzones) {
      if (dropzone.operation instanceof operationClass) {
        currentGroup.push(dropzone);
        continue;
      }

      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  private controllableDropzones(): Dropzone[] {
    return this.dropzoneList.occupied.filter((dropzone) =>
      isControllable(dropzone.operation),
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
    this.emit(CIRCUIT_STEP_EVENTS.HOVERED, this);
  }
}
