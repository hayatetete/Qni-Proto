import { Circuit } from "./circuit";
import { CircuitFrame } from "./circuit-frame";
import { CircuitStep } from "./circuit-step";
import { Colors } from "./colors";
import { Complex } from "@qni/common";
import { DropdownMenu } from "./dropdown-menu";
import { Dropzone } from "./dropzone";
import { FrameDivider } from "./frame-divider";
import { OperationComponent } from "./operation-component";
import { List } from "@pixi/ui";
import { MeasurementGate } from "./measurement-gate";
import { StateVectorComponent } from "./state-vector-component";
import { StateVectorFrame } from "./state-vector-frame";
import { OperationPalette } from "./operation-palette";
import { logger, rectIntersect } from "./util";
import {
  Application,
  Assets,
  FederatedPointerEvent,
  Point,
  Renderer,
} from "pixi.js";
import {
  CIRCUIT_STEP_EVENTS,
  FRAME_DIVIDER_EVENTS,
  OPERATION_EVENTS,
} from "./events";
import { STATE_VECTOR_EVENTS } from "./state-vector-events";
import { ShareModal } from "./share-modal";
import { setupAlgorithms, AlgorithmKey } from "./algorithms";

declare global {
  interface Window {
    pixiApp?: App;
  }
}

export class App {
  static elementId = "app";
  private static _instance: App;

  declare worker: Worker;

  element: HTMLElement;
  verticalFrameLayout!: List;
  circuitFrame!: CircuitFrame;
  stateVectorFrame!: StateVectorFrame;
  frameDivider!: FrameDivider;

  activeGate: OperationComponent | null = null;
  grabbedGate: OperationComponent | null = null;
  app: Application;
  circuitSteps: CircuitStep[] = [];
  nameMap = new Map();

  private shareModal: ShareModal | null = null;

  public static get instance(): App {
    if (!this._instance) {
      this._instance = new App(this.elementId);
    }

    // 自身が持つインスタンスを返す
    return this._instance;
  }

  get gatePalette(): OperationPalette {
    return this.circuitFrame!.operationPalette;
  }

  get circuit(): Circuit {
    return this.circuitFrame!.circuit;
  }

  get stateVector(): StateVectorComponent {
    return this.stateVectorFrame!.stateVector;
  }

