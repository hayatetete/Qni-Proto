import { Container, Point } from "pixi.js";
import { QubitCircle } from "./qubit-circle";
import { Size } from "./size";
import {
  StateVectorLayout,
  StateVectorVisibleCell,
} from "./state-vector-layout";

type AmplitudeMap = {
  [key: number]: [number, number];
};

export class QubitCircleManager {
  private circles: Map<string, QubitCircle> = new Map();
  private circleKeysByIndex: Map<number, string> = new Map();
  private layout: StateVectorLayout;
  private container: Container;
  private _visibleQubitCircleIndices: Set<number> = new Set();
  private visibleCells: StateVectorVisibleCell[] = [];
  private displayScale = 1;

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
    this.circleKeysByIndex.clear();

    this.visibleCells = this.layout.visibleQubitCirclePositions(
      startIndexX,
      startIndexY,
      endIndexX,
      endIndexY,
      this.displayScale
    );

    this.visibleCells.forEach(({ position, indices, approximate }) => {
      const key = this.circleKeyAt(position);
      const circle = this.circles.get(key);

      if (!circle) {
        this.createQubitCircle(position, approximate);
      } else {
        this.updateQubitCirclePositionAndSize(circle, position, approximate);
        unusedCircles.delete(key);
      }

      indices.forEach((index) => {
        visibleQubitCircleIndices.add(index);
        this.circleKeysByIndex.set(index, key);
      });
    });

    this.removeUnusedQubitCircles(unusedCircles);
    this._visibleQubitCircleIndices = visibleQubitCircleIndices;

    return visibleQubitCircleIndices;
  }

  get visibleQubitCircleIndices(): number[] {
    return Array.from(this._visibleQubitCircleIndices);
  }

  qubitCircleAt(index: number): QubitCircle | undefined {
    const representativeKey = this.circleKeysByIndex.get(index);
    if (representativeKey) {
      return this.circles.get(representativeKey);
    }

    const position = this.layout.qubitCirclePositionAt(index);
    const key = this.circleKeyAt(position);

    return this.circles.get(key);
  }

  updateAmplitudes(amplitudes: AmplitudeMap): void {
    this.visibleCells.forEach(({ position, indices }) => {
      const circle = this.circles.get(this.circleKeyAt(position));
      if (!circle) {
        return;
      }

      let probability = 0;
      let realSum = 0;
      let imagSum = 0;

      indices.forEach((index) => {
        const amplitude = amplitudes[index];
        if (!amplitude) {
          return;
        }
        const [real, imag] = amplitude;
        probability += real * real + imag * imag;
        realSum += real;
        imagSum += imag;
      });

      circle.probability = Math.min(100, probability * 100);
      if (probability > 0) {
        circle.phase = Math.atan2(imagSum, realSum);
      }
    });
  }

  resizeAllQubitCircles(size: Size): void {
    this.circles.forEach((circle) => {
      circle.size = size;
      circle.displayScale = this.displayScale;
      circle.probability = 0;
    });
  }

  setDisplayScale(scale: number): void {
    this.displayScale = Math.max(0.01, scale);
    this.circles.forEach((circle) => {
      circle.displayScale = this.displayScale;
    });
  }

  private createQubitCircle(position: Point, approximate: boolean): void {
    const circle = new QubitCircle(this.layout.qubitCircleSize);
    const key = this.circleKeyAt(position);

    this.circles.set(key, circle);
    circle.displayScale = this.displayScale;
    circle.approximate = approximate;
    circle.position.copyFrom(position);
    this.container.addChild(circle);
  }

  private updateQubitCirclePositionAndSize(
    circle: QubitCircle,
    position: Point,
    approximate: boolean
  ): void {
    circle.position.copyFrom(position);
    circle.size = this.layout.qubitCircleSize;
    circle.displayScale = this.displayScale;
    circle.approximate = approximate;
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
