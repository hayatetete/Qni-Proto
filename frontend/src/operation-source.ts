import { Colors } from "./colors";
import { Container, Graphics, Point } from "pixi.js";
import { OPERATION_EVENTS } from "./events";
import { OperationClass } from "./operation";
import { need } from "./util";

/**
 * Represents a component that serves as a source for operations (gates) in a quantum circuit.
 * This class is typically placed within an operation palette, allowing users to select and drag
 * operations onto the circuit.
 *
 * Responsibilities include:
 * - Generating new operations when existing ones are dragged out
 * - Managing the initial setup of operations
 * - Handling events related to operation creation, grabbing, and discarding
 * - Maintaining a visual representation of the operation within the palette
 *
 * It extends the PIXI.js Container class to integrate with the rendering system and
 * facilitate drag-and-drop functionality.
 */
export class OperationSource extends Container {
  private static borderColor = Colors["border-inverse"];

  private operationClass: OperationClass;
  private border: Graphics;

  /**
   * Creates a new OperationSourceComponent.
   *
   * @param operationClass The class of operation that this source will generate.
   * This determines the type of quantum gate or operation that can be dragged
   * from this source onto the circuit.
   */
  constructor(operationClass: OperationClass) {
    super();

    this.interactive = true;
    this.operationClass = operationClass;
    this.border = new Graphics();
    this.addChild(this.border);
  }

  /**
   * Generates and sets up a new operation instance.
   *
   * This method creates a new operation of the type specified by the operationClass,
   * sets it up with necessary event listeners and visual elements, and prepares it
   * for use in the quantum circuit.
   *
   * Returns a new instance of the operation, fully set up and ready for use.
   */
  generateNewOperation(): InstanceType<OperationClass> {
    const operation = new this.operationClass();
    this.setupNewOperation(operation);
    return operation;
  }

  private setupNewOperation(operation: InstanceType<OperationClass>): void {
    this.addChild(operation);
    this.setupOperationEventListeners(operation);
    this.drawBorder(operation);
    this.validateBounds(operation);
  }

  private setupOperationEventListeners(
    operation: InstanceType<OperationClass>
  ): void {
    operation.on(OPERATION_EVENTS.GRABBED, this.grabOperation, this);
    operation.on(
      OPERATION_EVENTS.SNAPPED,
      this.removeOperationEventListeners,
      this
    );
    operation.on(OPERATION_EVENTS.DISCARDED, this.discardOperation, this);
    operation.on(
      OPERATION_EVENTS.MOUSE_LEFT,
      this.emitMouseLeaveOperationEvent,
      this
    );
  }

  private drawBorder(operation: InstanceType<OperationClass>): void {
    const width = operation.borderWidth;
    const size = operation.sizeInPx - width;
    const cornerRadius = operation.cornerRadius;
    const color = OperationSource.borderColor;
    const alignment = 1;

    this.border
      .roundRect(width / 2, width / 2, size, size, cornerRadius)
      .stroke({
        color,
        width,
        alignment,
      });
  }

  private validateBounds(operation: InstanceType<OperationClass>): void {
    const bounds = this.getLocalBounds();

    this.validateBoundsSize(bounds, operation);
    this.validateBoundsPosition(bounds);
  }

  private validateBoundsSize(
    bounds: { width: number; height: number },
    operation: InstanceType<OperationClass>
  ): void {
    const expectedSize = operation.sizeInPx;

    need(
      bounds.width === expectedSize && bounds.height === expectedSize,
      `Size is incorrect: ${bounds.width}x${bounds.height}, expected: ${expectedSize}x${expectedSize}`
    );
  }

  private validateBoundsPosition(bounds: { x: number; y: number }): void {
    need(
      bounds.x === 0 && bounds.y === 0,
      `Position is incorrect: (${bounds.x}, ${bounds.y}), expected: (0, 0)`
    );
  }

  private removeOperationEventListeners(
    operation: InstanceType<OperationClass>
  ): void {
    operation.off(OPERATION_EVENTS.GRABBED, this.grabOperation, this);
    operation.off(
      OPERATION_EVENTS.SNAPPED,
      this.removeOperationEventListeners,
      this
    );
    operation.off(
      OPERATION_EVENTS.MOUSE_LEFT,
      this.emitMouseLeaveOperationEvent,
      this
    );
  }

  private emitMouseLeaveOperationEvent(
    operation: InstanceType<OperationClass>
  ): void {
    this.emit(OPERATION_EVENTS.MOUSE_LEFT, operation);
  }

  private grabOperation(
    operation: InstanceType<OperationClass>,
    globalPosition: Point
  ): void {
    this.generateNewOperation();
    this.removeChild(operation);
    this.emit(OPERATION_EVENTS.GRABBED, operation, globalPosition);
  }

  private discardOperation(operation: InstanceType<OperationClass>): void {
    this.removeChild(operation);
    this.emit(OPERATION_EVENTS.DISCARDED, operation);
  }
}
