import { Container, Point } from "pixi.js";
import { QubitCircle } from "./qubit-circle";
import { Size } from "./size";
import { StateVectorLayout } from "./state-vector-layout";

export class QubitCircleManager {
  private circles: Map<string, QubitCircle> = new Map();
  private layout: StateVectorLayout;
  private container: Container;
  private _visibleQubitCircleIndices: Set<number> = new Set();

  constructor(layout: StateVectorLayout, container: Container) {
    this.layout = layout;
    this.container = container;
  }

  updateVisibleQubitCircles(
    startIndexX: number,
    startIndexY: number,
    endIndexX: number,
    endIndexY: number
  ): Set<number> {
    const visibleQubitCircleIndices = new Set<number>();
    const unusedCircles = new Set(this.circles.keys());

    this.layout
      .visibleQubitCirclePositions(
        startIndexX,
        startIndexY,
        endIndexX,
        endIndexY
      )
      .forEach(({ position, index }) => {
        const key = this.circleKeyAt(position);
        const circle = this.circles.get(key);

        if (!circle) {
          this.createQubitCircle(position);
        } else {
          this.updateQubitCirclePositionAndSize(circle, position);
          unusedCircles.delete(key);
        }

        visibleQubitCircleIndices.add(index);
      });

    this.removeUnusedQubitCircles(unusedCircles);
    this._visibleQubitCircleIndices = visibleQubitCircleIndices;

    return visibleQubitCircleIndices;
  }

  get visibleQubitCircleIndices(): number[] {
    return Array.from(this._visibleQubitCircleIndices);
  }

  qubitCircleAt(index: number): QubitCircle | undefined {
    const position = this.layout.qubitCirclePositionAt(index);
    const key = this.circleKeyAt(position);

    return this.circles.get(key);
  }

  resizeAllQubitCircles(size: Size): void {
    this.circles.forEach((circle) => {
      circle.size = size;
      circle.probability = 0;
    });
  }

  private createQubitCircle(position: Point): void {
    const circle = new QubitCircle(this.layout.qubitCircleSize);
    const key = this.circleKeyAt(position);

    this.circles.set(key, circle);
    circle.position.copyFrom(position);
    this.container.addChild(circle);
  }

  private updateQubitCirclePositionAndSize(
    circle: QubitCircle,
    position: Point
  ): void {
    circle.position.copyFrom(position);
    circle.size = this.layout.qubitCircleSize;
  }

  private removeUnusedQubitCircles(qubitCircleKeys: Set<string>): void {
    qubitCircleKeys.forEach((key) => {
      const circle = this.circles.get(key);
      if (circle) {
        this.container.removeChild(circle);
        circle.destroy();
        this.circles.delete(key);
      }
    });
  }

  private circleKeyAt(position: Point): string {
    return `${position.x},${position.y}`;
  }
}
