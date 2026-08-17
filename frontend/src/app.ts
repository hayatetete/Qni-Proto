import { Circuit } from "./circuit";
import { BlochSphere } from "./bloch-sphere";
import { CircuitFrame } from "./circuit-frame";
import { CircuitStep } from "./circuit-step";
import { Colors } from "./colors";
import { Dropzone } from "./dropzone";
import { FrameDivider } from "./frame-divider";
import { OperationComponent } from "./operation-component";
import { List } from "@pixi/ui";
import { MeasurementGate } from "./measurement-gate";
import { StateVectorComponent } from "./state-vector-component";
import { StateVectorFrame } from "./state-vector-frame";
import { StateVectorAspectIndex } from "./state-vector-layout";
import type { JupyterViewMode } from "./jupyter-bridge";
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
import { setupQuriCodeExportDialog } from "./quri-code-export-dialog";
import { QubitCount } from "./types";
import SimulatorWorker from "./service-worker.js?worker";

declare global {
  interface Window {
    pixiApp?: App;
  }
}

export class App {
  static elementId = "app";
  private static _instance: App;
  private static readonly JUPYTER_TOOLBAR_HEIGHT = 45;
  private static readonly JUPYTER_CODE_PANEL_HEADER_HEIGHT = 52;
  private static readonly JUPYTER_STATE_PANEL_HEADER_HEIGHT = 88;
  private static readonly JUPYTER_VIEWPORT_DEFAULT_HEIGHT = 480;
  private static readonly JUPYTER_VIEWPORT_MIN_HEIGHT = 260;
  private static readonly JUPYTER_VIEWPORT_MAX_HEIGHT = 720;
  private static readonly JUPYTER_SIDE_PANEL_DEFAULT_WIDTH = 260;
  private static readonly JUPYTER_SIDE_PANEL_MIN_WIDTH = 56;
  private static readonly JUPYTER_EDGE_RESERVE = 50;
  private static readonly JUPYTER_CIRCUIT_MIN_WIDTH = 50;
  private static readonly JUPYTER_PALETTE_RIGHT_CLEARANCE = 24;

  declare worker: Worker;

  element: HTMLElement;
  verticalFrameLayout!: List;
  circuitFrame!: CircuitFrame;
  stateVectorFrame!: StateVectorFrame;
  frameDivider!: FrameDivider;

  activeGate: OperationComponent | null = null;
  grabbedGate: OperationComponent | null = null;
  app: Application;
  initialized: Promise<void>;
  circuitSteps: CircuitStep[] = [];
  nameMap = new Map();

  private shareModal: ShareModal | null = null;
  private resolveInitialized!: () => void;
  private readonly isJupyterEntry = location.pathname.endsWith("jupyter.html");
  private jupyterSidePanelWidthOverride: number | null = null;
  private jupyterViewportHeightOverride: number | null = null;
  private jupyterRightPane: "code" | "state-vector" = "state-vector";
  private jupyterViewMode: JupyterViewMode = "notebook";
  private jupyterReadOnly = false;
  private simulationRequestId = 0;
  private jupyterZoom = 1;
  private jupyterRenderedZoom = 1;
  private readonly jupyterZoomMin = 0.5;
  private readonly jupyterZoomMax = 3;
  private jupyterZoomFrame: number | null = null;
  private jupyterActivePointers = new Map<number, Point>();
  private jupyterLastPinchDistance: number | null = null;

  public static get instance(): App {
    if (!this._instance) {
      this._instance = new App(this.elementId);
    }

    // 自身が持つインスタンスを返す
    return this._instance;
  }

  public get isJupyterReadOnly(): boolean {
    return this.jupyterReadOnly;
  }

  public shouldConsumeJupyterWheel(clientX: number): boolean {
    return (
      this.isJupyterEntry &&
      clientX < this.circuitFrame.width &&
      this.circuitFrame.hasScrollableContent()
    );
  }

