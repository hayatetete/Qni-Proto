import { Circuit } from "./circuit";
import { CIRCUIT_STEP_EVENTS, OPERATION_EVENTS } from "./events";
import { CircuitStep } from "./circuit-step";
import { Colors } from "./colors";
import {
  Container,
  FederatedPointerEvent,
  Graphics,
  Point,
  Sprite,
  Texture,
} from "pixi.js";
import { OperationClass } from "./operation";
import { OperationPalette } from "./operation-palette";

const OPERATION_PALETTE_X = 40;
const OPERATION_PALETTE_Y = 64;
const PRESENTATION_PADDING = 16;

export class CircuitFrame extends Container {
  private static instance: CircuitFrame | null = null;

  readonly operationPalette: OperationPalette;
  readonly circuit: Circuit;

  private readonly background: Graphics;
  private readonly maskSprite: Sprite;
  private readonly scrollContainer: Container;
  private readonly horizontalScrollbar = new Graphics();
  private readonly verticalScrollbar = new Graphics();
  private viewportWidth: number;
  private viewportHeight: number;
  private paletteVisible = true;
  private presentationScale = 1;
  private circuitZoom = 1;
  private readonly minCircuitZoom = 0.5;
  private readonly maxCircuitZoom = 3;
  private pendingWheelMode: "scroll" | "zoom" | null = null;
  private pendingWheelDeltaX = 0;
  private pendingWheelDeltaY = 0;
  private pendingWheelPoint: Point | null = null;
  private pendingWheelFrame: number | null = null;
  private stepScrollAnimationFrame: number | null = null;
  private stepScrollTargetX: number | null = null;
  private stepScrollLastTimestamp: number | null = null;
  private isPanning = false;
  private lastPanPoint: Point | null = null;

  static initialize(width: number, height: number): CircuitFrame {
    if (!this.instance) {
      this.instance = new CircuitFrame(width, height);
    }
    return this.instance;
  }

  static getInstance(): CircuitFrame {
    if (this.instance === null) {
      throw new Error(
        "CircuitFrame is not initialized. Call initialize() first."
      );
    }
    return this.instance;
  }

  private constructor(width: number, height: number) {
    super();

    this.interactive = true;
    this.viewportWidth = width;
    this.viewportHeight = height;

    this.background = new Graphics();
    this.operationPalette = new OperationPalette();
    this.circuit = new Circuit({ minWireCount: 2, stepCount: 5 });
    this.scrollContainer = new Container();

    this.addChildAt(this.background, 0);
    this.addChild(this.scrollContainer);
    this.addChild(this.operationPalette);
    this.scrollContainer.addChild(this.circuit);

    this.maskSprite = new Sprite(Texture.WHITE);
    this.updateMask(width, height);
    this.scrollContainer.mask = this.maskSprite;
    this.addChild(this.maskSprite);
    this.addChild(this.horizontalScrollbar);
    this.addChild(this.verticalScrollbar);

    this.resize(width, height);
    this.initOperationPalette();
    this.initCircuit();

    this.initScrollEvents();
  }

