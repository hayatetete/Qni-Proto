import { Container, Graphics, Rectangle } from "pixi.js";
import { Colors } from "./colors";
import { QubitCircle } from "./qubit-circle";
import { QubitCircleManager } from "./qubit-circle-manager";
import { QubitCount } from "./types";
import { STATE_VECTOR_EVENTS } from "./state-vector-events";
import { StateVectorLayout } from "./state-vector-layout";
import { logger } from "./util";

export class StateVectorRenderer {
  private layout: StateVectorLayout;
  private qubitCircleManager: QubitCircleManager;
  private backgroundGraphics: Graphics;
  private container: Container;
  private currentViewport: Rectangle;
  private visibleQubitCirclesStartIndexX: number = 0;
  private visibleQubitCirclesStartIndexY: number = 0;

  constructor(
    container: Container,
    qubitCount: QubitCount,
    viewport: Rectangle
  ) {
    this.container = container;
    this.layout = new StateVectorLayout(qubitCount);
    this.currentViewport = viewport;
    this.backgroundGraphics = new Graphics();
    this.container.addChildAt(this.backgroundGraphics, 0);
    this.qubitCircleManager = new QubitCircleManager(
      this.layout,
      this.container
    );
  }

  get visibleQubitCircleIndices(): number[] {
    return this.qubitCircleManager.visibleQubitCircleIndices;
  }

  drawBackground(): void {
    this.backgroundGraphics
      .clear()
      .rect(0, 0, this.layout.width, this.layout.height)
      .fill(Colors["bg-component"]);
  }

  drawQubitCircles(): Set<number> {
    const endIndexX = this.layout.visibleQubitCirclesEndIndex(
      this.currentViewport.x,
      this.currentViewport.width,
      this.layout.cols
    );
    const endIndexY = this.layout.visibleQubitCirclesEndIndex(
      this.currentViewport.y,
      this.currentViewport.height,
      this.layout.rows
    );

    return this.qubitCircleManager.updateVisibleQubitCircles(
      this.visibleQubitCirclesStartIndexX,
      this.visibleQubitCirclesStartIndexY,
      endIndexX,
      endIndexY
    );
  }

  updateQubitCircleLayout(qubitCount: QubitCount): void {
    this.layout.qubitCount = qubitCount;
    this.visibleQubitCirclesStartIndexX = 0;
    this.visibleQubitCirclesStartIndexY = 0;
    this.qubitCircleManager.resizeAllQubitCircles(this.layout.qubitCircleSize);
  }

  setViewport(viewport: Rectangle): boolean {
    const newVisibleQubitCirclesStartIndexX =
      this.layout.visibleQubitCirclesStartIndex(viewport.x);
    const newVisibleQubitCirclesStartIndexY =
      this.layout.visibleQubitCirclesStartIndex(viewport.y);

    if (
      newVisibleQubitCirclesStartIndexX !==
        this.visibleQubitCirclesStartIndexX ||
      newVisibleQubitCirclesStartIndexY !== this.visibleQubitCirclesStartIndexY
    ) {
      this.visibleQubitCirclesStartIndexX = newVisibleQubitCirclesStartIndexX;
      this.visibleQubitCirclesStartIndexY = newVisibleQubitCirclesStartIndexY;
      this.currentViewport = viewport.clone();

      const visibleIndices = this.draw();

      this.container.emit(
        STATE_VECTOR_EVENTS.VISIBLE_QUBIT_CIRCLES_CHANGED,
        Array.from(visibleIndices)
      );

      return true;
    }

    return false;
  }

  draw(): Set<number> {
    const startTime = performance.now();

    this.drawBackground();
    const visibleIndices = this.drawQubitCircles();

    const endTime = performance.now();
    logger.log(`Draw execution time: ${endTime - startTime} ms`);

    return visibleIndices;
  }

  qubitCircleAt(index: number): QubitCircle | undefined {
    return this.qubitCircleManager.qubitCircleAt(index);
  }
}