  constructor(elementId: string) {
    window.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
      },
      { passive: false }
    );

    const el = document.getElementById(elementId);
    if (el === null) {
      throw new Error("Could not find #app");
    }
    this.element = el;

    const serviceWorkerUrl =
      import.meta.env.MODE === "production"
        ? "/service-worker.js"
        : "/dev-sw.js?dev-sw";
    this.worker = new Worker(serviceWorkerUrl, {
      type: import.meta.env.MODE === "production" ? "classic" : "module",
    });
    this.worker.addEventListener(
      "message",
      this.handleServiceWorkerMessage.bind(this)
    );

    // view, stage などをまとめた application を作成
    this.app = new Application<Renderer<HTMLCanvasElement>>();
    this.initApp().then(() => {
      window.addEventListener("resize", this.resize.bind(this), false);

      el.appendChild(this.app.canvas);

      this.setupStage();

      this.setupFrames();

      this.loadCircuitFromUrl();

      // 回路の最初のステップをアクティブにする
      // これによって、最初のステップの状態ベクトルが表示される
      this.circuit.fetchStep(0).activate();

      this.nameMap.set(this.app.stage, "stage");

      this.setupExportButton();

      new DropdownMenu();

      this.setupShareMenu();

      this.setupAlgorithms();

      this.setupClearCircuitButton();

      // テスト用
      window.pixiApp = this;
    });
  }

  private setupStage(): void {
    // stage: 画面に表示するオブジェクトたちの入れ物
    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.sortableChildren = true;
    this.app.stage
      .on("pointerup", this.releaseGate, this) // マウスでクリックを離した、タッチパネルでタッチを離した
      .on("pointerupoutside", this.releaseGate, this) // 描画オブジェクトの外側でクリック、タッチを離した
      .on("pointerdown", this.maybeDeactivateGate, this);
  }

  private setupExportButton(): void {
    const exportButton = document.getElementById("exportButton");
    if (!exportButton) {
      throw new Error("Could not find #exportButton");
    }
    exportButton.addEventListener("click", this.exportCircuit.bind(this));
  }

  private setupShareMenu(): void {
    const shareMenuItem = document.getElementById("menu-item-share");
    if (!shareMenuItem) {
      throw new Error("Could not find #menu-item-share");
    }
    shareMenuItem.addEventListener("click", async () => {
      if (!this.shareModal) {
        await this.loadShareModal();
        this.shareModal = new ShareModal(
          "share-modal",
          "close-share-modal-button"
        );
      }
      this.openShareModal();
    });
  }

  private setupAlgorithms(): void {
    setupAlgorithms((algorithm: AlgorithmKey, hash: string, title: string) => {

      logger.log(`Selected algorithm: ${algorithm}`);
      
      location.hash = hash;

      this.loadCircuitFromUrl();

      document.title = title;

      const titleInput = document.getElementById(
        "circuit-title-input"
      ) as HTMLInputElement | null;
      if (titleInput) {
        titleInput.value = title;
      }

      this.updateStateVectorComponentQubitCount();

      this.runSimulator();
    });
  }

  private setupClearCircuitButton(): void {
    const clearButton = document.getElementById("menu-item-clear-circuit");
    if (!clearButton) {
      throw new Error("Could not find #menu-item-clear-circuit");
    }
    clearButton.addEventListener("click", (e) => {
      e.preventDefault(); // ページ遷移防止

      this.circuit.fromJSON(JSON.stringify({ cols: [[]] }));
      this.circuit.fetchStep(0).activate();

      const titleInput = document.getElementById(
        "circuit-title-input"
      ) as HTMLInputElement | null;
      if (titleInput) titleInput.value = "";
      document.title = "Qni GL";

      history.replaceState("", "", location.pathname);

      this.updateStateVectorComponentQubitCount();
      this.runSimulator();

      // ドロップダウンメニューを閉じる
      const menuDropdown = document.getElementById("menu-dropdown");
      if (menuDropdown) {
        menuDropdown.classList.add("hidden");

        const menuButton = document.querySelector(
          "[aria-controls='menu-dropdown']"
        );
        if (menuButton) {
          menuButton.classList.remove("activeClass");
          menuButton.setAttribute("aria-expanded", "false");
        }
      }
    });
  }

  private openShareModal(): void {
    const titleInput = document.getElementById(
      "circuit-title-input"
    ) as HTMLInputElement | null;
    if (titleInput && location.hash.startsWith("#circuit=")) {
      try {
        const circuitData = JSON.parse(
          location.hash.substring("#circuit=".length)
        );
        if (circuitData.title) {
          titleInput.value = circuitData.title;
          document.title = circuitData.title;
        }
      } catch {
        // パース失敗時は何もしない
      }
    }
    this.shareModal?.open();
  }

  /**
   * ShareモーダルのHTMLを動的に読み込む
   */
  private async loadShareModal(): Promise<void> {
    try {
      const response = await fetch("/share-modal.html");
      if (!response.ok) {
        throw new Error(
          `Failed to load share-modal.html: ${response.statusText}`
        );
      }
      const html = await response.text();
      const container = document.getElementById("share-modal-container");
      if (container) {
        container.innerHTML = html;
      }
    } catch (error) {
      console.error("Error loading share modal:", error);
    }
  }

  private setupFrames() {
    this.verticalFrameLayout = new List({
      type: "vertical",
    });
    this.app.stage.addChild(this.verticalFrameLayout);

    this.circuitFrame = CircuitFrame.initialize(
      this.app.screen.width,
      this.app.screen.height * 0.6
    );
    this.verticalFrameLayout.addChild(this.circuitFrame);

    this.stateVectorFrame = StateVectorFrame.initialize(
      this.app.screen.width,
      this.app.screen.height * 0.4
    );
    this.verticalFrameLayout.addChild(this.stateVectorFrame);

    this.frameDivider = FrameDivider.initialize({
      width: this.app.screen.width,
      initialY: this.circuitFrame.height,
    });
    this.app.stage.addChild(this.frameDivider);

    this.setupFrameDividerEventHandlers();
    this.setupCircuitFrameEventHandlers();
    this.setupStateVectorEventHandlers();
  }

  private setupFrameDividerEventHandlers() {
    this.frameDivider.on(
      FRAME_DIVIDER_EVENTS.DRAG_STARTED,
      this.startFrameDividerDragging,
      this
    );
    this.app.stage.on("pointermove", this.maybeUpdateFrames, this);
    this.app.stage.on("pointerup", this.endFrameDividerDragging, this);
    this.app.stage.on("pointerupoutside", this.endFrameDividerDragging, this);
  }

  private startFrameDividerDragging() {
    this.circuitFrame.cursor = "ns-resize";
    this.stateVectorFrame.cursor = "ns-resize";
  }

  private maybeUpdateFrames(event: FederatedPointerEvent) {
    if (!this.frameDivider.isDragging) return;

    this.frameDivider.move(event.global.y, this.app.screen.height);

    // 上下フレームの更新
    this.circuitFrame.resize(this.app.screen.width, this.frameDivider.y);
    this.stateVectorFrame.repositionAndResize(
      this.frameDivider.y + this.frameDivider.height,
      this.app.screen.width,
      this.app.screen.height - this.frameDivider.y
    );
  }

  private endFrameDividerDragging() {
    this.frameDivider.endDragging();
    this.circuitFrame.cursor = "default";
    this.stateVectorFrame.cursor = "default";
  }

  private setupCircuitFrameEventHandlers() {
    this.circuitFrame.on(OPERATION_EVENTS.GRABBED, this.grabGate, this);
    this.circuitFrame.on(OPERATION_EVENTS.MOUSE_LEFT, this.resetCursor, this);
    this.circuitFrame.on(OPERATION_EVENTS.DISCARDED, this.gateDiscarded, this);

    this.circuitFrame.on(
      CIRCUIT_STEP_EVENTS.ACTIVATED,
      this.runSimulator,
      this
    );
    this.circuitFrame.circuit.on(
      OPERATION_EVENTS.SNAPPED,
      this.handleCircuitChange,
      this
    );
  }

  private setupStateVectorEventHandlers() {
    this.stateVector.on(
      STATE_VECTOR_EVENTS.VISIBLE_QUBIT_CIRCLES_CHANGED,
      this.runSimulator,
      this
    );
  }

  private async initApp() {
    await this.app.init({
      resizeTo: window,
      resolution: window.devicePixelRatio,
      preference: "webgpu",
      antialias: true,
      autoDensity: true,
      backgroundColor: Colors["bg"],
      preserveDrawingBuffer: true,
    });

    await Assets.init({
      texturePreference: { resolution: window.devicePixelRatio },
    });
  }

  private gateDiscarded(gate: OperationComponent) {
    this.activeGate = null;
    this.grabbedGate = null;
    this.circuitFrame!.removeChild(gate);
    this.circuit.update();
    if (this.circuit.activeStepIndex === null) {
      this.circuit.fetchStep(0).activate();
    }
    this.updateStateVectorComponentQubitCount();
    this.runSimulator();
  }

  protected handleServiceWorkerMessage(event: MessageEvent): void {
    if (!this.stateVector) {
      return;
    }

    const stepIndex = event.data.step;
    const step = this.circuit.fetchStep(stepIndex);

    if (event.data.measuredBits) {
      for (const [bit, value] of Object.entries(event.data.measuredBits)) {
        // もし value が '' | 0 | 1 でない場合はエラー
        if (value !== "" && value !== 0 && value !== 1) {
          throw new Error("value is not '' | 0 | 1");
        }

        const qubitCount = this.circuit.highestOccupiedQubitNumber;
        const dropzone = step.fetchDropzone(parseInt(bit));
        const measurementGate = dropzone.operation;

        if (measurementGate) {
          if (!(measurementGate instanceof MeasurementGate)) {
            console.log(`target_bit: ${qubitCount - parseInt(bit) - 1}`);
            console.log(event.data);
            throw new Error(`${measurementGate} is not MeasurementGate`);
          }
          measurementGate.value = value;
        }
      }
    }

    const amplitudes = event.data.amplitudes;
    if (amplitudes) {
      this.updateStateVectorAmplitudes(amplitudes);
    }

    // ページの <div id="app" data-state="running"></div> を
    // <div id="app" data-state="idle"></div> に変更
    const eventType = event.data.type;
    if (eventType === "finish") {
      this.element.dataset.state = "idle";
    }
  }

  private updateStateVectorAmplitudes(amplitudes: {
    [key: number]: [number, number];
  }) {
    for (const [index, [real, imag]] of Object.entries(amplitudes)) {
      const qubitCircle = this.stateVector.qubitCircleAt(parseInt(index));

      if (qubitCircle) {
        const amplitude = new Complex(real, imag);
        qubitCircle.probability = Math.pow(amplitude.abs(), 2) * 100;
        qubitCircle.phase = amplitude.phase();
      }
    }
  }

  get screenWidth(): number {
    return this.app.screen.width;
  }

  get screenHeight(): number {
    return this.app.screen.height;
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.app.renderer.resize(width, height);

    this.frameDivider.updateWidth(this.app.screen.width);

    this.stateVectorFrame.repositionAndResize(
      this.frameDivider.y + this.frameDivider.height,
      this.app.screen.width,
      this.app.screen.height - this.frameDivider.y
    );
  }

  private grabGate(gate: OperationComponent, pointerPosition: Point) {
    if (this.activeGate !== null && this.activeGate !== gate) {
      this.activeGate.deactivate();
    }

    // the reason for this is because of multitouch
    // we want to track the movement of this particular touch
    this.activeGate = gate;
    this.grabbedGate = gate;
    gate.insertable = false;

    this.grabbedGate.on(OPERATION_EVENTS.DISCARDED, (gate) => {
      this.activeGate = null;
      this.grabbedGate = null;
      this.circuitFrame!.removeChild(gate);
      // this.pixiApp.stage.removeChild(gate);
    });

    // this.dropzones についてループを回す
    // その中で、dropzone が snappable かどうかを判定する
    let dropzone;

    this.circuit.maybeAppendWire();

    this.updateStateVectorComponentQubitCount();

    for (const circuitStep of this.circuit.steps) {
      for (const each of circuitStep.dropzones) {
        if (
          this.isSnappable(
            gate,
            pointerPosition.x,
            pointerPosition.y,
            gate.width,
            gate.height,
            each
          )
        ) {
          dropzone = each;
          this.grabbedGate.click(pointerPosition, each);
        }
      }
    }

    if (dropzone) {
      dropzone.addChild(gate);
    } else {
      this.grabbedGate.click(pointerPosition, null);
    }

    // TODO: メソッド化
    this.app.stage.cursor = "grabbing";

    this.app.stage.on("pointermove", this.maybeMoveGate, this);
  }

  /**
   * 指定したゲートがドロップゾーンにスナップできるかどうかを返す。
   *
   *        x+size/4+((1-snapRatio)*size)/2,
   *        y+size/4+((1-snapRatio)*size)/2
   *                  │
   *        x+size/4  │
   *              │   │
   *     x,y      ▼   │
   *       ┌──────┬───┼──────────────────────────┬──────┐  ┬
   *       │      │   ▼                          │      │  │
   *       │      │   ┏━━━━━━━━━━━━━━━━━━━━━━━┓  │      │  │
   *       │      │   ┃                       ┃  │      │  │
   *       │      │   ┃                       ┃  │      │  │
   *       │      │   ┃                       ┃  │      │  │
   *       │      │   ┃       snapzone        ┃  │      │  │  size
   *       │      │   ┃                       ┃  │      │  │
   *       │      │   ┃                       ┃  │      │  │
   *       │      │   ┃                       ┃  │      │  │
   *       │      │   ┃                       ┃  │      │  │
   *       │      │   ┗━━━━━━━━━━━━━━━━━━━━━━━┛  │      │  │
   *       │      │                              │      │  │
   *       └──────┴──────────────────────────────┴──────┘  ┴
   *
   *              ├──────────────────────────────┤
   *                            size
   *
   * @param gateCenterX ゲート中心の x 座標
   * @param gateCenterY ゲート中心の y 座標
   * @param gateWidth ゲートの幅
   * @param gateHeight ゲートの高さ
   */
  private isSnappable(
    gate: OperationComponent,
    gateCenterX: number,
    gateCenterY: number,
    gateWidth: number,
    gateHeight: number,
    dropzone: Dropzone
  ) {
    if (dropzone.operation !== null && dropzone.operation !== gate) {
      return false;
    }

    const snapRatio = 0.5;
    const gateX = gateCenterX - gateWidth / 2;
    const gateY = gateCenterY - gateHeight / 2;
    const dropzonePosition = dropzone.getGlobalPosition();

    const snapzoneX =
      dropzonePosition.x +
      dropzone.gateSize / 4 +
      ((1 - snapRatio) * dropzone.gateSize) / 2;
    const snapzoneY =
      dropzonePosition.y + ((1 - snapRatio) * dropzone.gateSize * 1.5) / 2;
    const snapzoneWidth = dropzone.gateSize * snapRatio;
    const snapzoneHeight = dropzone.gateSize * snapRatio;

    return rectIntersect(
      gateX,
      gateY,
      gateWidth,
      gateHeight,
      snapzoneX,
      snapzoneY,
      snapzoneWidth,
      snapzoneHeight
    );
  }

  private isGateHoveringAtLeftInsertPosition(
    gateCenterX: number,
    gateCenterY: number,
    gateWidth: number,
    gateHeight: number,
    dropzone: Dropzone
  ): boolean {
    const snapRatio = 0.5;
    const gateX = gateCenterX - gateWidth / 2;
    const gateY = gateCenterY - gateHeight / 2;
    const dropzonePosition = dropzone.getGlobalPosition();

    const snapzoneX =
      dropzonePosition.x +
      dropzone.gateSize / 4 +
      ((1 - snapRatio) * dropzone.gateSize) / 2 -
      dropzone.width / 2;
    const snapzoneY =
      dropzonePosition.y + ((1 - snapRatio) * dropzone.gateSize * 1.5) / 2;
    const snapzoneWidth = dropzone.gateSize * snapRatio;
    const snapzoneHeight = dropzone.gateSize * snapRatio;

    return rectIntersect(
      gateX,
      gateY,
      gateWidth,
      gateHeight,
      snapzoneX,
      snapzoneY,
      snapzoneWidth,
      snapzoneHeight
    );
  }

  private isGateHoveringAtRightInsertPosition(
    gateCenterX: number,
    gateCenterY: number,
    gateWidth: number,
    gateHeight: number,
    dropzone: Dropzone
  ): boolean {
    const snapRatio = 0.5;
    const gateX = gateCenterX - gateWidth / 2;
    const gateY = gateCenterY - gateHeight / 2;
    const dropzonePosition = dropzone.getGlobalPosition();

    const snapzoneX =
      dropzonePosition.x +
      dropzone.gateSize / 4 +
      ((1 - snapRatio) * dropzone.gateSize) / 2 +
      dropzone.width / 2;
    const snapzoneY =
      dropzonePosition.y + ((1 - snapRatio) * dropzone.gateSize * 1.5) / 2;
    const snapzoneWidth = dropzone.gateSize * snapRatio;
    const snapzoneHeight = dropzone.gateSize * snapRatio;

    return rectIntersect(
      gateX,
      gateY,
      gateWidth,
      gateHeight,
      snapzoneX,
      snapzoneY,
      snapzoneWidth,
      snapzoneHeight
    );
  }

  private maybeMoveGate(event: FederatedPointerEvent) {
    if (this.grabbedGate === null) {
      return;
    }

    this.moveGate(this.grabbedGate, event.global);
  }

  /**
   * pointerPosition is the global position of the mouse/touch
   *
   * @param gate ゲート
   * @param pointerPosition マウス/タッチの位置
   */
  private moveGate(gate: OperationComponent, pointerPosition: Point) {
    let snapDropzone: Dropzone | null = null;
    let insertablePosition: Point | null = null;
    let insertStepPosition = 0;
    let insertedOperationQubitIndex = 0;

    for (let index = 0; index < this.circuit.steps.length; index++) {
      const circuitStep = this.circuit.steps[index];

      for (
        let qubitIndex = 0;
        qubitIndex < circuitStep.dropzones.length;
        qubitIndex++
      ) {
        const dropzone = circuitStep.dropzones[qubitIndex];
        let isSnappable = this.isSnappable(
          gate,
          pointerPosition.x,
          pointerPosition.y,
          gate.width,
          gate.height,
          dropzone
        );
        const isGateInsertableLeft = this.isGateHoveringAtLeftInsertPosition(
          pointerPosition.x,
          pointerPosition.y,
          gate.width,
          gate.height,
          dropzone
        );
        const isGateInsertableRight = this.isGateHoveringAtRightInsertPosition(
          pointerPosition.x,
          pointerPosition.y,
          gate.width,
          gate.height,
          dropzone
        );

        if (isSnappable || isGateInsertableLeft || isGateInsertableRight) {
          const snappablePosition = isSnappable
            ? new Point(
                dropzone.getGlobalPosition().x + dropzone.width / 2,
                dropzone.getGlobalPosition().y + dropzone.height / 2
              )
            : null;
          const leftInsertablePosition = isGateInsertableLeft
            ? new Point(
                dropzone.getGlobalPosition().x,
                dropzone.getGlobalPosition().y + dropzone.height / 2
              )
            : null;
          const rightInsertablePosition = isGateInsertableRight
            ? new Point(
                dropzone.getGlobalPosition().x + dropzone.width,
                dropzone.getGlobalPosition().y + dropzone.height / 2
              )
            : null;

          if (leftInsertablePosition) {
            insertStepPosition = index;
          }
          if (rightInsertablePosition) {
            insertStepPosition = index + 1;
          }

          const snappableDistance = snappablePosition
            ? Math.sqrt(
                Math.pow(pointerPosition.x - snappablePosition.x, 2) +
                  Math.pow(pointerPosition.y - snappablePosition.y, 2)
              )
            : Infinity;
          const leftInsertableDistance = leftInsertablePosition
            ? Math.sqrt(
                Math.pow(pointerPosition.x - leftInsertablePosition.x, 2) +
                  Math.pow(pointerPosition.y - leftInsertablePosition.y, 2)
              )
            : Infinity;
          const rightInsertableDistance = rightInsertablePosition
            ? Math.sqrt(
                Math.pow(pointerPosition.x - rightInsertablePosition.x, 2) +
                  Math.pow(pointerPosition.y - rightInsertablePosition.y, 2)
              )
            : Infinity;

          if (
            snappableDistance < leftInsertableDistance &&
            snappableDistance < rightInsertableDistance
          ) {
            snapDropzone = dropzone;
          } else if (leftInsertableDistance < rightInsertableDistance) {
            isSnappable = false;
            insertablePosition = leftInsertablePosition;
            insertedOperationQubitIndex = qubitIndex;
          } else {
            isSnappable = false;
            insertablePosition = rightInsertablePosition;
            insertedOperationQubitIndex = qubitIndex;
          }
        }

        if (isSnappable) {
          snapDropzone = dropzone;
          gate.snapToDropzone(dropzone, pointerPosition);
        }
      }
    }

    if (
      snapDropzone &&
      (gate.dropzone === null || gate.dropzone !== snapDropzone)
    ) {
      gate.snap(snapDropzone);
      this.updateStateVectorComponentQubitCount();
    }

    if (gate.dropzone && !snapDropzone) {
      this.unsnapGateFromDropzone(gate);
    }

    if (snapDropzone) {
      gate.insertable = false;
      gate.insertStepPosition = null;
      snapDropzone.addChild(gate);
    } else if (insertablePosition !== null) {
      gate.insertable = true;
      if (
        gate.insertStepPosition !== insertStepPosition ||
        gate.insertQubitIndex !== insertedOperationQubitIndex
      ) {
        gate.insertStepPosition = insertStepPosition;
        gate.insertQubitIndex = insertedOperationQubitIndex;
        gate.emit(OPERATION_EVENTS.SNAPPED, gate, null);
        this.circuit.redrawDropzoneInputAndOutputWires();
        this.circuit.updateConnections();
      }
      gate.move(insertablePosition);
    } else {
      gate.insertable = false;
      gate.move(pointerPosition);
    }
  }

  private unsnapGateFromDropzone(gate: OperationComponent) {
    gate.unsnap();
    this.circuitFrame!.addChild(gate);
    // this.pixiApp.stage.addChild(gate);
  }

  private releaseGate() {
    if (this.grabbedGate === null) {
      return;
    }

    if (this.grabbedGate.insertable) {
      const insertedStep = this.circuit.insertStepAt(
        this.grabbedGate.insertStepPosition!
      );
      // dropzone.on(DROPZONE_EVENTS.OPERATION_SNAPPED, this.onDropzoneSnap, this);
      this.grabbedGate.position.set(8, 8);
      this.grabbedGate.insert(
        insertedStep.fetchDropzone(this.grabbedGate.insertQubitIndex!)
      );
    }

    // TODO: 以下の this.circuit... 以下と同様の粒度にする (関数に切り分ける)
    this.resetCursor();
    this.app.stage.off("pointermove", this.maybeMoveGate);
    this.grabbedGate.mouseUp();
    this.grabbedGate = null;

    this.circuit.update();

    this.updateUrlWithCircuit();

    this.updateStateVectorComponentQubitCount();
    this.stateVectorFrame.repositionAndResize(
      this.frameDivider.y + this.frameDivider.height,
      this.app.screen.width,
      this.app.screen.height - this.frameDivider.y
    );
    this.runSimulator();
  }

  private resetCursor() {
    this.app.stage.cursor = "default";
  }

  private updateStateVectorComponentQubitCount() {
    this.stateVector.qubitCount = this.circuit.highestOccupiedQubitNumber;
  }

  private maybeDeactivateGate(event: FederatedPointerEvent) {
    if (event.target === this.app.stage) {
      this.activeGate?.deactivate();
    }
  }

  protected runSimulator() {
    this.setAppStateToRunning();
    this.postMessageToWorker();
  }

  private setAppStateToRunning() {
    // ページの <div id="app"></div> を
    // <div id="app" data-state="running"></div> に変更
    this.element.dataset.state = "running";

    logger.log(this.circuit.toString());
  }

  private postMessageToWorker(requestType: string = "circuit") {
    this.worker.postMessage({
      circuitJson: this.circuit.toJSON(),
      qubitCount: this.circuit.highestOccupiedQubitNumber,
      untilStepIndex: this.circuit.activeStepIndex,
      amplitudeIndices: this.stateVector.visibleQubitCircleIndices,
      steps: this.circuit.serialize(),
      requestType: requestType,
    });
  }

  private async exportCircuit() {
    this.setAppStateToRunning();
    this.postMessageToWorker("export");

    this.worker.addEventListener("message", (event) => {
      if (event.data.type === "export") {
        const qasm3 = event.data.qasm3;
        this.downloadQasm3File(qasm3);
      }
    });
  }

  private downloadQasm3File(qasm3: string) {
    const blob = new Blob([qasm3], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "circuit.qasm";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // 量子回路変更時に呼び出されるハンドラ
  private handleCircuitChange() {
    this.updateUrlWithCircuit();
  }

  /**
   * 量子回路の状態をURLにエンコードする
   */
  public updateUrlWithCircuit(): void {
  // タイトル取得
  const titleInput = document.getElementById(
    "circuit-title-input"
  ) as HTMLInputElement | null;
  const title = titleInput?.value || "";

    const circuitObj = JSON.parse(this.circuit.toJSON());
    // titleを追加
    if (title) {
      circuitObj.title = title;
    }
    const newHash = `#circuit=${JSON.stringify(circuitObj)}`;
    history.replaceState("", "", location.pathname + newHash);
  }

  /**
   * URLのパスから量子回路の状態をデコードしロードする
   */
  private loadCircuitFromUrl(): void {
    // URLハッシュに回路データがあるか確認 (#circuit=...)
    const sourceString = location.hash.startsWith("#circuit=")
      ? location.hash.substring("#circuit=".length)
      : null;
    if (!sourceString) return;

    // 回路データをデコードしてロード
    const circuitJsonString = decodeURIComponent(sourceString);
    const circuitData = JSON.parse(circuitJsonString);

    // タイトルがあれば反映
    if (circuitData.title) {
      document.title = circuitData.title;
      const titleInput = document.getElementById(
        "circuit-title-input"
      ) as HTMLInputElement | null;
      if (titleInput) {
        titleInput.value = circuitData.title;
      }
    } else {
      document.title = "Qni GL";
    }

    // 回路データだけで復元
    this.circuit.fromJSON(JSON.stringify({ cols: circuitData.cols }));
  }
}
