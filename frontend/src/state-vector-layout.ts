import { Point } from "pixi.js";
import { QubitCount } from "./types";
import { Size } from "./size";
import { Spacing } from "./spacing";
import { need, spacingInPx } from "./util";
import { MIN_QUBIT_COUNT } from "./constants";

export type StateVectorAspectIndex = number;

export type StateVectorAspectOption = {
  aspectIndex: StateVectorAspectIndex;
  cols: number;
  rows: number;
};

export type StateVectorVisibleCell = {
  position: Point;
  index: number;
  indices: number[];
  approximate: boolean;
};

export function stateVectorDefaultAspectIndex(qubitCount: QubitCount): number {
  const q = Math.max(1, Math.min(16, qubitCount));
  if (q === 1) return 1;
  if (q === 2) return 2;
  if (q === 3 || q === 4) return 3;
  if (q === 5 || q === 6) return 4;
  if (q <= 10) return 5;
  if (q <= 12) return 6;
  if (q <= 14) return 7;
  return 8;
}

export function stateVectorAspectOptions(
  qubitCount: QubitCount
): StateVectorAspectOption[] {
  const q = Math.max(1, Math.min(16, qubitCount));
  return Array.from({ length: q + 1 }, (_, aspectIndex) => ({
    aspectIndex,
    cols: Math.pow(2, aspectIndex),
    rows: Math.pow(2, q - aspectIndex),
  }));
}

export function stateVectorFittingAspectIndex(
  qubitCount: QubitCount,
  viewportWidth: number,
  viewportHeight: number,
): StateVectorAspectIndex {
  const availableWidth = Math.max(1, viewportWidth);
  const availableHeight = Math.max(1, viewportHeight);
  let bestAspectIndex = stateVectorDefaultAspectIndex(qubitCount);
  let bestScale = -1;
  let bestAspectDistance = Number.POSITIVE_INFINITY;
  const viewportAspect = availableWidth / availableHeight;

  for (const option of stateVectorAspectOptions(qubitCount)) {
    const layout = new StateVectorLayout(qubitCount);
    layout.aspectIndex = option.aspectIndex;
    const scale = Math.min(
      1,
      availableWidth / layout.width,
      availableHeight / layout.height,
    );
    const aspectDistance = Math.abs(
      Math.log(layout.width / layout.height / viewportAspect),
    );
    if (
      scale > bestScale + Number.EPSILON ||
      (Math.abs(scale - bestScale) <= Number.EPSILON &&
        aspectDistance < bestAspectDistance)
    ) {
      bestScale = scale;
      bestAspectDistance = aspectDistance;
      bestAspectIndex = option.aspectIndex;
    }
  }

  return bestAspectIndex;
}

export class StateVectorLayout {
  private static readonly AGGREGATE_CELL_PITCH_THRESHOLD = spacingInPx(2.5);

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
  private _aspectIndex: StateVectorAspectIndex =
    stateVectorDefaultAspectIndex(MIN_QUBIT_COUNT);
  private _aspectCustomized = false;

  constructor(qubitCount: QubitCount) {
    this._qubitCount = qubitCount;
    this.syncAspectIndexWithQubitCount();
    this.update();
  }

  get qubitCount(): QubitCount {
    return this._qubitCount;
  }

  set qubitCount(newValue: QubitCount) {
    need(newValue > 0, "qubitCount must be greater than 0.");

    if (this._qubitCount !== newValue || newValue === MIN_QUBIT_COUNT) {
      this._qubitCount = newValue;
      this.syncAspectIndexWithQubitCount();
      this.update();
    }
  }

  get cols(): number {
    return this._cols;
  }

  get rows(): number {
    return this._rows;
  }

  get aspectIndex(): StateVectorAspectIndex {
    return this._aspectIndex;
  }

