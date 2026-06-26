import { Point } from "pixi.js";
import { QubitCount } from "./types";
import { Size } from "./size";
import { Spacing } from "./spacing";
import { need, spacingInPx } from "./util";
import { MIN_QUBIT_COUNT } from "./constants";

export class StateVectorLayout {
  private static QUBIT_CIRCLE_SIZE_MAP: { [key: number]: Size } = {
    1: "xl",
    2: "xl",
    3: "xl",
    4: "lg",
    5: "base",
    6: "base",
    7: "base",
    8: "sm",
    9: "sm",
    10: "xs",
    11: "xs",
    12: "xs",
  };

  private _qubitCount: QubitCount = MIN_QUBIT_COUNT;
  private _cols: number = 0;
  private _rows: number = 0;
  private _padding: number = 0;
  private _qubitCircleMargin: number = spacingInPx(0.5);
  private _cellSize: number = 0;
  private _width: number = 0;
  private _height: number = 0;

  constructor(qubitCount: QubitCount) {
    this._qubitCount = qubitCount;
    this.update();
  }

  get qubitCount(): QubitCount {
    return this._qubitCount;
  }

  set qubitCount(newValue: QubitCount) {
    need(newValue > 0, "qubitCount must be greater than 0.");

    if (this._qubitCount !== newValue || newValue === MIN_QUBIT_COUNT) {
      this._qubitCount = newValue;
      this.update();
    }
  }

  get cols(): number {
    return this._cols;
  }

  get rows(): number {
    return this._rows;
  }

  get padding(): number {
    return this._padding;
  }

  get qubitCircleSize(): Size {
    return StateVectorLayout.QUBIT_CIRCLE_SIZE_MAP[this.qubitCount] || "xs";
  }

  get qubitCircleSizeInPx(): number {
    return Spacing.size.qubitCircle[this.qubitCircleSize];
  }

  get qubitCircleMargin(): number {
    return this._qubitCircleMargin;
  }

  private updateQubitCircleMargin(): void {
    this._qubitCircleMargin =
      this.qubitCount <= 8 ? spacingInPx(0.5) : spacingInPx(0.25);
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  visibleQubitCirclesStartIndex(viewportPosition: number): number {
    return Math.max(
      0,
      Math.floor((viewportPosition - this.padding) / this._cellSize)
    );
  }

  visibleQubitCirclesEndIndex(
    start: number,
    size: number,
    max: number
  ): number {
    return Math.min(
      Math.ceil((start + size - this.padding) / this._cellSize),
      max
    );
  }

  visibleQubitCirclePositions(
    startIndexX: number,
    startIndexY: number,
    endIndexX: number,
    endIndexY: number
  ) {
    const circles: { position: Point; index: number }[] = [];
    const maxVisibleCircles =
      Math.ceil(this.width / this._cellSize) *
      Math.ceil(this.height / this._cellSize);
    let count = 0;

    for (let y = startIndexY; y < endIndexY && count < maxVisibleCircles; y++) {
      for (
        let x = startIndexX;
        x < endIndexX && count < maxVisibleCircles;
        x++
      ) {
        const posX = this.padding + x * this._cellSize;
        const posY = this.padding + y * this._cellSize;
        const index = y * this.cols + x;
        circles.push({ position: new Point(posX, posY), index });
        count++;
      }
    }

    return circles;
  }

  qubitCirclePositionAt(index: number): Point {
    const x = index % this.cols;
    const y = Math.floor(index / this.cols);
    const posX = this.padding + x * this._cellSize;
    const posY = this.padding + y * this._cellSize;

    return new Point(posX, posY);
  }

  private update(): void {
    this._cols = Math.pow(2, Math.ceil(this.qubitCount / 2));
    this._rows = Math.ceil(Math.pow(2, this.qubitCount) / this._cols);
    this._padding = this.qubitCircleSizeInPx;
    this.updateQubitCircleMargin();
    this._cellSize = this.qubitCircleSizeInPx + this._qubitCircleMargin;
    const contentWidth = this._cols * this._cellSize - this._qubitCircleMargin;
    this._width = contentWidth + this._padding * 2;
    const contentHeight = this._rows * this._cellSize - this._qubitCircleMargin;
    this._height = contentHeight + this._padding * 2;
  }
}
