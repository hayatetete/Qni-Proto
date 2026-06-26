import { CircuitStep } from "../../src/circuit-step";
import { ControlGate } from "../../src/control-gate";
import { CIRCUIT_STEP_EVENTS } from "../../src/events";
import { HGate } from "../../src/h-gate";
import { MeasurementGate } from "../../src/measurement-gate";
import { RnotGate } from "../../src/rnot-gate";
import { SDaggerGate } from "../../src/s-dagger-gate";
import { SGate } from "../../src/s-gate";
import { SwapGate } from "../../src/swap-gate";
import { TDaggerGate } from "../../src/t-dagger-gate";
import { TGate } from "../../src/t-gate";
import { Write0Gate } from "../../src/write0-gate";
import { Write1Gate } from "../../src/write1-gate";
import { XGate } from "../../src/x-gate";
import { YGate } from "../../src/y-gate";
import { ZGate } from "../../src/z-gate";
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("CircuitStep", () => {
  let circuitStep: CircuitStep;

  beforeEach(() => {
    circuitStep = new CircuitStep(3);
  });

  describe("height", () => {
    it("has the correct height considering padding", () => {
      const dropzoneHeight = circuitStep.fetchDropzone(0).totalSize;
      const padding = CircuitStep.PADDING;

      expect(circuitStep.height).toEqual(dropzoneHeight * 3 + padding * 2);

      circuitStep.appendNewDropzone();
      expect(circuitStep.height).toEqual(dropzoneHeight * 4 + padding * 2);

      circuitStep.removeLastDropzone();
      circuitStep.removeLastDropzone();
      expect(circuitStep.height).toEqual(dropzoneHeight * 2 + padding * 2);
    });
  });

  describe("wireCount", () => {
    it("returns the correct number of wires", () => {
      expect(circuitStep.wireCount).toBe(3);
    });
  });

  describe("dropzones", () => {
    it("returns all dropzones", () => {
      const dropzones = circuitStep.dropzones;

      expect(dropzones.length).toBe(3);
    });
  });

  describe("isEmpty", () => {
    it("returns true if the circuit step is empty", () => {
      expect(circuitStep.isEmpty).toBe(true);
    });

    it("returns false if the circuit step is not empty", () => {
      const hGate = new HGate();
      circuitStep.fetchDropzone(1).addChild(hGate);

      expect(circuitStep.isEmpty).toBe(false);
    });
  });

  describe("highestOccupiedQubitNumber", () => {
    it("returns 0 if no dropzone has an operation", () => {
      expect(circuitStep.highestOccupiedQubitNumber).toBe(0);
    });

    it("returns the highest number of qubit with an operation", () => {
      const hGate = new HGate();
      circuitStep.fetchDropzone(1).addChild(hGate);

      expect(circuitStep.highestOccupiedQubitNumber).toBe(2);

      const xGate = new XGate();
      circuitStep.fetchDropzone(0).addChild(xGate);
      expect(circuitStep.highestOccupiedQubitNumber).toBe(2);

      const yGate = new YGate();
      circuitStep.fetchDropzone(2).addChild(yGate);
      expect(circuitStep.highestOccupiedQubitNumber).toBe(3);
    });
  });

  describe("fetchDropzone", () => {
    it("returns the dropzone at the specified index", () => {
      const dropzone0 = circuitStep.fetchDropzone(0);
      const dropzone1 = circuitStep.fetchDropzone(1);
      const dropzone2 = circuitStep.fetchDropzone(2);

      expect(dropzone0).toBeDefined();
      expect(dropzone1).toBeDefined();
      expect(dropzone2).toBeDefined();
    });

    it("throws an error if the index is out of bounds", () => {
      expect(() => circuitStep.fetchDropzone(3)).toThrow(
        "Dropzone not found at index 3"
      );
    });
  });

  describe("hasOperationAt", () => {
    it("returns false if the dropzone at the specified index has no operation", () => {
      expect(circuitStep.hasOperationAt(0)).toBe(false);
      expect(circuitStep.hasOperationAt(1)).toBe(false);
      expect(circuitStep.hasOperationAt(2)).toBe(false);
    });

    it("returns true if the dropzone at the specified index has an operation", () => {
      const hGate = new HGate();
      circuitStep.fetchDropzone(1).addChild(hGate);

      expect(circuitStep.hasOperationAt(1)).toBe(true);
    });

    it("throws an error if the index is out of bounds", () => {
      expect(() => circuitStep.hasOperationAt(3)).toThrow(
        "Dropzone not found at index 3"
      );
    });
  });

  describe("appendNewDropzone", () => {
    it("adds a new dropzone to the end of the list", () => {
      const dropzone = circuitStep.appendNewDropzone();

      expect(circuitStep.dropzones.length).toBe(4);
      expect(circuitStep.fetchDropzone(3)).toBe(dropzone);
    });
  });

  describe("removeLastDropzone", () => {
    it("removes the last dropzone from the step", () => {
      circuitStep.removeLastDropzone();
      expect(circuitStep.dropzones.length).toBe(2);

      circuitStep.removeLastDropzone();
      expect(circuitStep.dropzones.length).toBe(1);

      circuitStep.removeLastDropzone();
      expect(circuitStep.dropzones.length).toBe(0);
    });

    it("does nothing if the step is empty", () => {
      circuitStep.removeLastDropzone();
      circuitStep.removeLastDropzone();
      circuitStep.removeLastDropzone();

      expect(() => circuitStep.removeLastDropzone()).not.toThrow();
    });
  });

  describe("isHovered", () => {
    it("returns false if the pointer is not over the circuit step", () => {
      expect(circuitStep.isHovered).toBe(false);
    });

    it("returns true if the pointer is over the circuit step", () => {
      circuitStep["maybeSetHoverState"]();
      expect(circuitStep.isHovered).toBe(true);
    });
  });

  describe("isActive", () => {
    it("returns false if the circuit step is not active", () => {
      expect(circuitStep.isActive).toBe(false);
    });

    it("returns true if the circuit step is active", () => {
      circuitStep.activate();
      expect(circuitStep.isActive).toBe(true);
    });
  });

  describe("activate", () => {
    it("activates the circuit step", () => {
      const eventSpy = vi.spyOn(circuitStep, "emit");

      circuitStep.activate();

      expect(circuitStep.isActive).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith(
        CIRCUIT_STEP_EVENTS.ACTIVATED,
        circuitStep
      );
    });

    it("does nothing if the circuit step is already active", () => {
      circuitStep.activate();

      const eventSpy = vi.spyOn(circuitStep, "emit");
      circuitStep.activate();

      expect(eventSpy).not.toHaveBeenCalled();
    });
  });

  describe("deactivate", () => {
    it("deactivates the circuit step", () => {
      circuitStep.activate();

      circuitStep.deactivate();

      expect(circuitStep.isActive).toBe(false);
    });
  });

  describe("updateConnections", () => {
    it("should update the connections between an X gate and a control gate in the circuit step", () => {
      const xGate = new XGate();
      const controlGate = new ControlGate();

      circuitStep.fetchDropzone(0).addChild(controlGate);
      circuitStep.fetchDropzone(2).addChild(xGate);

      const controlGateDropzone = circuitStep.fetchDropzone(0);
      const middleDropzone = circuitStep.fetchDropzone(1);
      const xGateDropzone = circuitStep.fetchDropzone(2);

      circuitStep.updateConnections();

      expect(xGate.controls).toEqual([0]);
      expect(controlGateDropzone.controlConnectBottom).toBe(true);
      expect(controlGateDropzone.controlConnectTop).toBe(false);
      expect(middleDropzone.controlConnectTop).toBe(true);
      expect(middleDropzone.controlConnectBottom).toBe(true);
      expect(xGateDropzone.controlConnectTop).toBe(true);
      expect(xGateDropzone.controlConnectBottom).toBe(false);
    });

    it("should update the connections between two swap gates in the circuit step", () => {
      const swapGate1 = new SwapGate();
      const swapGate2 = new SwapGate();

      circuitStep.fetchDropzone(0).addChild(swapGate1);
      circuitStep.fetchDropzone(2).addChild(swapGate2);

      const swapGate1Dropzone = circuitStep.fetchDropzone(0);
      const middleDropzone = circuitStep.fetchDropzone(1);
      const swapGate2Dropzone = circuitStep.fetchDropzone(2);

      circuitStep.updateConnections();

      expect(swapGate1Dropzone.swapConnectBottom).toBe(true);
      expect(swapGate1Dropzone.swapConnectTop).toBe(false);
      expect(middleDropzone.swapConnectBottom).toBe(true);
      expect(middleDropzone.swapConnectTop).toBe(true);
      expect(swapGate2Dropzone.swapConnectBottom).toBe(false);
      expect(swapGate2Dropzone.swapConnectTop).toBe(true);
    });
  });

  describe("serialize", () => {
    it("should serialize an empty circuit step", () => {
      expect(circuitStep.serialize()).toEqual([]);
    });

    describe("H Gate", () => {
      it("should serialize a circuit step with a single H gate", () => {
        const hGate = new HGate();

        circuitStep.fetchDropzone(1).addChild(hGate);

        expect(circuitStep.serialize()).toEqual([{ type: "H", targets: [1] }]);
      });

      it("should serialize multiple H gates on different qubits", () => {
        const hGate1 = new HGate();
        const hGate2 = new HGate();

        circuitStep.fetchDropzone(0).addChild(hGate1);
        circuitStep.fetchDropzone(1).addChild(hGate2);

        expect(circuitStep.serialize()).toEqual([
          { type: "H", targets: [0, 1] },
        ]);
      });
    });

    describe("X Gate", () => {
      it("should serialize a single X gate", () => {
        const xGate = new XGate();

        circuitStep.fetchDropzone(1).addChild(xGate);

        expect(circuitStep.serialize()).toEqual([{ type: "X", targets: [1] }]);
      });

      it("should serialize multiple X gates", () => {
        const xGate1 = new XGate();
        const xGate2 = new XGate();

        circuitStep.fetchDropzone(0).addChild(xGate1);
        circuitStep.fetchDropzone(2).addChild(xGate2);

        expect(circuitStep.serialize()).toEqual([
          { type: "X", targets: [0, 2] },
        ]);
      });

      it("should serialize a controlled X gate (CNOT)", () => {
        const xGate = new XGate();
        const controlGate = new ControlGate();

        circuitStep.fetchDropzone(0).addChild(controlGate);
        circuitStep.fetchDropzone(2).addChild(xGate);

        expect(circuitStep.serialize()).toEqual([
          { type: "X", targets: [2], controls: [0] },
        ]);
      });

      it("should serialize a multi-controlled X gate (Toffoli)", () => {
        const xGate = new XGate();
        const controlGate1 = new ControlGate();
        const controlGate2 = new ControlGate();

        circuitStep.fetchDropzone(0).addChild(controlGate1);
        circuitStep.fetchDropzone(1).addChild(controlGate2);
        circuitStep.fetchDropzone(2).addChild(xGate);

        expect(circuitStep.serialize()).toEqual([
          { type: "X", targets: [2], controls: [0, 1] },
        ]);
      });
    });

    describe("Y Gate", () => {
      it("should serialize a single Y gate", () => {
        const yGate = new YGate();
        circuitStep.fetchDropzone(1).addChild(yGate);
        expect(circuitStep.serialize()).toEqual([{ type: "Y", targets: [1] }]);
      });

      it("should serialize multiple Y gates", () => {
        const yGate1 = new YGate();
        const yGate2 = new YGate();
        circuitStep.fetchDropzone(0).addChild(yGate1);
        circuitStep.fetchDropzone(2).addChild(yGate2);
        expect(circuitStep.serialize()).toEqual([
          { type: "Y", targets: [0, 2] },
        ]);
      });
    });

    describe("Z Gate", () => {
      it("should serialize a single Z gate", () => {
        const zGate = new ZGate();

        circuitStep.fetchDropzone(1).addChild(zGate);

        expect(circuitStep.serialize()).toEqual([{ type: "Z", targets: [1] }]);
      });

      it("should serialize multiple Z gates", () => {
        const zGate1 = new ZGate();
        const zGate2 = new ZGate();

        circuitStep.fetchDropzone(0).addChild(zGate1);
        circuitStep.fetchDropzone(2).addChild(zGate2);

        expect(circuitStep.serialize()).toEqual([
          { type: "Z", targets: [0, 2] },
        ]);
      });
    });

    describe("Rnot Gate", () => {
      it("should serialize a single Rnot gate", () => {
        const rnotGate = new RnotGate();

        circuitStep.fetchDropzone(1).addChild(rnotGate);

        expect(circuitStep.serialize()).toEqual([
          { type: "X^½", targets: [1] },
        ]);
      });

      it("should serialize multiple Rnot gates", () => {
        const rnotGate1 = new RnotGate();
        const rnotGate2 = new RnotGate();

        circuitStep.fetchDropzone(0).addChild(rnotGate1);
        circuitStep.fetchDropzone(2).addChild(rnotGate2);

        expect(circuitStep.serialize()).toEqual([
          { type: "X^½", targets: [0, 2] },
        ]);
      });
    });

    describe("S Gate", () => {
      it("should serialize a single S gate", () => {
        const sGate = new SGate();

        circuitStep.fetchDropzone(1).addChild(sGate);

        expect(circuitStep.serialize()).toEqual([{ type: "S", targets: [1] }]);
      });

      it("should serialize multiple S gates", () => {
        const sGate1 = new SGate();
        const sGate2 = new SGate();

        circuitStep.fetchDropzone(0).addChild(sGate1);
        circuitStep.fetchDropzone(2).addChild(sGate2);

        expect(circuitStep.serialize()).toEqual([
          { type: "S", targets: [0, 2] },
        ]);
      });
    });

    describe("S† Gate", () => {
      it("should serialize a single S† gate", () => {
        const sDaggerGate = new SDaggerGate();

        circuitStep.fetchDropzone(1).addChild(sDaggerGate);

        expect(circuitStep.serialize()).toEqual([{ type: "S†", targets: [1] }]);
      });

      it("should serialize multiple S† gates", () => {
        const sDaggerGate1 = new SDaggerGate();
        const sDaggerGate2 = new SDaggerGate();

        circuitStep.fetchDropzone(0).addChild(sDaggerGate1);
        circuitStep.fetchDropzone(2).addChild(sDaggerGate2);

        expect(circuitStep.serialize()).toEqual([
          { type: "S†", targets: [0, 2] },
        ]);
      });
    });

    describe("T Gate", () => {
      it("should serialize a single T gate", () => {
        const tGate = new TGate();

        circuitStep.fetchDropzone(1).addChild(tGate);

        expect(circuitStep.serialize()).toEqual([{ type: "T", targets: [1] }]);
      });

      it("should serialize multiple T gates", () => {
        const tGate1 = new TGate();
        const tGate2 = new TGate();

        circuitStep.fetchDropzone(0).addChild(tGate1);
        circuitStep.fetchDropzone(2).addChild(tGate2);

        expect(circuitStep.serialize()).toEqual([
          { type: "T", targets: [0, 2] },
        ]);
      });
    });

    describe("T† Gate", () => {
      it("should serialize a single T† gate", () => {
        const tDaggerGate = new TDaggerGate();

        circuitStep.fetchDropzone(1).addChild(tDaggerGate);

        expect(circuitStep.serialize()).toEqual([{ type: "T†", targets: [1] }]);
      });

      it("should serialize multiple T† gates", () => {
        const tDaggerGate1 = new TDaggerGate();
        const tDaggerGate2 = new TDaggerGate();

        circuitStep.fetchDropzone(0).addChild(tDaggerGate1);
        circuitStep.fetchDropzone(2).addChild(tDaggerGate2);

        expect(circuitStep.serialize()).toEqual([
          { type: "T†", targets: [0, 2] },
        ]);
      });
    });

    describe("|0> Gate", () => {
      it("should serialize a single |0> gate", () => {
        const write0Gate = new Write0Gate();

        circuitStep.fetchDropzone(1).addChild(write0Gate);

        expect(circuitStep.serialize()).toEqual([
          { type: "|0>", targets: [1] },
        ]);
      });

      it("should serialize multiple |0> gates", () => {
        const write0Gate1 = new Write0Gate();
        const write0Gate2 = new Write0Gate();

        circuitStep.fetchDropzone(0).addChild(write0Gate1);
        circuitStep.fetchDropzone(2).addChild(write0Gate2);

        expect(circuitStep.serialize()).toEqual([
          { type: "|0>", targets: [0, 2] },
        ]);
      });
    });

    describe("|1> Gate", () => {
      it("should serialize a single |1> gate", () => {
        const write1Gate = new Write1Gate();

        circuitStep.fetchDropzone(1).addChild(write1Gate);

        expect(circuitStep.serialize()).toEqual([
          { type: "|1>", targets: [1] },
        ]);
      });

      it("should serialize multiple |1> gates", () => {
        const write1Gate1 = new Write1Gate();
        const write1Gate2 = new Write1Gate();

        circuitStep.fetchDropzone(0).addChild(write1Gate1);
        circuitStep.fetchDropzone(2).addChild(write1Gate2);

        expect(circuitStep.serialize()).toEqual([
          { type: "|1>", targets: [0, 2] },
        ]);
      });
    });

    describe("Swap Gate", () => {
      it("should serialize a single Swap gate", () => {
        const swapGate = new SwapGate();

        circuitStep.fetchDropzone(1).addChild(swapGate);

        expect(circuitStep.serialize()).toEqual([
          { type: "Swap", targets: [1] },
        ]);
      });

      it("should serialize multiple Swap gates", () => {
        const swapGate1 = new SwapGate();
        const swapGate2 = new SwapGate();

        circuitStep.fetchDropzone(0).addChild(swapGate1);
        circuitStep.fetchDropzone(2).addChild(swapGate2);

        expect(circuitStep.serialize()).toEqual([
          { type: "Swap", targets: [0, 2] },
        ]);
      });
    });

    describe("Control Gate", () => {
      it("should serialize a single control gate", () => {
        const controlGate = new ControlGate();

        circuitStep.fetchDropzone(1).addChild(controlGate);

        expect(circuitStep.serialize()).toEqual([{ type: "•", targets: [1] }]);
      });

      it("should serialize multiple control gates", () => {
        const controlGate1 = new ControlGate();
        const controlGate2 = new ControlGate();

        circuitStep.fetchDropzone(0).addChild(controlGate1);
        circuitStep.fetchDropzone(2).addChild(controlGate2);

        expect(circuitStep.serialize()).toEqual([
          { type: "•", targets: [0, 2] },
        ]);
      });
    });

    describe("Measurement Gate", () => {
      it("should serialize a single measurement gate", () => {
        const measurementGate = new MeasurementGate();

        circuitStep.fetchDropzone(1).addChild(measurementGate);

        expect(circuitStep.serialize()).toEqual([
          { type: "Measure", targets: [1] },
        ]);
      });

      it("should serialize multiple measurement gates", () => {
        const measurementGate1 = new MeasurementGate();
        const measurementGate2 = new MeasurementGate();

        circuitStep.fetchDropzone(0).addChild(measurementGate1);
        circuitStep.fetchDropzone(2).addChild(measurementGate2);

        expect(circuitStep.serialize()).toEqual([
          { type: "Measure", targets: [0, 2] },
        ]);
      });
    });

    describe("Multiple Gate Types", () => {
      it("should serialize a circuit step with multiple gates", () => {
        const hGate = new HGate();
        const xGate = new XGate();

        circuitStep.fetchDropzone(0).addChild(hGate);
        circuitStep.fetchDropzone(2).addChild(xGate);

        expect(circuitStep.serialize()).toEqual([
          { type: "H", targets: [0] },
          { type: "X", targets: [2] },
        ]);
      });
    });
  });
});
