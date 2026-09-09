import { Colors } from "./colors";
import { Circle, Container, FederatedPointerEvent, Graphics } from "pixi.js";
import { Size } from "./size";
import { Spacing } from "./spacing";

function need(
  condition: boolean,
  message: string,
  errorInfo?: Record<string, unknown>
): asserts condition {
  if (!condition) {
    const errorMessage = Object.entries(errorInfo || {}).reduce(
      (msg, [key, value]) => msg.replace(`{${key}}`, String(value)),
      message
    );
    throw new Error(errorMessage);
  }
}

export class QubitCircle extends Container {
  private _probability = 0;
  private _phase = 0;
  private _size: Size = "xl";
  private _displayScale = 1;
  private _approximate = false;
  private probabilityCircle: Graphics;
  private border: Graphics;
  private phaseContainer: Container;
  private phaseHand: Graphics;
  private basisIndex = 0;
  private qubitCount = 1;
  private amplitude: [number, number] = [0, 0];
  private selected = false;

  constructor(size: Size = "xl") {
    super();

    this.probabilityCircle = new Graphics();
    this.phaseContainer = new Container();
    this.border = new Graphics();
    this.phaseHand = new Graphics();

    this.size = size;

    this.initializeGraphics();
    this.updateProbabilityCircle();
    this.updateBorder();
    this.updatePhaseHand();
    this.updatePhaseRotation();
    this.eventMode = "static";
    this.cursor = "default";
    this.updateHitArea();
    this.on("pointerenter", this.showDetails, this)
      .on("pointerleave", this.hideDetails, this)
      .on("pointerdown", this.dismissDetails, this)
      .on("pointerup", this.showDetails, this);
  }

  setBasisState(
    basisIndex: number,
    qubitCount: number,
    amplitude: [number, number] = this.amplitude,
  ): void {
    this.basisIndex = basisIndex;
    this.qubitCount = qubitCount;
    this.amplitude = amplitude;
  }

  private showDetails(event: FederatedPointerEvent): void {
    const inspectionPanel = document.getElementById("qni-inspection-panel");
    if (inspectionPanel && !inspectionPanel.classList.contains("hidden")) {
      this.dismissDetails();
      return;
    }
    this.selected = true;
    this.updateProbabilityCircle();
    this.updateBorder();
    const canvas = event.nativeEvent.target as HTMLCanvasElement;
    const canvasRect = canvas.getBoundingClientRect();
    const bounds = this.getBounds();
    window.dispatchEvent(
      new CustomEvent("qni-state-cell-hover", {
        detail: {
          index: this.basisIndex,
          qubitCount: this.qubitCount,
          amplitude: this.amplitude,
          anchorX: canvasRect.left + bounds.x + bounds.width / 2,
          anchorY: canvasRect.top + bounds.y + bounds.height / 2,
          anchorRadius: bounds.height / 2,
        },
      }),
    );
  }

  private hideDetails(): void {
    this.selected = false;
    this.updateProbabilityCircle();
    this.updateBorder();
    window.dispatchEvent(new Event("qni-state-cell-leave"));
  }

  private dismissDetails(): void {
    this.selected = false;
    this.updateProbabilityCircle();
    this.updateBorder();
    window.dispatchEvent(new Event("qni-state-cell-dismiss"));
  }

  get probability(): number {
    return parseFloat(this._probability.toFixed(4));
  }

  set probability(newValue: number) {
    need(
      0 <= newValue && newValue <= 100,
      "Probability must be between 0 and 100. Received value: {newValue}",
      { newValue }
    );

    if (this._probability === newValue) return;

    this._probability = newValue;

    this.updateProbabilityCircle();
    this.updateBorder();
    this.updatePhaseHand();
    this.updatePhaseRotation();
  }

  get phase(): number {
    return this._phase;
  }

  set phase(newValue: number) {
    need(
      -2 * Math.PI <= newValue && newValue <= 2 * Math.PI,
      `Phase must be between -2π and 2π. Received: ${newValue}`
    );

    if (this._phase === newValue) return;

    this._phase = newValue;

    this.updatePhaseHand();
    this.updatePhaseRotation();
  }

  get size(): Size {
    return this._size;
  }

  set size(newValue: Size) {
    if (this._size === newValue) return;

    this._size = newValue;

    this.updateHitArea();
    this.updateProbabilityCircle();
    this.updateBorder();
    this.updatePhaseHand();
  }

  set displayScale(newValue: number) {
    const clamped = Math.max(0.01, newValue);
    if (Math.abs(this._displayScale - clamped) < 0.001) return;

    this._displayScale = clamped;
    this.updateProbabilityCircle();
    this.updateBorder();
    this.updatePhaseHand();
  }

