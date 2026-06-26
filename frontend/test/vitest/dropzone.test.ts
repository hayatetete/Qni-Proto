import { OPERATION_EVENTS } from "../../src/events";
import { Dropzone } from "../../src/dropzone";
import { HGate } from "../../src/h-gate";
import { MeasurementGate } from "../../src/measurement-gate";
import { WireType } from "../../src/types";
import { Write0Gate } from "../../src/write0-gate";
import { Write1Gate } from "../../src/write1-gate";
import { XGate } from "../../src/x-gate";
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("DropzoneComponent", () => {
  let dropzone: Dropzone;

  beforeEach(() => {
    vi.clearAllMocks();
    dropzone = new Dropzone();
  });

  it("should initialize with correct default values", () => {
    expect(dropzone.inputWireType).toBe(WireType.Classical);
    expect(dropzone.outputWireType).toBe(WireType.Classical);
    expect(dropzone.connectTop).toBe(false);
    expect(dropzone.connectBottom).toBe(false);
    expect(dropzone.width).toBe(dropzone.totalSize);
    expect(dropzone.height).toBe(dropzone.totalSize);
  });

  describe("snap and unsnap", () => {
    it("should add gate and emit snap event when snapping", () => {
      const gate = new HGate();
      gate.on = vi.fn();
      const emitSpy = vi.spyOn(dropzone, "emit");

      dropzone.snap(gate);

      expect(gate.on).toHaveBeenCalledWith(
        OPERATION_EVENTS.GRABBED,
        expect.any(Function),
        dropzone
      );
      expect(emitSpy).toHaveBeenCalledWith(OPERATION_EVENTS.SNAPPED, dropzone);
    });

    it("should remove gate listener when unsnapping", () => {
      const gate = new HGate();
      gate.off = vi.fn();

      dropzone.snap(gate);
      dropzone.unsnap();

      expect(gate.off).toHaveBeenCalledWith(
        OPERATION_EVENTS.GRABBED,
        expect.any(Function),
        dropzone
      );
    });
  });

  describe("isOccupied", () => {
    it("should return true when there is an operation", () => {
      const gate = new HGate();
      dropzone.addChild(gate);
      expect(dropzone.isOccupied()).toBe(true);
    });
    it("should return false when there is no operation", () => {
      expect(dropzone.isOccupied()).toBe(false);
    });
  });

  describe("hasWriteGate and hasMeasurementGate", () => {
    it("should return true for Write0Gate", () => {
      const write0Gate = new Write0Gate();
      dropzone.addChild(write0Gate);
      expect(dropzone.hasWriteGate()).toBe(true);
    });

    it("should return true for Write1Gate", () => {
      const write1Gate = new Write1Gate();
      dropzone.addChild(write1Gate);
      expect(dropzone.hasWriteGate()).toBe(true);
    });

    it("should return false for non-write gates", () => {
      const nonWriteGate = new HGate();
      dropzone.addChild(nonWriteGate);
      expect(dropzone.hasWriteGate()).toBe(false);
    });

    it("should return true for MeasurementGate", () => {
      const measurementGate = new MeasurementGate();
      dropzone.addChild(measurementGate);
      expect(dropzone.hasMeasurementGate()).toBe(true);
    });

    it("should return false for non-measurement gates", () => {
      const nonMeasurementGate = new HGate();
      dropzone.addChild(nonMeasurementGate);
      expect(dropzone.hasMeasurementGate()).toBe(false);
    });
  });

  describe("toJSON", () => {
    it('should return "1" when there is no operation', () => {
      expect(dropzone.toJSON()).toBe("1");
    });

    it("should return operation's circuit JSON when there is an operation", () => {
      const xGate = new XGate();
      dropzone.addChild(xGate);
      expect(dropzone.toJSON()).toBe('"X"');
    });
  });
});
