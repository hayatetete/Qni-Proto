import { Circuit } from "./circuit";
import { CIRCUIT_STEP_EVENTS, OPERATION_EVENTS } from "./events";
import { CircuitStep } from "./circuit-step";
import { Colors } from "./colors";
import { Container, Graphics, Point, Sprite, Texture } from "pixi.js";
import { OperationClass } from "./operation";
import { OperationPalette } from "./operation-palette";

const OPERATION_PALETTE_X = 40;
const OPERATION_PALETTE_Y = 64;

export class CircuitFrame extends Container {
  private static instance: CircuitFrame | null = null;

  readonly operationPalette: OperationPalette;
  readonly circuit: Circuit;

  private readonly background: Graphics;
  private readonly maskSprite: Sprite;
  private readonly scrollContainer: Container;

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

    this.resize(width, height);
    this.initOperationPalette();
    this.initCircuit();

    this.initScrollEvents();
  }

  resize(width: number, height: number): void {
    this.background.clear().rect(0, 0, width, height).fill(Colors["bg"]);
    this.updateMask(width, height);
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
    this.circuit.y =
      OPERATION_PALETTE_Y + this.operationPalette.height + OPERATION_PALETTE_Y;

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
  }

  private updateMask(width: number, height: number): void {
    this.maskSprite.width = width;
    this.maskSprite.height = height;
    this.maskSprite.x = 0;
    this.maskSprite.y = 0;
  }

  private handleScroll(event: WheelEvent): void {
    if (this.circuit.y + this.circuit.height + 128 <= this.maskSprite.height) {
      return;
    }

    const deltaY = event.deltaY;
    this.scrollContainer.y -= deltaY;

    // スクロール範囲の制限
    if (this.scrollContainer.y > 0) {
      this.scrollContainer.y = 0;
    }

    const maxScrollY =
      this.circuit.height +
      this.operationPalette.height +
      256 -
      this.maskSprite.height;
    if (this.scrollContainer.y < -maxScrollY) {
      this.scrollContainer.y = -maxScrollY;
    }
  }
}
