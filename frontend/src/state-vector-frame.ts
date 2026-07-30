import { Container, FederatedPointerEvent, Graphics, Point, Rectangle } from "pixi.js";
import { Colors } from "./colors";
import { StateVectorComponent } from "./state-vector-component";
import { STATE_VECTOR_EVENTS } from "./state-vector-events";

/**
 * スクロール機能つきフレーム。状態ベクトルを表示する。
 */
export class StateVectorFrame extends Container {
  private static instance: StateVectorFrame | null = null;
  private static readonly PADDING_MULTIPLIER: number = 2;

  readonly stateVector: StateVectorComponent;

  private frameWidth: number;
  private frameHeight: number;
  private readonly background: Graphics;
  private maskGraphics: Graphics;
  private scrollContainer: Container;
  private isContentPinnedToTopLeft = false;
  private presentationInset = 0;
  private presentationScale = 1;
  private contentZoom = 1;
  private readonly minContentZoom = 0.25;
  private readonly maxContentZoom = 8;
  private isPanning = false;
  private lastPanPoint: Point | null = null;
  private pendingWheelMode: "scroll" | "zoom" | null = null;
  private pendingWheelDeltaX = 0;
  private pendingWheelDeltaY = 0;
  private pendingWheelPoint: Point | null = null;
  private pendingWheelFrame: number | null = null;
  private zoomCommitTimer: number | null = null;

  static initialize(width: number, height: number): StateVectorFrame {
    if (!this.instance) {
      this.instance = new StateVectorFrame(width, height);
    }
    return this.instance;
  }

  static getInstance(): StateVectorFrame {
    if (this.instance === null) {
      throw new Error(
        "StateVectorFrame is not initialized. Call initialize() first."
      );
    }
    return this.instance;
  }

  private constructor(width: number, height: number) {
    super();

    this.frameWidth = width;
    this.frameHeight = height;
    this.background = new Graphics();
    this.stateVector = new StateVectorComponent({
      initialQubitCount: 1,
      viewport: new Rectangle(0, 0, width, height),
    });
    this.maskGraphics = new Graphics();
    this.scrollContainer = new Container();

    this.initializeBackground();
    this.updateMask();
    this.initStateVector();

    this.addChildAt(this.background, 0);
    this.addChild(this.scrollContainer);
    this.scrollContainer.addChild(this.stateVector);
    this.addChild(this.maskGraphics);
    this.scrollContainer.mask = this.maskGraphics;

    // StateVectorComponentにスクロール位置を伝える
    const scrollRect = new Rectangle(
      -this.scrollContainer.x,
      -this.scrollContainer.y,
      this.frameWidth,
      this.frameHeight
    );
    this.stateVector.setViewport(scrollRect);

    this.updateStateVectorPosition();
    this.initializeScrollEvents();
  }

  private initializeBackground() {
    this.background
      .rect(0, 0, this.frameWidth, this.frameHeight)
      .fill(Colors["bg-component"]);
  }

  private updateMask(): void {
    this.maskGraphics
      .clear()
      .rect(0, 0, this.frameWidth, this.frameHeight)
      .fill(0xffffff);
  }

  private initStateVector() {
    this.stateVector.on(STATE_VECTOR_EVENTS.QUBIT_COUNT_CHANGED, () => {
      this.updateStateVectorPosition();
    });
  }

  /**
   * 状態ベクトルの位置とサイズを更新する
   */
  repositionAndResize(y: number, width: number, height: number) {
    this.y = y;
    this.frameWidth = width;
    this.frameHeight = height;

    this.background
      .clear()
      .rect(0, 0, this.frameWidth, this.frameHeight)
      .fill(Colors["bg-component"]);

    this.updateStateVectorPosition();
    this.updateMask();
  }

  /**
   * 状態ベクトルを中央寄せせず左上固定にする。狭いJupyterペインではスクロールで全体を見る。
   */
  pinContentToTopLeft(): void {
    this.isContentPinnedToTopLeft = true;
    this.updateStateVectorPosition();
  }

  setContentPinnedToTopLeft(pinned: boolean): void {
    this.isContentPinnedToTopLeft = pinned;
    this.updateStateVectorPosition();
  }

  setPresentationInset(inset: number): void {
    this.presentationInset = Math.max(0, inset);
    this.updateStateVectorPosition();
  }

  setPresentationScale(scale: number): void {
    this.presentationScale = Math.max(0.01, scale);
    this.applyScrollContainerScale();
    this.updateStateVectorPosition();
    this.updateMask();
  }

