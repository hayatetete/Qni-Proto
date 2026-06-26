import { Container } from "pixi.js";
import { OPERATION_EVENTS } from "../../src/events";
import { OperationClass } from "../../src/operation";
import { OperationSource } from "../../src/operation-source";
import { describe, it, expect, beforeEach, vi } from "vitest";

class MockOperation extends Container {
  borderWidth = 2;
  sizeInPx = 50;
  cornerRadius = 5;
}

describe("OperationSourceComponent", () => {
  let operationSource: OperationSource;

  beforeEach(() => {
    operationSource = new OperationSource(MockOperation as OperationClass);
  });

  it("should create a new operation when generateNewOperation is called", () => {
    const newOperation = operationSource.generateNewOperation();
    const addedOperation = operationSource.children.find(
      (child) => child instanceof MockOperation
    );

    expect(newOperation).toBeInstanceOf(MockOperation);
    expect(addedOperation).toBe(newOperation);
  });

  it("should handle GRABBED event and generate a new operation", () => {
    const operation = operationSource.generateNewOperation();
    const spy = vi.fn();
    operationSource.on(OPERATION_EVENTS.GRABBED, spy);

    operation.emit(OPERATION_EVENTS.GRABBED, operation, { x: 0, y: 0 });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(operation, { x: 0, y: 0 });
  });

  it("should handle DISCARDED event and remove the operation", () => {
    const operation = operationSource.generateNewOperation();
    const spy = vi.fn();
    operationSource.on(OPERATION_EVENTS.DISCARDED, spy);

    operation.emit(OPERATION_EVENTS.DISCARDED, operation);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(operation);
  });
});