  set aspectIndex(newValue: StateVectorAspectIndex) {
    const clamped = this.clampAspectIndex(newValue);
    if (this._aspectIndex === clamped && this._aspectCustomized) return;

    this._aspectIndex = clamped;
    this._aspectCustomized = true;
    this.update();
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
    endIndexY: number,
    displayScale = 1
  ): StateVectorVisibleCell[] {
    const cells: StateVectorVisibleCell[] = [];
    const stride = this.aggregateStride(displayScale);
    const stateCount = Math.pow(2, this.qubitCount);
    const aggregate = stride > 1;
    const maxVisibleCircles =
      Math.ceil(this.width / this._cellSize) *
      Math.ceil(this.height / this._cellSize);
    let count = 0;
    const blockStartX = Math.floor(startIndexX / stride) * stride;
    const blockStartY = Math.floor(startIndexY / stride) * stride;

    for (
      let y = blockStartY;
      y < endIndexY && count < maxVisibleCircles;
      y += stride
    ) {
      for (
        let x = blockStartX;
        x < endIndexX && count < maxVisibleCircles;
        x += stride
      ) {
        const blockEndX = Math.min(x + stride, this.cols);
        const blockEndY = Math.min(y + stride, this.rows);
        const posX =
          this.padding +
          x * this._cellSize +
          ((blockEndX - x - 1) * this._cellSize) / 2;
        const posY =
          this.padding +
          y * this._cellSize +
          ((blockEndY - y - 1) * this._cellSize) / 2;
        const index = y * this.cols + x;
        const indices = this.indicesInBlock(
          x,
          y,
          blockEndX,
          blockEndY,
          stateCount
        );
        if (indices.length === 0) {
          continue;
        }
        cells.push({
          position: new Point(posX, posY),
          index,
          indices,
          approximate: aggregate,
        });
        count++;
      }
    }

    return cells;
  }

  qubitCirclePositionAt(index: number): Point {
    const x = index % this.cols;
    const y = Math.floor(index / this.cols);
    const posX = this.padding + x * this._cellSize;
    const posY = this.padding + y * this._cellSize;

    return new Point(posX, posY);
  }

  private update(): void {
    const stateCount = Math.pow(2, this.qubitCount);
    this._cols = Math.pow(2, this._aspectIndex);
    this._rows = Math.ceil(stateCount / this._cols);
    this._padding = this.qubitCircleSizeInPx;
    this.updateQubitCircleMargin();
    this._cellSize = this.qubitCircleSizeInPx + this._qubitCircleMargin;
    const contentWidth = this._cols * this._cellSize - this._qubitCircleMargin;
    this._width = contentWidth + this._padding * 2;
    const contentHeight = this._rows * this._cellSize - this._qubitCircleMargin;
    this._height = contentHeight + this._padding * 2;
  }

  aggregateStride(displayScale: number): number {
    const renderedPitch = this._cellSize * Math.max(0.01, displayScale);
    if (renderedPitch >= StateVectorLayout.AGGREGATE_CELL_PITCH_THRESHOLD) {
      return 1;
    }

    const rawStride = Math.ceil(
      StateVectorLayout.AGGREGATE_CELL_PITCH_THRESHOLD / renderedPitch
    );
    const powerOfTwoStride = Math.pow(2, Math.ceil(Math.log2(rawStride)));
    const maxStride = Math.max(this.cols, this.rows);
    return Math.max(1, Math.min(maxStride, powerOfTwoStride));
  }

  private indicesInBlock(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    stateCount: number
  ): number[] {
    const indices: number[] = [];

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const index = y * this.cols + x;
        if (index < stateCount) {
          indices.push(index);
        }
      }
    }

    return indices;
  }

  private syncAspectIndexWithQubitCount(): void {
    if (this._aspectCustomized) {
      this._aspectIndex = this.clampAspectIndex(this._aspectIndex);
      return;
    }

    this._aspectIndex = stateVectorDefaultAspectIndex(this._qubitCount);
  }

  private clampAspectIndex(value: StateVectorAspectIndex): number {
    return Math.min(this._qubitCount, Math.max(0, Math.round(value)));
  }
}