  private updateStateVectorPosition() {
    if (this.isContentPinnedToTopLeft) {
      this.scrollContainer.x = this.presentationInset;
      this.scrollContainer.y = this.presentationInset;
      this.stateVector.setViewport(
        new Rectangle(
          -this.presentationInset / this.scrollContainer.scale.x,
          -this.presentationInset / this.scrollContainer.scale.y,
          this.frameWidth / this.scrollContainer.scale.x,
          this.frameHeight / this.scrollContainer.scale.y
        )
      );
      return;
    }

    const scaleX = this.scrollContainer.scale.x;
    const scaleY = this.scrollContainer.scale.y;
    const scaledWidth = this.stateVector.width * scaleX;
    const scaledHeight = this.stateVector.height * scaleY;
    if (scaledWidth > this.frameWidth || scaledHeight > this.frameHeight) {
      this.scrollContainer.x = 0;
      this.scrollContainer.y = 0;
    } else {
      this.scrollContainer.x = (this.frameWidth - scaledWidth) / 2;
      this.scrollContainer.y = (this.frameHeight - scaledHeight) / 2;
    }
    this.updateViewportFromScrollContainer();
  }

  /**
   * スクロールイベントの初期化
   */
  private initializeScrollEvents(): void {
    this.interactive = true;
    this.on("wheel", this.queueScrollPositionAdjustment, this);
    this.on("pointerdown", this.startContentPan, this);
    this.on("pointermove", this.updateContentPan, this);
    this.on("pointerup", this.endContentPan, this);
    this.on("pointerupoutside", this.endContentPan, this);
  }

  /**
   * スクロール処理
   */
  private queueScrollPositionAdjustment(event: WheelEvent): void {
    if (this.shouldZoomContent(event)) {
      event.preventDefault();
      this.queueWheel("zoom", 0, event.deltaY, this.eventLocalPoint(event));
      return;
    }

    this.queueWheel("scroll", event.deltaX, event.deltaY);
  }

  private queueWheel(
    mode: "scroll" | "zoom",
    deltaX: number,
    deltaY: number,
    point: Point | null = null
  ): void {
    if (this.pendingWheelMode !== null && this.pendingWheelMode !== mode) {
      this.applyPendingWheel();
    }

    this.pendingWheelMode = mode;
    this.pendingWheelDeltaX += deltaX;
    this.pendingWheelDeltaY += deltaY;
    this.pendingWheelPoint = point ?? this.pendingWheelPoint;

    if (this.pendingWheelFrame !== null) {
      return;
    }

    this.pendingWheelFrame = requestAnimationFrame(() => {
      this.pendingWheelFrame = null;
      this.applyPendingWheel();
    });
  }

  private applyPendingWheel(): void {
    const mode = this.pendingWheelMode;
    const deltaX = this.pendingWheelDeltaX;
    const deltaY = this.pendingWheelDeltaY;
    const point = this.pendingWheelPoint;
    this.pendingWheelMode = null;
    this.pendingWheelDeltaX = 0;
    this.pendingWheelDeltaY = 0;
    this.pendingWheelPoint = null;

    if (mode === "zoom" && point !== null) {
      this.zoomContentAt(point, Math.exp(-deltaY * 0.0025));
      return;
    }

    if (mode !== "scroll") {
      return;
    }

    this.adjustScrollPositionXY(
      "y",
      deltaY,
      this.stateVector.height,
      this.frameHeight
    );
    this.adjustScrollPositionXY(
      "x",
      deltaX,
      this.stateVector.width,
      this.frameWidth
    );
  }

  /**
   * 指定された方向にスクロール位置を調整する
   */
  private adjustScrollPositionXY(
    scrollDirection: "x" | "y",
    delta: number,
    stateVectorSize: number,
    frameSize: number
  ): void {
    const scale = this.scrollContainer.scale[scrollDirection];
    if (!this.isScrollingNeeded(stateVectorSize * scale, frameSize)) return;

    // スクロールの方向:
    // - vertical: 上方向へのスクロールでdeltaが正、下方向で負
    // - horizontal: 左方向へのスクロールでdeltaが正、右方向で負
    this.scrollContainer[scrollDirection] -= delta;

    const scrollableDistance = this.calculateScrollableDistance(
      stateVectorSize * scale,
      frameSize
    );

    this.scrollContainer[scrollDirection] = this.limitScrollPosition(
      this.scrollContainer[scrollDirection],
      scrollableDistance
    );

    // StateVectorComponentにスクロール位置を伝える
    const scrollRect = new Rectangle(
      -this.scrollContainer.x / this.scrollContainer.scale.x,
      -this.scrollContainer.y / this.scrollContainer.scale.y,
      this.frameWidth / this.scrollContainer.scale.x,
      this.frameHeight / this.scrollContainer.scale.y
    );
    this.stateVector.setViewport(scrollRect);
  }

  private shouldZoomContent(event: WheelEvent): boolean {
    if (event.ctrlKey || event.metaKey) {
      return false;
    }
    return Math.abs(event.deltaY) > Math.abs(event.deltaX);
  }

  private eventLocalPoint(event: WheelEvent): Point {
    const maybeGlobal = event as WheelEvent & { global?: Point };
    if (maybeGlobal.global) {
      return this.toLocal(maybeGlobal.global);
    }
    return new Point(this.frameWidth * 0.5, this.frameHeight * 0.5);
  }

