import { Colors } from "./colors";
import { Container, Graphics } from "pixi.js";
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
  private probabilityCircle: Graphics;
  private border: Graphics;
  private phaseContainer: Container;
  private phaseHand: Graphics;

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

    if (this.probability > 0) {
      this.showPhaseHand();
    }
    this.updatePhaseRotation();
  }

  get size(): Size {
    return this._size;
  }

  set size(newValue: Size) {
    if (this._size === newValue) return;

    this._size = newValue;

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

    const radius = this.calculateProbabilityRadius();

    this.probabilityCircle
      .clear()
      .circle(this.sizeInPx / 2, this.sizeInPx / 2, radius)
      .fill(Colors["bg-brand"]);

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

    if (this.probability === 0) {
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
}