  public setJupyterViewportHeight(height: number): void {
    if (!this.isJupyterEntry || !Number.isFinite(height)) {
      return;
    }
    this.jupyterViewportHeightOverride = Math.min(
      1200,
      Math.max(160, Math.round(height)),
    );
    this.applyJupyterViewportHeight(this.jupyterViewportHeightOverride);
    this.app.renderer.resize(
      this.jupyterRenderSurfaceWidth(),
      this.jupyterViewportHeightOverride,
    );
    this.applyJupyterFrameLayout();
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
    if (!this.isJupyterEntry) {
      window.addEventListener(
        "wheel",
        (event) => {
          event.preventDefault();
        },
        { passive: false },
      );
    }

    const el = document.getElementById(elementId);
    if (el === null) {
      throw new Error("Could not find #app");
    }
    this.element = el;
    this.initialized = new Promise((resolve) => {
      this.resolveInitialized = resolve;
    });

    this.worker = new SimulatorWorker();
    this.worker.addEventListener(
      "message",
      this.handleServiceWorkerMessage.bind(this),
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

      if (document.getElementById("exportQuriCodeButton")) {
        setupQuriCodeExportDialog({
          buttonId: "exportQuriCodeButton",
          getSteps: () => this.circuit.serialize(),
          getQubitCount: () => this.circuit.highestOccupiedQubitNumber,
          enableNotebookCell: this.isJupyterEntry,
        });
      }

      this.setupShareMenu();

      this.setupAlgorithms();

      this.setupClearCircuitButton();

      this.setupJupyterZoom();

      // テスト用
      window.pixiApp = this;
      this.resolveInitialized();
    });
  }

  /**
   * Jupyterなど外部入口から渡された回路JSONを、通常のURL復元と同じ経路で読み込む。
   */
  public loadCircuitJson(circuitJson: {
    cols: unknown[][];
    qubitCount?: number;
    title?: string;
    activeStepIndex?: number;
    editable?: boolean;
  }): void {
    this.jupyterReadOnly = circuitJson.editable === false;
    this.circuit.fromJSON(JSON.stringify({ cols: circuitJson.cols }));
    const activeStepIndex = Math.min(
      Math.max(0, circuitJson.activeStepIndex ?? 0),
      Math.max(0, this.circuit.steps.length - 1),
    );
    this.circuit.fetchStep(activeStepIndex).activate();

    if (circuitJson.title) {
      document.title = circuitJson.title;
      const titleInput = document.getElementById(
        "circuit-title-input",
      ) as HTMLInputElement | null;
      if (titleInput) {
        titleInput.value = circuitJson.title;
      }
    }

    this.updateUrlWithCircuit();
    if (circuitJson.qubitCount !== undefined) {
      this.stateVector.qubitCount = circuitJson.qubitCount as QubitCount;
    } else {
      this.updateStateVectorComponentQubitCount();
    }
    if (this.jupyterViewMode === "circuit") {
      this.circuit.compactForPresentation();
      this.circuit.setPresentationMode(true);
    } else {
      this.circuit.setPresentationMode(false);
    }
    this.applyJupyterFrameLayout();
    this.runSimulator();
    this.scheduleJupyterViewerResize();
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
      if (this.isJupyterEntry) {
        return;
      }
      throw new Error("Could not find #exportButton");
    }
    exportButton.addEventListener("click", this.exportCircuit.bind(this));
  }

  private setupShareMenu(): void {
    const shareMenuItem = document.getElementById("menu-item-share");
    if (!shareMenuItem) {
      if (this.isJupyterEntry) {
        return;
      }
      throw new Error("Could not find #menu-item-share");
    }
    shareMenuItem.addEventListener("click", async () => {
      if (!this.shareModal) {
        await this.loadShareModal();
        this.shareModal = new ShareModal(
          "share-modal",
          "close-share-modal-button",
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
        "circuit-title-input",
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
      if (this.isJupyterEntry) {
        return;
      }
      throw new Error("Could not find #menu-item-clear-circuit");
    }
    clearButton.addEventListener("click", (e) => {
      e.preventDefault(); // ページ遷移防止

      this.circuit.fromJSON(JSON.stringify({ cols: [[]] }));
      this.circuit.fetchStep(0).activate();

      const titleInput = document.getElementById(
        "circuit-title-input",
      ) as HTMLInputElement | null;
      if (titleInput) titleInput.value = "";
      document.title = "Qni GL";

      history.replaceState("", "", location.pathname);

      this.updateStateVectorComponentQubitCount();
      this.runSimulator();
    });
  }

  private openShareModal(): void {
    const titleInput = document.getElementById(
      "circuit-title-input",
    ) as HTMLInputElement | null;
    if (titleInput && location.hash.startsWith("#circuit=")) {
      try {
        const circuitData = JSON.parse(
          location.hash.substring("#circuit=".length),
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
      const shareModalUrl = new URL("share-modal.html", document.baseURI);
      const response = await fetch(shareModalUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to load share-modal.html: ${response.statusText}`,
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
    if (this.isJupyterEntry) {
      this.setupJupyterFrames();
      return;
    }

    this.verticalFrameLayout = new List({
      type: "vertical",
    });
    this.app.stage.addChild(this.verticalFrameLayout);

    this.circuitFrame = CircuitFrame.initialize(
      this.app.screen.width,
      this.app.screen.height * 0.6,
    );
    this.verticalFrameLayout.addChild(this.circuitFrame);

    this.stateVectorFrame = StateVectorFrame.initialize(
      this.app.screen.width,
      this.app.screen.height * 0.4,
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

  /**
   * Notebookセル向けに、左をパレット/回路、右を状態ベクトル用の領域として配置する。
   */
  private setupJupyterFrames(): void {
    this.circuitFrame = CircuitFrame.initialize(
      this.jupyterCircuitFrameWidth(),
      this.app.screen.height,
    );
    this.app.stage.addChild(this.circuitFrame);

    this.stateVectorFrame = StateVectorFrame.initialize(
      this.jupyterSidePanelWidth(),
      this.jupyterSidePanelContentHeight(),
    );
    this.stateVectorFrame.pinContentToTopLeft();
    this.app.stage.addChild(this.stateVectorFrame);

    this.frameDivider = FrameDivider.initialize({
      width: 0,
      initialY: 0,
    });
    this.frameDivider.visible = false;
    this.app.stage.addChild(this.frameDivider);

    this.applyJupyterFrameLayout();
    this.setupCircuitFrameEventHandlers();
    this.setupStateVectorEventHandlers();
  }

  /**
   * Jupyter専用の右ペイン幅を、セル幅に合わせて無理なく収まる範囲で計算する。
   */
  private jupyterSidePanelWidth(): number {
    if (this.jupyterViewMode === "circuit") {
      return 0;
    }

    const maxWidth = this.jupyterSidePanelMaxWidth();

    if (this.jupyterSidePanelWidthOverride !== null) {
      return Math.min(maxWidth, this.jupyterSidePanelWidthOverride);
    }

    return Math.min(
      maxWidth,
      Math.max(
        App.JUPYTER_SIDE_PANEL_MIN_WIDTH,
        App.JUPYTER_SIDE_PANEL_DEFAULT_WIDTH,
      ),
    );
  }

  /**
   * 右ペインはVSCodeの左右ペイン幅に左右されず、右端近くまで伸縮できる。
   */
  private jupyterSidePanelMaxWidth(): number {
    if (this.jupyterViewMode === "circuit") {
      return 0;
    }

    const visibleWidth = this.jupyterVisibleWidth();
    return Math.max(
      App.JUPYTER_SIDE_PANEL_MIN_WIDTH,
      visibleWidth - App.JUPYTER_EDGE_RESERVE,
    );
  }

  /**
   * Jupyter専用レイアウトで、左側の回路描画に使える幅を返す。
   */
  private jupyterCircuitFrameWidth(): number {
    if (this.jupyterViewMode === "circuit") {
      return this.jupyterVisibleWidth();
    }

    return Math.max(
      App.JUPYTER_CIRCUIT_MIN_WIDTH,
      this.jupyterVisibleWidth() - this.jupyterSidePanelWidth(),
    );
  }

  private jupyterPaletteNaturalRightEdge(): number {
    return (
      this.circuitFrame?.paletteNaturalRightEdge() ??
      App.JUPYTER_CIRCUIT_MIN_WIDTH
    );
  }

  private jupyterPaletteReservedRightEdge(): number {
    if (this.jupyterViewMode === "circuit") {
      return App.JUPYTER_CIRCUIT_MIN_WIDTH;
    }

    return (
      this.jupyterPaletteNaturalRightEdge() +
      App.JUPYTER_PALETTE_RIGHT_CLEARANCE
    );
  }

  private jupyterVisibleWidth(): number {
    return window.innerWidth;
  }

  private jupyterRenderSurfaceWidth(): number {
    if (!this.isJupyterEntry || this.jupyterViewMode !== "notebook") {
      return this.jupyterVisibleWidth();
    }

    return Math.max(
      this.jupyterVisibleWidth(),
      this.jupyterPaletteReservedRightEdge(),
    );
  }

  /**
   * 右ペイン内でタブ見出しを除いた、状態ベクトル表示に使える高さを返す。
   */
  private jupyterSidePanelContentHeight(): number {
    if (this.jupyterViewMode === "circuit") {
      return 0;
    }

    return Math.max(
      140,
      this.app.screen.height -
        this.jupyterToolbarHeight() -
        this.jupyterSidePanelHeaderHeight(),
    );
  }

  private jupyterToolbarHeight(): number {
    return this.jupyterViewMode === "notebook"
      ? App.JUPYTER_TOOLBAR_HEIGHT
      : 0;
  }

  /**
   * 右ペインのタブ状態に合わせて、状態ベクトル表示開始位置に必要なヘッダー高さを返す。
   */
  private jupyterSidePanelHeaderHeight(): number {
    if (this.jupyterViewMode === "circuit") {
      return 0;
    }

    return this.jupyterRightPane === "code"
      ? App.JUPYTER_CODE_PANEL_HEADER_HEIGHT
      : App.JUPYTER_STATE_PANEL_HEADER_HEIGHT;
  }

  /**
   * Jupyter専用の左右分割サイズをPixiフレームとDOMパネルへ同期する。
   */
  private applyJupyterFrameLayout(): void {
    this.applyJupyterDomChrome();
    const readOnlyMode =
      this.jupyterReadOnly ||
      this.jupyterViewMode === "state" ||
      this.jupyterViewMode === "circuit";
    this.circuitFrame.setPaletteVisible(!readOnlyMode && this.jupyterViewMode !== "circuit");
    this.circuit.setPresentationMode(readOnlyMode);
    this.stateVectorFrame.setContentPinnedToTopLeft(!this.jupyterReadOnly);
    this.stateVectorFrame.setPresentationInset(
      this.jupyterViewMode === "state" ? 8 : 0,
    );
    if (this.jupyterViewMode === "notebook") {
      this.resetJupyterZoom();
    }

    this.resizeJupyterRenderSurface();

    if (this.jupyterViewMode === "state") {
      this.circuitFrame.visible = false;
      this.stateVectorFrame.visible = true;
      this.stateVectorFrame.x = 0;
      this.stateVectorFrame.repositionAndResize(
        0,
        this.jupyterVisibleWidth(),
        this.app.screen.height,
      );
      this.applyJupyterPresentationScale();
      this.dispatchJupyterLayout({
        right: 0,
        width: 0,
        top: 0,
        contentTop: 0,
        contentHeight: this.app.screen.height,
      });
      this.scheduleJupyterViewerResize();
      return;
    }

    const sidePanelWidth = this.jupyterSidePanelWidth();
    const circuitWidth = this.jupyterCircuitFrameWidth();
    const visibleWidth = this.jupyterVisibleWidth();
    const contentTop =
      this.jupyterToolbarHeight() + this.jupyterSidePanelHeaderHeight();

    this.circuitFrame.visible = true;
    this.circuitFrame.x = 0;
    this.circuitFrame.y = 0;
    this.circuitFrame.resize(circuitWidth, this.app.screen.height);

    this.stateVectorFrame.x = circuitWidth;
    this.stateVectorFrame.repositionAndResize(
      contentTop,
      sidePanelWidth,
      this.jupyterSidePanelContentHeight(),
    );
    this.stateVectorFrame.visible =
      this.jupyterViewMode !== "circuit" &&
      this.jupyterRightPane === "state-vector";
    this.applyJupyterPresentationScale();

    this.dispatchJupyterLayout({
      right: visibleWidth - circuitWidth - sidePanelWidth,
      width: sidePanelWidth,
      top: this.jupyterToolbarHeight(),
      contentTop,
      contentHeight: this.jupyterSidePanelContentHeight(),
    });
    this.scheduleJupyterViewerResize();
  }

  private resizeJupyterRenderSurface(): void {
    const width = this.jupyterRenderSurfaceWidth();
    if (Math.ceil(this.app.screen.width) === Math.ceil(width)) {
      return;
    }

    this.app.renderer.resize(width, this.app.screen.height);
  }

  private applyJupyterDomChrome(): void {
    const menuContainer = document.getElementById("menu-container");
    const demoHeader = document.getElementById("demo-header");
    if (menuContainer) {
      menuContainer.classList.toggle(
        "hidden",
        this.jupyterReadOnly ||
          this.jupyterViewMode === "state" ||
          this.jupyterViewMode === "circuit",
      );
    }
    if (demoHeader) {
      const visible =
        this.jupyterReadOnly && this.jupyterViewMode === "notebook";
      demoHeader.classList.toggle("hidden", !visible);
      demoHeader.classList.toggle("flex", visible);
    }
  }

  private dispatchJupyterLayout(detail: {
    right: number;
    width: number;
    top: number;
    contentTop: number;
    contentHeight: number;
  }): void {
    window.dispatchEvent(new CustomEvent("qni-jupyter-layout", { detail }));
  }

  private scheduleJupyterViewerResize(): void {
    if (!this.isJupyterEntry) {
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.postJupyterViewerResize());
    });
  }

  private postJupyterViewerResize(): void {
    if (!this.isJupyterEntry) {
      return;
    }

    window.parent.postMessage(
      {
        source: "qni-gl",
        type: "qni:resize",
        height: this.preferredJupyterViewerHeight(),
        width: this.preferredJupyterViewerWidth(),
        allowOverflowWidth: this.jupyterViewMode === "notebook",
      },
      "*",
    );
  }

  private preferredJupyterViewerHeight(): number {
    return this.preferredJupyterViewerHeightForZoom(this.jupyterZoom);
  }

  private preferredJupyterViewerHeightForZoom(zoom: number): number {
    const padding = 24;

    if (this.jupyterViewMode === "state") {
      return Math.max(
        140,
        Math.ceil(this.stateVector.height * zoom + padding),
      );
    }

    if (this.jupyterViewMode === "circuit") {
      return Math.max(
        160,
        Math.ceil(
          (this.circuitFrame.circuit.y + this.circuit.height) * zoom +
            padding,
        ),
      );
    }

    return this.app.screen.height;
  }

  private preferredJupyterViewerWidth(): number {
    return this.preferredJupyterViewerWidthForZoom(this.jupyterZoom);
  }

  private preferredJupyterViewerWidthForZoom(zoom: number): number {
    const padding = 24;

    if (this.jupyterViewMode === "state") {
      return Math.max(
        160,
        Math.ceil(this.stateVector.width * zoom + padding),
      );
    }

    if (this.jupyterViewMode === "circuit") {
      return Math.max(
        160,
        Math.ceil(
          (this.circuitFrame.circuit.x + this.circuit.width) * zoom +
            padding,
        ),
      );
    }

    return this.app.screen.width;
  }

  private setupFrameDividerEventHandlers() {
    this.frameDivider.on(
      FRAME_DIVIDER_EVENTS.DRAG_STARTED,
      this.startFrameDividerDragging,
      this,
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
      this.app.screen.height - this.frameDivider.y,
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
      this,
    );
    this.circuitFrame.circuit.on(
      OPERATION_EVENTS.SNAPPED,
      this.handleCircuitChange,
      this,
    );
  }

  private setupStateVectorEventHandlers() {
    this.stateVector.on(
      STATE_VECTOR_EVENTS.VISIBLE_QUBIT_CIRCLES_CHANGED,
      this.runSimulator,
      this,
    );
  }

  private async initApp() {
    this.prepareJupyterViewport();

    await this.app.init({
      ...(this.isJupyterEntry
        ? {
            width: window.innerWidth,
            height: this.jupyterViewportHeight(),
          }
        : { resizeTo: window }),
      resolution: this.renderResolution(),
      preference: "webgpu",
      antialias: true,
      autoDensity: true,
      backgroundColor: Colors["bg"],
      preserveDrawingBuffer: true,
    });

    await Assets.init({
      texturePreference: { resolution: this.renderResolution() },
    });
  }

  private gateDiscarded(gate: OperationComponent) {
    this.activeGate = null;
    this.grabbedGate = null;
    if (gate.parent === this.circuitFrame) {
      this.circuitFrame.removeChild(gate);
    }

    if (this.circuit.activeStepIndex === null) {
      this.circuit.fetchStep(0).activate();
    }

    // 回路外へ捨てたゲートで空になったステップを、通常の回路編集と同じ後処理で詰める。
    this.circuit.update();
    if (this.circuit.activeStepIndex === null) {
      this.circuit.fetchStep(0).activate();
    }
    this.updateUrlWithCircuit();
    this.updateStateVectorComponentQubitCount();
    this.resizeStateVectorFrame();
    this.runSimulator();
  }

  protected handleServiceWorkerMessage(event: MessageEvent): void {
    if (event.data.requestId !== this.simulationRequestId) {
      return;
    }
    if (event.data.type === "error") {
      this.showSimulationError(String(event.data.message || "Simulation failed."));
      return;
    }
    if (event.data.type === "finish") {
      this.element.dataset.state = "idle";
      this.scheduleJupyterViewerResize();
      return;
    }
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

    if (event.data.blochVectors) {
      for (const [bit, vector] of Object.entries(event.data.blochVectors)) {
        const dropzone = step.fetchDropzone(parseInt(bit));
        const blochSphere = dropzone.operation;

        if (!(blochSphere instanceof BlochSphere)) {
          throw new Error(`${blochSphere} is not BlochSphere`);
        }

        blochSphere.setBlochVector(
          vector as { x: number; y: number; z: number },
        );
      }
    }

    const amplitudes = event.data.amplitudes;
    if (amplitudes) {
      this.updateStateVectorAmplitudes(amplitudes);
      this.scheduleJupyterViewerResize();
    }

    // ページの <div id="app" data-state="running"></div> を
    // <div id="app" data-state="idle"></div> に変更
  }

  private showSimulationError(message: string): void {
    let banner = document.getElementById("simulation-error");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "simulation-error";
      banner.setAttribute("role", "alert");
      Object.assign(banner.style, {
        position: "fixed", left: "12px", right: "12px", bottom: "12px",
        zIndex: "100", padding: "10px 14px", borderRadius: "8px",
        color: "#991b1b", background: "#fee2e2", border: "1px solid #fecaca",
        font: "14px system-ui, sans-serif",
      });
      document.body.appendChild(banner);
    }
    banner.textContent = `QniNotebook: ${message}`;
    banner.hidden = false;
  }

  private updateStateVectorAmplitudes(amplitudes: {
    [key: number]: [number, number];
  }) {
    this.stateVector.updateAmplitudes(amplitudes);
  }

  get screenWidth(): number {
    return this.app.screen.width;
  }

  get screenHeight(): number {
    return this.app.screen.height;
  }

  resize() {
    const width = this.isJupyterEntry
      ? this.jupyterRenderSurfaceWidth()
      : window.innerWidth;
    const height = this.isJupyterEntry
      ? this.jupyterViewMode === "notebook"
        ? this.jupyterViewportHeightOverride ?? window.innerHeight
        : window.innerHeight
      : window.innerHeight;

    this.app.renderer.resize(width, height);

    if (this.isJupyterEntry) {
      if (this.jupyterViewMode !== "notebook") {
        this.applyJupyterViewportHeight(height);
      }
      this.applyJupyterFrameLayout();
      return;
    }

    this.frameDivider.updateWidth(this.app.screen.width);

    this.resizeStateVectorFrame();
  }

  private grabGate(
    gate: OperationComponent,
    pointerPosition: Point,
  ) {
    const previousActiveGate = this.activeGate;
    if (
      previousActiveGate !== null &&
      previousActiveGate !== gate
    ) {
      previousActiveGate.deactivate();
    }

    // the reason for this is because of multitouch
    // we want to track the movement of this particular touch
    this.activeGate = gate;
    this.grabbedGate = gate;
    gate.insertable = false;
    this.grabbedGate.once(OPERATION_EVENTS.DISCARDED, this.gateDiscarded, this);

    // this.dropzones についてループを回す
    // その中で、dropzone が snappable かどうかを判定する
    let dropzone;

    this.circuit.maybeAppendWire();

    this.updateStateVectorComponentQubitCount();

    const dragSize = this.dragHitSizeFor(gate);

    for (const circuitStep of this.circuit.steps) {
      for (const each of circuitStep.dropzones) {
        if (
          this.isSnappable(
            gate,
            pointerPosition.x,
            pointerPosition.y,
            dragSize.width,
            dragSize.height,
            each,
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
    dropzone: Dropzone,
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
      snapzoneHeight,
    );
  }

  private isGateHoveringAtLeftInsertPosition(
    gateCenterX: number,
    gateCenterY: number,
    gateWidth: number,
    gateHeight: number,
    dropzone: Dropzone,
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
      snapzoneHeight,
    );
  }

  private isGateHoveringAtRightInsertPosition(
    gateCenterX: number,
    gateCenterY: number,
    gateWidth: number,
    gateHeight: number,
    dropzone: Dropzone,
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
      snapzoneHeight,
    );
  }

  private maybeMoveGate(event: FederatedPointerEvent) {
    if (this.grabbedGate === null) {
      return;
    }

    this.moveGate(this.grabbedGate, event.global);
  }

  /**
   * ドラッグ中の当たり判定は、描画boundsではなくゲート本来のサイズで安定させる。
   */
  private dragHitSizeFor(gate: OperationComponent): {
    width: number;
    height: number;
  } {
    return {
      width: gate.sizeInPx,
      height: gate.sizeInPx,
    };
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
    const dragSize = this.dragHitSizeFor(gate);

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
          dragSize.width,
          dragSize.height,
          dropzone,
        );
        const isGateInsertableLeft = this.isGateHoveringAtLeftInsertPosition(
          pointerPosition.x,
          pointerPosition.y,
          dragSize.width,
          dragSize.height,
          dropzone,
        );
        const isGateInsertableRight = this.isGateHoveringAtRightInsertPosition(
          pointerPosition.x,
          pointerPosition.y,
          dragSize.width,
          dragSize.height,
          dropzone,
        );

        if (isSnappable || isGateInsertableLeft || isGateInsertableRight) {
          const snappablePosition = isSnappable
            ? new Point(
                dropzone.getGlobalPosition().x + dropzone.width / 2,
                dropzone.getGlobalPosition().y + dropzone.height / 2,
              )
            : null;
          const leftInsertablePosition = isGateInsertableLeft
            ? new Point(
                dropzone.getGlobalPosition().x,
                dropzone.getGlobalPosition().y + dropzone.height / 2,
              )
            : null;
          const rightInsertablePosition = isGateInsertableRight
            ? new Point(
                dropzone.getGlobalPosition().x + dropzone.width,
                dropzone.getGlobalPosition().y + dropzone.height / 2,
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
                  Math.pow(pointerPosition.y - snappablePosition.y, 2),
              )
            : Infinity;
          const leftInsertableDistance = leftInsertablePosition
            ? Math.sqrt(
                Math.pow(pointerPosition.x - leftInsertablePosition.x, 2) +
                  Math.pow(pointerPosition.y - leftInsertablePosition.y, 2),
              )
            : Infinity;
          const rightInsertableDistance = rightInsertablePosition
            ? Math.sqrt(
                Math.pow(pointerPosition.x - rightInsertablePosition.x, 2) +
                  Math.pow(pointerPosition.y - rightInsertablePosition.y, 2),
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
        this.grabbedGate.insertStepPosition!,
      );
      this.grabbedGate.position.set(8, 8);
      this.grabbedGate.insert(
        insertedStep.fetchDropzone(this.grabbedGate.insertQubitIndex!),
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
    this.resizeStateVectorFrame();
    this.runSimulator();
    this.scheduleJupyterViewerResize();
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
    this.simulationRequestId += 1;
    document.getElementById("simulation-error")?.setAttribute("hidden", "");
    this.worker.postMessage({
      requestId: this.simulationRequestId,
      circuitJson: this.circuit.toJSON(),
      qubitCount: this.stateVector.qubitCount,
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

  private updateAfterCircuitEdit(): void {
    this.circuit.update();
    this.updateUrlWithCircuit();
    this.updateStateVectorComponentQubitCount();
    this.resizeStateVectorFrame();
    this.runSimulator();
  }

  /**
   * 現在の入口に応じて、状態ベクトルフレームの位置とサイズを更新する。
   */
  private resizeStateVectorFrame(): void {
    if (this.isJupyterEntry) {
      this.applyJupyterFrameLayout();
      return;
    }

    this.stateVectorFrame.repositionAndResize(
      this.frameDivider.y + this.frameDivider.height,
      this.app.screen.width,
      this.app.screen.height - this.frameDivider.y,
    );
  }

  /**
   * Jupyter右ペインのタブ状態に合わせて、Pixi側の状態ベクトルを表示/非表示にする。
   */
  public setJupyterRightPane(pane: "code" | "state-vector"): void {
    if (!this.isJupyterEntry) {
      return;
    }

    this.jupyterRightPane = pane;
    this.applyJupyterFrameLayout();
  }

  /**
   * 用途別Notebook APIから指定された初期表示モードをJupyterレイアウトへ反映する。
   */
  public setJupyterViewMode(mode: JupyterViewMode): void {
    if (!this.isJupyterEntry) {
      return;
    }

    this.jupyterViewMode = mode;
    this.jupyterRightPane =
      mode === "circuit" ? "state-vector" : this.jupyterRightPane;
    this.applyJupyterInteractionMode();
    this.applyJupyterFrameLayout();
  }

  /**
   * Jupyter右ペインをドラッグリサイズした幅で再配置する。
   */
  public setJupyterSidePanelWidth(width: number): void {
    if (!this.isJupyterEntry) {
      return;
    }

    this.jupyterSidePanelWidthOverride = Math.min(
      this.jupyterSidePanelMaxWidth(),
      Math.max(App.JUPYTER_SIDE_PANEL_MIN_WIDTH, width),
    );
    this.applyJupyterFrameLayout();
  }

  /**
   * Jupyter右ペインの状態ベクトル表示形状を変更する。
   */
  public setJupyterStateVectorAspectIndex(
    aspectIndex: StateVectorAspectIndex
  ): void {
    if (!this.isJupyterEntry) {
      return;
    }

    this.stateVector.setAspectIndex(aspectIndex);
    this.applyJupyterFrameLayout();
  }

  private setupJupyterZoom(): void {
    if (!this.isJupyterEntry) {
      return;
    }

    this.applyJupyterInteractionMode();
    const canvas = this.app.canvas;
    canvas.addEventListener("wheel", this.handleJupyterZoomWheel, {
      passive: false,
      capture: true,
    });
    canvas.addEventListener("pointerdown", this.handleJupyterZoomPointerDown, {
      passive: true,
    });
    canvas.addEventListener("pointermove", this.handleJupyterZoomPointerMove, {
      passive: false,
    });
    canvas.addEventListener("pointerup", this.handleJupyterZoomPointerEnd, {
      passive: true,
    });
    canvas.addEventListener("pointercancel", this.handleJupyterZoomPointerEnd, {
      passive: true,
    });
  }

  private handleJupyterZoomWheel = (event: WheelEvent): void => {
    if (
      this.jupyterViewMode === "notebook" ||
      (!event.ctrlKey && !event.metaKey)
    ) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    const zoomFactor = Math.exp(-event.deltaY * 0.0015);
    this.zoomJupyterAroundViewportCenter(zoomFactor);
  };

  private handleJupyterZoomPointerDown = (event: PointerEvent): void => {
    if (this.jupyterViewMode === "notebook") {
      return;
    }
    if (event.pointerType !== "touch") {
      return;
    }

    this.jupyterActivePointers.set(
      event.pointerId,
      new Point(event.clientX, event.clientY),
    );
    this.app.canvas.setPointerCapture(event.pointerId);
    this.jupyterLastPinchDistance = this.currentJupyterPinchDistance();
  };

  private handleJupyterZoomPointerMove = (event: PointerEvent): void => {
    if (
      this.jupyterViewMode === "notebook" ||
      event.pointerType !== "touch"
    ) {
      return;
    }
    if (!this.jupyterActivePointers.has(event.pointerId)) {
      return;
    }

    this.jupyterActivePointers.set(
      event.pointerId,
      new Point(event.clientX, event.clientY),
    );
    const distance = this.currentJupyterPinchDistance();
    if (distance === null || this.jupyterLastPinchDistance === null) {
      return;
    }
    const zoomFactor = distance / this.jupyterLastPinchDistance;
    if (Math.abs(Math.log(zoomFactor)) < 0.015) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    this.zoomJupyterAroundViewportCenter(zoomFactor);
    this.jupyterLastPinchDistance = distance;
  };

  private handleJupyterZoomPointerEnd = (event: PointerEvent): void => {
    this.jupyterActivePointers.delete(event.pointerId);
    this.jupyterLastPinchDistance = this.currentJupyterPinchDistance();
  };

  private currentJupyterPinchDistance(): number | null {
    const points = [...this.jupyterActivePointers.values()];
    if (points.length < 2) {
      return null;
    }

    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  private zoomJupyterAroundViewportCenter(factor: number): void {
    const previousZoom = this.jupyterZoom;
    const nextZoom = Math.min(
      this.jupyterZoomMax,
      Math.max(this.jupyterZoomMin, previousZoom * factor),
    );
    if (Math.abs(nextZoom - previousZoom) < 0.001) {
      return;
    }

    this.jupyterZoom = nextZoom;
    this.scheduleJupyterZoomApply();
  }

  private scheduleJupyterZoomApply(): void {
    if (this.jupyterZoomFrame !== null) {
      return;
    }

    this.jupyterZoomFrame = requestAnimationFrame(() => {
      this.jupyterZoomFrame = null;
      this.postJupyterViewerResize();
      this.app.stage.scale.set(1);
      this.app.stage.position.set(0, 0);
      this.applyJupyterPresentationScale();
    });
  }

  private resetJupyterZoom(): void {
    this.jupyterZoom = 1;
    this.jupyterRenderedZoom = 1;
    this.app.stage.scale.set(1);
    this.app.stage.position.set(0, 0);
    this.applyJupyterPresentationScale();
    this.jupyterActivePointers.clear();
    this.jupyterLastPinchDistance = null;
  }

  private applyJupyterPresentationScale(): void {
    if (!this.isJupyterEntry) {
      return;
    }

    const isPresentation =
      this.jupyterViewMode === "state" || this.jupyterViewMode === "circuit";
    if (!isPresentation) {
      this.jupyterRenderedZoom = 1;
    } else if (
      this.jupyterZoom <= this.jupyterRenderedZoom ||
      this.canRenderJupyterZoom(this.jupyterZoom)
    ) {
      this.jupyterRenderedZoom = this.jupyterZoom;
    }

    const scale = isPresentation ? this.jupyterRenderedZoom : 1;
    this.circuitFrame.setPresentationScale(
      this.jupyterViewMode === "circuit" ? scale : 1,
    );
    this.stateVectorFrame.setPresentationScale(
      this.jupyterViewMode === "state" ? scale : 1,
    );
  }

  private canRenderJupyterZoom(zoom: number): boolean {
    return (
      window.innerWidth >= this.preferredJupyterViewerWidthForZoom(zoom) - 1 &&
      window.innerHeight >= this.preferredJupyterViewerHeightForZoom(zoom) - 1
    );
  }

  private applyJupyterInteractionMode(): void {
    if (!this.isJupyterEntry) {
      return;
    }

    const isPresentation =
      this.jupyterViewMode === "state" || this.jupyterViewMode === "circuit";
    this.app.canvas.style.touchAction = isPresentation ? "none" : "auto";
    document.documentElement.style.touchAction = isPresentation ? "none" : "";
    document.body.style.touchAction = isPresentation ? "none" : "";
    this.app.renderer.background.color = isPresentation
      ? 0xffffff
      : Colors["bg"];
  }

  /**
   * 量子回路の状態をURLにエンコードする
   */
  public updateUrlWithCircuit(): void {
    if (this.isJupyterEntry) {
      return;
    }

    // タイトル取得
    const titleInput = document.getElementById(
      "circuit-title-input",
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
        "circuit-title-input",
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

  /**
   * Notebook iframeでは高DPI canvasが操作遅延に直結するため、Jupyter入口だけ1xで描画する。
   */
  private renderResolution(): number {
    if (this.isJupyterEntry) {
      return 1;
    }

    return window.devicePixelRatio;
  }

  /**
   * VS Code Notebookの出力領域が大きくても、Jupyter版Qniの表示高さを固定する。
   */
  private prepareJupyterViewport(): void {
    if (!this.isJupyterEntry) {
      return;
    }

    this.applyJupyterViewportHeight(this.jupyterViewportHeight());
  }

  private applyJupyterViewportHeight(viewportHeight: number): void {
    const height = `${viewportHeight}px`;
    document.documentElement.style.height = height;
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.backgroundColor = Colors["bg-component"];
    document.body.style.height = height;
    document.body.style.overflow = "hidden";
    document.body.style.backgroundColor = Colors["bg-component"];
    this.element.style.height = height;
    this.element.style.overflow = "hidden";
    this.element.style.backgroundColor = Colors["bg-component"];
  }

  /**
   * Notebookセルに埋め込むQni本体の高さをURLから読み、白いcanvas領域にも同じ値を使う。
   */
  private jupyterViewportHeight(): number {
    if (this.jupyterViewportHeightOverride !== null) {
      return this.jupyterViewportHeightOverride;
    }
    const requestedHeight = Number(
      new URLSearchParams(window.location.search).get("height"),
    );
    if (!Number.isFinite(requestedHeight)) {
      return App.JUPYTER_VIEWPORT_DEFAULT_HEIGHT;
    }

    return Math.min(
      App.JUPYTER_VIEWPORT_MAX_HEIGHT,
      Math.max(App.JUPYTER_VIEWPORT_MIN_HEIGHT, Math.round(requestedHeight)),
    );
  }
}
