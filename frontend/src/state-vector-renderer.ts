import { Container, Graphics, Rectangle } from "pixi.js";
import { Colors } from "./colors";
import { QubitCircle } from "./qubit-circle";
import { QubitCircleManager } from "./qubit-circle-manager";
import { QubitCount } from "./types";
import { STATE_VECTOR_EVENTS } from "./state-vector-events";
import { StateVectorAspectIndex, StateVectorLayout } from "./state-vector-layout";
import { logger } from "./util";

type AmplitudeMap = {
  [key: number]: [number, number];
};

export class StateVectorRenderer {
  private layout: StateVectorLayout;
  private qubitCircleManager: QubitCircleManager;
  private backgroundGraphics: Graphics;
  private container: Container;
  private currentViewport: Rectangle;
  private visibleQubitCirclesStartIndexX: number = 0;
  private visibleQubitCirclesStartIndexY: number = 0;
  private aggregateStride = 1;
  private displayScale = 1;

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
    this.aggregateStride = this.layout.aggregateStride(this.displayScale);
    this.qubitCircleManager.resizeAllQubitCircles(this.layout.qubitCircleSize);
  }

  setAspectIndex(aspectIndex: StateVectorAspectIndex): void {
    this.layout.aspectIndex = aspectIndex;
    this.visibleQubitCirclesStartIndexX = 0;
    this.visibleQubitCirclesStartIndexY = 0;
    this.aggregateStride = this.layout.aggregateStride(this.displayScale);
    this.qubitCircleManager.resizeAllQubitCircles(this.layout.qubitCircleSize);
  }

  setDisplayScale(scale: number): boolean {
    this.displayScale = Math.max(0.01, scale);
    this.qubitCircleManager.setDisplayScale(this.displayScale);
    const nextStride = this.layout.aggregateStride(this.displayScale);
    if (nextStride === this.aggregateStride) {
      return false;
    }

    this.aggregateStride = nextStride;
    this.draw();
    return true;
  }

  updateAmplitudes(amplitudes: AmplitudeMap): void {
    this.qubitCircleManager.updateAmplitudes(amplitudes);
  }

  setViewport(viewport: Rectangle): boolean {
    const newVisibleQubitCirclesStartIndexX =
      this.layout.visibleQubitCirclesStartIndex(viewport.x);
    const newVisibleQubitCirclesStartIndexY =
      this.layout.visibleQubitCirclesStartIndex(viewport.y);
    const viewportChanged =
      viewport.x !== this.currentViewport.x ||
      viewport.y !== this.currentViewport.y ||
      viewport.width !== this.currentViewport.width ||
      viewport.height !== this.currentViewport.height;

    if (
      viewportChanged ||
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