  set approximate(newValue: boolean) {
    if (this._approximate === newValue) return;

    this._approximate = newValue;
    this.updateProbabilityCircle();
    this.updateBorder();
    this.updatePhaseHand();
  }

  private initializeGraphics(): void {
    this.addChild(this.probabilityCircle);
    this.addChild(this.phaseContainer);
    this.phaseContainer.addChild(this.border);
    this.phaseContainer.addChild(this.phaseHand);

    this.hideProbabilityCircle();
    this.hidePhaseHand();
  }

  // probability circle methods

  private updateProbabilityCircle(): void {
    if (this.probability === 0) {
      this.hideProbabilityCircle();
      return;
    }

    if (this.shouldUseCompactApproximation()) {
      this.probabilityCircle
        .clear()
        .circle(this.sizeInPx / 2, this.sizeInPx / 2, this.sizeInPx / 2)
        .fill({
          color: this.probabilityColor(),
          alpha: Math.max(
            this._approximate ? 0.12 : 0.08,
            this.probability / 100
          ),
        });

      this.showProbabilityCircle();
      return;
    }

    const radius = this.calculateProbabilityRadius();

    this.probabilityCircle
      .clear()
      .circle(this.sizeInPx / 2, this.sizeInPx / 2, radius)
      .fill(this.probabilityColor());

    this.showProbabilityCircle();
  }

  private calculateProbabilityRadius(): number {
    need(
      this.probability >= 0 && this.probability <= 100,
      `Invalid probability: ${this.probability}`
    );
    need(this.sizeInPx > 0, `Invalid size: ${this.sizeInPx}`);

    const probability_scale_factor = 0.01;

    return (
      (this.sizeInPx / 2 - Spacing.borderWidth.qubitCircle[this._size]) *
      Math.sqrt(this.probability * probability_scale_factor)
    );
  }

  private showProbabilityCircle(): void {
    this.probabilityCircle.alpha = 1;
  }

  private hideProbabilityCircle(): void {
    this.probabilityCircle.alpha = 0.01;
  }

  // border methods

  private updateBorder(): void {
    if (this.renderedSizeInPx < 10 || this._approximate) {
      this.border.clear();
      return;
    }

    this.border
      .clear()
      .circle(this.sizeInPx / 2, this.sizeInPx / 2, this.sizeInPx / 2)
      .stroke({
        width: Spacing.borderWidth.qubitCircle[this._size],
        color: this.borderColor(),
        alignment: 1,
      });
  }

  private borderColor(): string {
    if (this.selected) return Colors["border-component-selected"];
    return this.probability === 0
      ? Colors["border-component-strong-disabled"]
      : Colors["border-component-strong"];
  }

  // Phase container methods

  private updatePhaseRotation(): void {
    this.phaseContainer.pivot.set(this.sizeInPx / 2, this.sizeInPx / 2);
    this.phaseContainer.x = this.sizeInPx / 2;
    this.phaseContainer.y = this.sizeInPx / 2;
    this.phaseContainer.rotation = -this._phase;
  }

  // Phase hand methods

  private updatePhaseHand(): void {
    need(this.handLength > 0, `Invalid hand length: ${this.handLength}`);

    if (
      this.probability === 0 ||
      this.renderedSizeInPx < 12 ||
      this._approximate ||
      this.shouldUseCompactApproximation()
    ) {
      this.hidePhaseHand();
      return;
    }

    const thickness = Spacing.width.qubitCircle.phaseHand[this.size];

    this.phaseHand
      .clear()
      .rect(0, 0, thickness, this.handLength)
      .fill(Colors["text"]);
    this.phaseHand.x = this.sizeInPx / 2 - thickness / 2;
    this.phaseHand.y = 0;

    this.showPhaseHand();
  }

  private showPhaseHand(): void {
    this.phaseHand.alpha = 1;
  }

  private hidePhaseHand(): void {
    this.phaseHand.alpha = 0.01;
  }

  private get handLength(): number {
    return this.sizeInPx / 2;
  }

  // Misc. methods

  private get sizeInPx(): number {
    const size = Spacing.size.qubitCircle[this._size];

    need(size > 0, `Invalid size for ${this._size}: ${size}`);

    return size;
  }

  private get renderedSizeInPx(): number {
    return this.sizeInPx * this._displayScale;
  }

  private probabilityColor(): string {
    return this.selected ? Colors["bg-brand-hover"] : Colors["bg-brand"];
  }

  private updateHitArea(): void {
    const radius = this.sizeInPx / 2;
    this.hitArea = new Circle(radius, radius, radius);
  }

  private shouldUseCompactApproximation(): boolean {
    return this.renderedSizeInPx < 8;
  }
}