  private zoomContentAt(framePoint: Point, factor: number): void {
    const previousScale = this.scrollContainer.scale.x;
    const nextZoom = this.clampContentZoom(this.contentZoom * factor);
    if (Math.abs(nextZoom - this.contentZoom) < 0.001) {
      return;
    }

    const contentPoint = new Point(
      (framePoint.x - this.scrollContainer.x) / previousScale,
      (framePoint.y - this.scrollContainer.y) / previousScale
    );
    this.contentZoom = nextZoom;
    this.applyScrollContainerScale();
    const nextScale = this.scrollContainer.scale.x;
    this.scrollContainer.x = framePoint.x - contentPoint.x * nextScale;
    this.scrollContainer.y = framePoint.y - contentPoint.y * nextScale;
    this.clampScrollContainerPosition();
    this.scheduleZoomCommit();
  }

  private clampContentZoom(value: number): number {
    return Math.min(this.maxContentZoom, Math.max(this.minContentZoom, value));
  }

  private applyScrollContainerScale(): void {
    const scale = this.presentationScale * this.contentZoom;
    this.scrollContainer.scale.set(scale);
    this.scheduleZoomCommit();
  }

  private scheduleZoomCommit(): void {
    if (this.zoomCommitTimer !== null) {
      window.clearTimeout(this.zoomCommitTimer);
    }
    this.zoomCommitTimer = window.setTimeout(() => {
      this.zoomCommitTimer = null;
      const scale = this.scrollContainer.scale.x;
      this.stateVector.setDisplayScale(scale);
      this.clampScrollContainerPosition();
      this.updateViewportFromScrollContainer();
    }, 100);
  }

  private startContentPan(event: FederatedPointerEvent): void {
    if (!this.isContentPinnedToTopLeft || event.button !== 0) {
      return;
    }
    this.isPanning = true;
    this.lastPanPoint = event.global.clone();
    this.cursor = "grabbing";
  }

  private updateContentPan(event: FederatedPointerEvent): void {
    if (!this.isPanning || this.lastPanPoint === null) {
      return;
    }
    const dx = event.global.x - this.lastPanPoint.x;
    const dy = event.global.y - this.lastPanPoint.y;
    this.lastPanPoint = event.global.clone();
    this.scrollContainer.x += dx;
    this.scrollContainer.y += dy;
    this.clampScrollContainerPosition();
    this.updateViewportFromScrollContainer();
  }

  private endContentPan(): void {
    if (!this.isPanning) {
      return;
    }
    this.isPanning = false;
    this.lastPanPoint = null;
    this.cursor = "default";
  }

  private clampScrollContainerPosition(): void {
    const scaledWidth = this.stateVector.width * this.scrollContainer.scale.x;
    const scaledHeight = this.stateVector.height * this.scrollContainer.scale.y;

    if (scaledWidth <= this.frameWidth) {
      this.scrollContainer.x = this.isContentPinnedToTopLeft
        ? this.presentationInset
        : (this.frameWidth - scaledWidth) / 2;
    } else {
      this.scrollContainer.x = this.limitScrollPosition(
        this.scrollContainer.x,
        this.calculateScrollableDistance(scaledWidth, this.frameWidth)
      );
    }

    if (scaledHeight <= this.frameHeight) {
      this.scrollContainer.y = this.isContentPinnedToTopLeft
        ? this.presentationInset
        : (this.frameHeight - scaledHeight) / 2;
    } else {
      this.scrollContainer.y = this.limitScrollPosition(
        this.scrollContainer.y,
        this.calculateScrollableDistance(scaledHeight, this.frameHeight)
      );
    }
  }

  private updateViewportFromScrollContainer(): void {
    const scrollRect = new Rectangle(
      -this.scrollContainer.x / this.scrollContainer.scale.x,
      -this.scrollContainer.y / this.scrollContainer.scale.y,
      this.frameWidth / this.scrollContainer.scale.x,
      this.frameHeight / this.scrollContainer.scale.y
    );
    this.stateVector.setViewport(scrollRect);
  }

  /**
   * 状態ベクトルとフレームのサイズに基づいてスクロールが必要かどうかを返す
   */
  private isScrollingNeeded(
    stateVectorSize: number,
    frameSize: number
  ): boolean {
    return stateVectorSize > frameSize;
  }

  /**
   * フレーム内のスクロール可能な距離を計算する
   */
  private calculateScrollableDistance(
    stateVectorSize: number,
    frameSize: number
  ): number {
    // scrollableDistance が正の値の場合、その値だけスクロール可能
    // 0の場合、スクロールは不要（stateVectorがフレーム内に収まっている）
    return Math.max(0, stateVectorSize - frameSize);
  }

  /**
   * 許容範囲内でスクロール位置を制限する
   */
  private limitScrollPosition(
    position: number,
    scrollableDistance: number
  ): number {
    // 上端または左端の制限
    if (position > 0) {
      return 0;
    }
    // 下端または右端の制限
    if (position < -scrollableDistance) {
      return -scrollableDistance;
    }
    return position;
  }
}