  resize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.background
      .clear()
      .rect(0, 0, width, height)
      .fill(this.paletteVisible ? Colors["bg"] : Colors["bg-component"]);
    this.updateMask(width, height);
    this.limitScrollPosition();
  }

  paletteNaturalRightEdge(): number {
    return OPERATION_PALETTE_X + this.operationPalette.contentWidth;
  }

  hasScrollableContent(): boolean {
    const scale = this.scrollContainer.scale.x;
    const bottomPadding = this.paletteVisible ? 128 : 16;
    return (
      (this.circuit.x + this.circuit.width) * scale > this.viewportWidth ||
      (this.circuit.y + this.circuit.height) * scale + bottomPadding >
        this.viewportHeight
    );
  }

  /**
   * Notebookの用途別表示で、既存の回路描画は保ったまま編集パレットだけを畳む。
   */
  setPaletteVisible(visible: boolean): void {
    this.paletteVisible = visible;
    this.operationPalette.visible = visible;
    this.operationPalette.eventMode = visible ? "auto" : "none";
    this.operationPalette.interactiveChildren = visible;
    this.circuit.x = visible ? OPERATION_PALETTE_X : PRESENTATION_PADDING;
    this.circuit.y = visible ? this.defaultCircuitY() : PRESENTATION_PADDING;
    this.resize(this.viewportWidth, this.viewportHeight);
    this.limitScrollPosition();
  }

  setPresentationScale(scale: number): void {
    this.presentationScale = Math.max(0.01, scale);
    this.applyScrollContainerScale();
    this.updateMask(this.viewportWidth, this.viewportHeight);
    this.limitScrollPosition();
  }

  /** Start at the circuit's left edge, then slide the requested step into view. */
  animateStepIntoView(stepIndex: number): void {
    if (this.stepScrollAnimationFrame !== null) {
      cancelAnimationFrame(this.stepScrollAnimationFrame);
    }

    const step = this.circuit.fetchStep(stepIndex);
    const scale = this.scrollContainer.scale.x;
    const padding = 24;
    const right = (this.circuit.x + step.x + step.width) * scale;
    const targetX = Math.min(0, this.viewportWidth - padding - right);

    this.scrollContainer.x = 0;
    this.limitScrollPosition();
    const startX = this.scrollContainer.x;
    const distance = targetX - startX;
    if (distance === 0) return;

    const duration = 900;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.scrollContainer.x = startX + distance * eased;
      this.limitScrollPosition();
      if (progress < 1) {
        this.stepScrollAnimationFrame = requestAnimationFrame(tick);
      } else {
        this.stepScrollAnimationFrame = null;
      }
    };
    this.stepScrollAnimationFrame = requestAnimationFrame(tick);
  }

  /** Keep the selected step visible without adding latency while scrubbing. */
  scrollStepIntoView(stepIndex: number): void {
    if (this.stepScrollAnimationFrame !== null) {
      cancelAnimationFrame(this.stepScrollAnimationFrame);
      this.stepScrollAnimationFrame = null;
    }

    const step = this.circuit.fetchStep(stepIndex);
    const scale = this.scrollContainer.scale.x;
    const padding = 24;
    const left = (this.circuit.x + step.x) * scale + this.scrollContainer.x;
    const right = left + step.width * scale;
    let targetX = this.scrollContainer.x;
    if (left < padding) targetX += padding - left;
    else if (right > this.viewportWidth - padding) {
      targetX -= right - (this.viewportWidth - padding);
    }
    if (targetX === this.scrollContainer.x) return;

    this.stepScrollTargetX = targetX;
    this.stepScrollLastTimestamp = null;
    const tick = (now: number) => {
      if (this.stepScrollTargetX === null) return;
      const elapsed = Math.min(
        32,
        this.stepScrollLastTimestamp === null ? 0 : now - this.stepScrollLastTimestamp,
      );
      this.stepScrollLastTimestamp = now;
      const smoothing = 1 - Math.exp(-elapsed / 42);
      this.scrollContainer.x +=
        (this.stepScrollTargetX - this.scrollContainer.x) * smoothing;
      this.limitScrollPosition();

      if (Math.abs(this.stepScrollTargetX - this.scrollContainer.x) < 0.25) {
        this.scrollContainer.x = this.stepScrollTargetX;
        this.limitScrollPosition();
        this.stepScrollTargetX = null;
        this.stepScrollLastTimestamp = null;
        this.stepScrollAnimationFrame = null;
        return;
      }
      this.stepScrollAnimationFrame = requestAnimationFrame(tick);
    };
    this.stepScrollAnimationFrame = requestAnimationFrame(tick);
  }

  private initOperationPalette(): void {
    this.operationPalette.x = OPERATION_PALETTE_X;
    this.operationPalette.y = OPERATION_PALETTE_Y;

    this.operationPalette.on(
      OPERATION_EVENTS.GRABBED,
      this.grabPaletteOperation,
      this
    );
    this.operationPalette.on(
      OPERATION_EVENTS.MOUSE_LEFT,
      this.emitMouseLeavePaletteOperationEvent,
      this
    );
    this.operationPalette.on(
      OPERATION_EVENTS.DISCARDED,
      this.removeGrabbedPaletteOperation,
      this
    );
  }

  private initCircuit() {
    this.circuit.x = this.operationPalette.x;
    this.circuit.y = this.defaultCircuitY();

    this.circuit.on(
      CIRCUIT_STEP_EVENTS.ACTIVATED,
      this.emitStepActivatedEvent,
      this
    );
    this.circuit.on(OPERATION_EVENTS.GRABBED, this.grabCircuitOperation, this);
  }

  private grabPaletteOperation(
    operation: InstanceType<OperationClass>,
    pointerPosition: Point
  ): void {
    this.addChild(operation);
    this.emit(OPERATION_EVENTS.GRABBED, operation, pointerPosition);
  }

  private emitMouseLeavePaletteOperationEvent(): void {
    this.emit(OPERATION_EVENTS.MOUSE_LEFT);
  }

  private removeGrabbedPaletteOperation(
    operation: InstanceType<OperationClass>
  ): void {
    this.removeChild(operation);
    this.emit(OPERATION_EVENTS.DISCARDED, operation);
  }

  private emitStepActivatedEvent(circuitStep: CircuitStep): void {
    this.emit(CIRCUIT_STEP_EVENTS.ACTIVATED, circuitStep);
  }

  private grabCircuitOperation(
    operation: InstanceType<OperationClass>,
    pointerPosition: Point
  ): void {
    this.emit(OPERATION_EVENTS.GRABBED, operation, pointerPosition);
  }

  private initScrollEvents(): void {
    this.interactive = true;
    this.on("wheel", this.handleScroll, this);
    this.on("pointerdown", this.startPan, this);
    this.on("pointermove", this.updatePan, this);
    this.on("pointerup", this.endPan, this);
    this.on("pointerupoutside", this.endPan, this);
  }

  private updateMask(width: number, height: number): void {
    this.maskSprite.width = width;
    this.maskSprite.height = height;
    this.maskSprite.x = 0;
    this.maskSprite.y = 0;
  }

  private handleScroll(event: WheelEvent): void {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      this.queueWheel("zoom", 0, event.deltaY, this.eventLocalPoint(event));
      return;
    }

    const deltaX =
      event.shiftKey && Math.abs(event.deltaX) < 1 ? event.deltaY : event.deltaX;
    const deltaY =
      event.shiftKey && Math.abs(event.deltaX) < 1 ? 0 : event.deltaY;
    this.queueWheel("scroll", deltaX, deltaY);
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
      this.zoomCircuitAt(point, Math.exp(-deltaY * 0.0025));
      return;
    }

    if (mode === "scroll") {
      this.scrollBy(deltaX, deltaY);
    }
  }

  private scrollBy(deltaX: number, deltaY: number): void {
    this.scrollContainer.x -= deltaX;
    this.scrollContainer.y -= deltaY;

    this.limitScrollPosition();
  }

  private eventLocalPoint(event: WheelEvent): Point {
    const maybeGlobal = event as WheelEvent & { global?: Point };
    if (maybeGlobal.global) {
      return this.toLocal(maybeGlobal.global);
    }

    return new Point(this.viewportWidth * 0.5, this.viewportHeight * 0.5);
  }

  private zoomCircuitAt(_framePoint: Point, factor: number): void {
    const previousScale = this.scrollContainer.scale.x;
    const nextZoom = this.clampCircuitZoom(this.circuitZoom * factor);
    if (Math.abs(nextZoom - this.circuitZoom) < 0.001) {
      return;
    }

    const framePoint = new Point(0, 0);
    const contentPoint = new Point(
      (framePoint.x - this.scrollContainer.x) / previousScale,
      (framePoint.y - this.scrollContainer.y) / previousScale
    );
    this.circuitZoom = nextZoom;
    this.applyScrollContainerScale();
    const nextScale = this.scrollContainer.scale.x;
    this.scrollContainer.x = framePoint.x - contentPoint.x * nextScale;
    this.scrollContainer.y = framePoint.y - contentPoint.y * nextScale;
    this.limitScrollPosition();
  }

  private clampCircuitZoom(value: number): number {
    return Math.min(this.maxCircuitZoom, Math.max(this.minCircuitZoom, value));
  }

  private applyScrollContainerScale(): void {
    const scale = this.presentationScale * this.circuitZoom;
    this.scrollContainer.scale.set(scale);
    this.circuit.setDisplayScale(scale);
  }

  private startPan(event: FederatedPointerEvent): void {
    if (event.button !== 1) {
      return;
    }

    this.isPanning = true;
    this.lastPanPoint = event.global.clone();
    this.cursor = "grabbing";
    (event as FederatedPointerEvent & { preventDefault?: () => void })
      .preventDefault?.();
  }

  private updatePan(event: FederatedPointerEvent): void {
    if (!this.isPanning || this.lastPanPoint === null) {
      return;
    }

    const dx = event.global.x - this.lastPanPoint.x;
    const dy = event.global.y - this.lastPanPoint.y;
    this.lastPanPoint = event.global.clone();
    this.scrollContainer.x += dx;
    this.scrollContainer.y += dy;
    this.limitScrollPosition();
  }

  private endPan(): void {
    if (!this.isPanning) {
      return;
    }

    this.isPanning = false;
    this.lastPanPoint = null;
    this.cursor = "default";
  }

  /**
   * パレットと回路が狭いJupyter表示でも見切れないよう、縦横スクロール範囲を制限する。
   */
  private limitScrollPosition(): void {
    if (this.scrollContainer.y > 0) {
      this.scrollContainer.y = 0;
    }

    const bottomPadding = this.paletteVisible ? 128 : 16;
    const contentBottomEdge =
      (this.circuit.y + this.circuit.height) * this.scrollContainer.scale.y +
      bottomPadding;
    const maxScrollY = Math.max(0, contentBottomEdge - this.viewportHeight);
    if (this.scrollContainer.y < -maxScrollY) {
      this.scrollContainer.y = -maxScrollY;
    }

    const contentRightEdge =
      (this.circuit.x + this.circuit.width) * this.scrollContainer.scale.x;
    const maxScrollX = Math.max(0, contentRightEdge - this.viewportWidth);

    if (this.scrollContainer.x > 0) {
      this.scrollContainer.x = 0;
    }
    if (this.scrollContainer.x < -maxScrollX) {
      this.scrollContainer.x = -maxScrollX;
    }
    this.operationPalette.x = OPERATION_PALETTE_X;
    this.updateScrollbars(
      contentRightEdge,
      contentBottomEdge,
      maxScrollX,
      maxScrollY,
    );
  }

  private updateScrollbars(
    contentWidth: number,
    contentHeight: number,
    maxScrollX: number,
    maxScrollY: number,
  ): void {
    const thickness = 6;
    const inset = 4;
    const color = 0x9ca3af;

    this.horizontalScrollbar.clear();
    this.horizontalScrollbar.visible = maxScrollX > 0;
    if (maxScrollX > 0) {
      const trackWidth = Math.max(1, this.viewportWidth - inset * 2);
      const thumbWidth = Math.max(
        32,
        trackWidth * Math.min(1, this.viewportWidth / contentWidth),
      );
      const travel = Math.max(0, trackWidth - thumbWidth);
      const progress = -this.scrollContainer.x / maxScrollX;
      this.horizontalScrollbar
        .roundRect(
          inset + travel * progress,
          this.viewportHeight - thickness - inset,
          thumbWidth,
          thickness,
          thickness / 2,
        )
        .fill({ color, alpha: 0.7 });
    }

    this.verticalScrollbar.clear();
    this.verticalScrollbar.visible = maxScrollY > 0;
    if (maxScrollY > 0) {
      const trackHeight = Math.max(1, this.viewportHeight - inset * 2);
      const thumbHeight = Math.max(
        32,
        trackHeight * Math.min(1, this.viewportHeight / contentHeight),
      );
      const travel = Math.max(0, trackHeight - thumbHeight);
      const progress = -this.scrollContainer.y / maxScrollY;
      this.verticalScrollbar
        .roundRect(
          this.viewportWidth - thickness - inset,
          inset + travel * progress,
          thickness,
          thumbHeight,
          thickness / 2,
        )
        .fill({ color, alpha: 0.7 });
    }
  }

  private defaultCircuitY(): number {
    return OPERATION_PALETTE_Y + this.operationPalette.height + OPERATION_PALETTE_Y;
  }

}
