import { Rectangle, Container } from "pixi.js";
import { QubitCircle } from "./qubit-circle";
import { QubitCount } from "./types";
import { STATE_VECTOR_EVENTS } from "./state-vector-events";
import { StateVectorRenderer } from "./state-vector-renderer";
import { MAX_QUBIT_COUNT, MIN_QUBIT_COUNT } from "./constants";

class InvalidQubitCountError extends Error {
  constructor(value: QubitCount) {
    super(`Invalid qubit count: ${value}. Must not exceed ${MAX_QUBIT_COUNT}.`);
    this.name = "InvalidQubitCountError";
  }
}

export interface StateVectorConfig {
  initialQubitCount: QubitCount;
  viewport: Rectangle;
}

/**
 * Represents a component that visualizes the state vector.
 */
export class StateVectorComponent extends Container {
  private _qubitCount: QubitCount = MIN_QUBIT_COUNT;
  private renderer: StateVectorRenderer;

  set qubitCount(newValue: QubitCount) {
    const validatedCount = this.validateQubitCount(newValue);

    if (this._qubitCount !== validatedCount || newValue === MIN_QUBIT_COUNT) {
      this._qubitCount = validatedCount;
      this.updateStateVector();
    }
  }

  get qubitCount() {
    return this._qubitCount;
  }

  get qubitCircleCount() {
    return Math.pow(2, this.qubitCount);
  }

  get visibleQubitCircleIndices() {
    return this.renderer.visibleQubitCircleIndices;
  }

  constructor(config: StateVectorConfig) {
    super();

    this.renderer = new StateVectorRenderer(
      this,
      config.initialQubitCount,
      config.viewport
    );
    this.qubitCount = config.initialQubitCount;
    this.setViewport(config.viewport);
  }

  setViewport(viewport: Rectangle) {
    const visibleQubitCirclesChanged = this.renderer.setViewport(viewport);

    if (visibleQubitCirclesChanged) {
      this.emitVisibleQubitCirclesChanged();
    }
  }

  qubitCircleAt(index: number): QubitCircle | undefined {
    return this.renderer.qubitCircleAt(index);
  }

  private validateQubitCount(value: QubitCount): QubitCount {
    if (value < MIN_QUBIT_COUNT || value > MAX_QUBIT_COUNT) {
      throw new InvalidQubitCountError(value);
    }
    return value;
  }

  private updateStateVector(): void {
    this.updateRendererLayout();
    this.redrawStateVector();
    this.notifyQubitCountChange();
  }

  private updateRendererLayout(): void {
    this.renderer.updateQubitCircleLayout(this._qubitCount);
  }

  private redrawStateVector(): void {
    this.renderer.draw();
  }

  private notifyQubitCountChange(): void {
    this.emit(STATE_VECTOR_EVENTS.QUBIT_COUNT_CHANGED, this.qubitCount);
  }

  private emitVisibleQubitCirclesChanged() {
    this.emit(
      STATE_VECTOR_EVENTS.VISIBLE_QUBIT_CIRCLES_CHANGED,
      this.visibleQubitCircleIndices
    );
  }
}
