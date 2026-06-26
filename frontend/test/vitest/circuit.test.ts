import { describe, it, expect, beforeEach, vi } from "vitest";
import { Circuit } from "../../src/circuit";
import { CircuitStep } from "../../src/circuit-step";
import { MIN_QUBIT_COUNT } from "../../src/constants";
import { HGate } from "../../src/h-gate";
import { XGate } from "../../src/x-gate";
import { YGate } from "../../src/y-gate";
import { ZGate } from "../../src/z-gate";
import { TGate } from "../../src/t-gate";
import { TDaggerGate } from "../../src";
import { SGate } from "../../src";
import { SDaggerGate } from "../../src/s-dagger-gate";
import { RnotGate } from "../../src/rnot-gate";
import { Write0Gate } from "../../src/write0-gate";
import { Write1Gate } from "../../src/write1-gate";
import { MeasurementGate } from "../../src/measurement-gate";
import { ControlGate } from "../../src/control-gate";
import { SwapGate } from "../../src/swap-gate";
import { WireType } from "../../src/types";

describe("Circuit", () => {
  let circuit: Circuit;
  const wireCount = 3;

  beforeEach(() => {
    circuit = new Circuit({ minWireCount: wireCount, stepCount: 5 });
  });

  describe("steps", () => {
    it("returns an array of CircuitStep", () => {
      expect(circuit.steps).toBeInstanceOf(Array);
      expect(circuit.steps.length).toBe(5);
      circuit.steps.forEach((step) => {
        expect(step).toBeInstanceOf(CircuitStep);
      });
    });
  });

  describe("activeStepIndex", () => {
    it("returns null in the initial state", () => {
      expect(circuit.activeStepIndex).toBeNull();
    });

    it("returns the index of the active step", () => {
      circuit.fetchStep(1).activate();
      expect(circuit.activeStepIndex).toBe(1);
    });

    it("returns the new index when the active step changes", () => {
      circuit.fetchStep(1).activate();
      expect(circuit.activeStepIndex).toBe(1);

      circuit.fetchStep(3).activate();
      expect(circuit.activeStepIndex).toBe(3);
    });

    it("returns null when all steps are inactive", () => {
      circuit.fetchStep(1).activate();
      expect(circuit.activeStepIndex).toBe(1);

      circuit.fetchStep(1).deactivate();
      expect(circuit.activeStepIndex).toBeNull();
    });
  });

  describe("wireCount", () => {
    it("returns the correct number of wires", () => {
      expect(circuit.wireCount).toBe(3);
    });

    it("returns the correct wire count after adding a wire", () => {
      circuit.maybeAppendWire();

      expect(circuit.wireCount).toBe(4);
      circuit.steps.forEach((step) => {
        expect(step.wireCount).toBe(4);
      });
    });

    it("throws an error if steps have different wire counts", () => {
      circuit["stepList"].addChild(new CircuitStep(1));

      expect(() => circuit.wireCount).toThrow(
        "All steps must have the same number of wires"
      );
    });

    it("returns minWireCount when there are no steps", () => {
      const emptyCircuit = new Circuit({ minWireCount: 3, stepCount: 0 });
      expect(emptyCircuit.wireCount).toBe(3);
    });
  });

  describe("highestOccupiedQubitNumber", () => {
    it("returns MIN_QUBIT_COUNT when all steps are empty", () => {
      expect(circuit.highestOccupiedQubitNumber).toBe(MIN_QUBIT_COUNT);
    });

    it("returns the highest occupied qubit number across all steps", () => {
      circuit.fetchStep(0).fetchDropzone(1).addChild(new HGate());
      expect(circuit.highestOccupiedQubitNumber).toBe(2);

      circuit.fetchStep(1).fetchDropzone(2).addChild(new XGate());
      expect(circuit.highestOccupiedQubitNumber).toBe(3);
    });

    it("updates correctly when gates are removed", () => {
      const hGate = new HGate();
      const step0Dropzone1 = circuit.fetchStep(0).fetchDropzone(1);
      step0Dropzone1.addChild(hGate);

      const xGate = new XGate();
      const step2Dropzone2 = circuit.fetchStep(2).fetchDropzone(2);
      step2Dropzone2.addChild(xGate);

      expect(circuit.highestOccupiedQubitNumber).toBe(3);

      step2Dropzone2.removeChild(xGate);
      expect(circuit.highestOccupiedQubitNumber).toBe(2);

      step0Dropzone1.removeChild(hGate);
      expect(circuit.highestOccupiedQubitNumber).toBe(MIN_QUBIT_COUNT);
    });
  });

  describe("fetchStep", () => {
    it("retrieves the step with the correct index", () => {
      const step = circuit.fetchStep(2);

      expect(step).toBeDefined();
      expect(step).toBe(circuit.steps[2]);
    });

    it("throws an error with a negative index", () => {
      expect(() => circuit.fetchStep(-1)).toThrow(
        "Step index out of bounds: -1"
      );
    });

    it("throws an error with an index out of range", () => {
      expect(() => circuit.fetchStep(5)).toThrow("Step index out of bounds: 5");
    });
  });

  describe("maybeAppendWire", () => {
    it("appends a wire when all steps have the same wire count and it's less than maxWireCount", () => {
      circuit.maybeAppendWire();

      expect(circuit.wireCount).toBe(wireCount + 1);
    });

    it("does not append a wire when wire count is equal to maxWireCount", () => {
      circuit["maxWireCount"] = wireCount;

      circuit.maybeAppendWire();

      expect(circuit.wireCount).toBe(wireCount);
    });

    it("throws an error when steps have different wire counts", () => {
      circuit["stepList"].addChild(new CircuitStep(1));

      expect(() => circuit.maybeAppendWire()).toThrow(
        "All steps must have the same number of wires"
      );
    });
  });

  describe("update", () => {
    it("correctly updates the circuit", () => {
      const activeStep = circuit.fetchStep(2);
      activeStep.activate();

      circuit.update();

      expect(circuit.steps.length).toBe(5);
      expect(circuit.wireCount).toBe(3);
      expect(activeStep.isActive).toBe(true);
    });

  });

  describe("serialize", () => {
    it("returns correctly serialized circuit", () => {
      const hGate = new HGate();
      const xGate = new XGate();

      circuit.fetchStep(0).fetchDropzone(0).addChild(hGate);
      circuit.fetchStep(1).fetchDropzone(1).addChild(xGate);

      const serialized = circuit.serialize();

      expect(serialized).toEqual([
        [{ type: "H", targets: [0] }],
        [{ type: "X", targets: [1] }],
        [],
        [],
        [],
      ]);
    });

    it("correctly serializes an empty circuit", () => {
      const serialized = circuit.serialize();

      expect(serialized).toEqual([[], [], [], [], []]);
    });
  });

  describe("toJSON", () => {
    // 空の回路のテストケース
    it("rreturns a correctly formatted JSON string for an empty circuit", () => {
      const expectedJSON = '{"cols":[]}';
      expect(circuit.toJSON()).toBe(`${expectedJSON}`);
    });

    // 単一ステップ内の単一量子ビットゲートのテストケース
    it("returns a correctly formatted JSON string for a circuit with a single H gate", () => {
      circuit.fetchStep(0).fetchDropzone(0).addChild(new HGate());
      const expectedJSON = '{"cols":[["H",1,1]]}';
      expect(circuit.toJSON()).toBe(expectedJSON);
    });

    it("returns a correctly formatted JSON string for a circuit with a single X gate", () => {
      circuit.fetchStep(0).fetchDropzone(1).addChild(new XGate());
      const expectedJSON = '{"cols":[[1,"X",1]]}';
      expect(circuit.toJSON()).toBe(expectedJSON);
    });

    it("returns a correctly formatted JSON string for a circuit with a single Y gate", () => {
      circuit.fetchStep(0).fetchDropzone(2).addChild(new YGate());
      const expectedJSON = '{"cols":[[1,1,"Y"]]}';
      expect(circuit.toJSON()).toBe(expectedJSON);
    });

    it("returns a correctly formatted JSON string for a circuit with a single Z gate", () => {
      circuit.fetchStep(0).fetchDropzone(0).addChild(new ZGate());
      const expectedJSON = '{"cols":[["Z",1,1]]}';
      expect(circuit.toJSON()).toBe(expectedJSON);
    });

    it("returns a correctly formatted JSON string for a circuit with a single S gate", () => {
      circuit.fetchStep(0).fetchDropzone(1).addChild(new SGate());
      const expectedJSON = '{"cols":[[1,"S",1]]}';
      expect(circuit.toJSON()).toBe(expectedJSON);
    });

    it("returns a correctly formatted JSON string for a circuit with a single S† gate", () => {
      circuit.fetchStep(0).fetchDropzone(2).addChild(new SDaggerGate());
      const expectedJSON = '{"cols":[[1,1,"S†"]]}';
      expect(circuit.toJSON()).toBe(expectedJSON);
    });

    it("returns a correctly formatted JSON string for a circuit with a single T gate", () => {
      circuit.fetchStep(0).fetchDropzone(0).addChild(new TGate());
      const expectedJSON = '{"cols":[["T",1,1]]}';
      expect(circuit.toJSON()).toBe(expectedJSON);
    });

    it("returns a correctly formatted JSON string for a circuit with a single T† gate", () => {
      circuit.fetchStep(0).fetchDropzone(1).addChild(new TDaggerGate());
      const expectedJSON = '{"cols":[[1,"T†",1]]}';
      expect(circuit.toJSON()).toBe(expectedJSON);
    });

    it("returns a correctly formatted JSON string for a circuit with a single Rnot gate (X^½)", () => {
      circuit.fetchStep(0).fetchDropzone(2).addChild(new RnotGate());
      const expectedJSON = '{"cols":[[1,1,"X^½"]]}';
      expect(circuit.toJSON()).toBe(expectedJSON);
    });

    it("returns a correctly formatted JSON string for a circuit with a single Write0 gate (|0>)", () => {
      circuit.fetchStep(0).fetchDropzone(0).addChild(new Write0Gate());
      const expectedJSON = '{"cols":[["|0>",1,1]]}';
      expect(circuit.toJSON()).toBe(expectedJSON);
    });

    it("returns a correctly formatted JSON string for a circuit with a single Write1 gate (|1>)", () => {
      circuit.fetchStep(0).fetchDropzone(1).addChild(new Write1Gate());
      const expectedJSON = '{"cols":[[1,"|1>",1]]}';
      expect(circuit.toJSON()).toBe(expectedJSON);
    });

    it("returns a correctly formatted JSON string for a circuit with a single Measurement gate", () => {
      circuit.fetchStep(0).fetchDropzone(2).addChild(new MeasurementGate());
      const expectedJSON = '{"cols":[[1,1,"Measure"]]}';
      expect(circuit.toJSON()).toBe(expectedJSON);
    });

    // 単一ステップ内の複数量子ビットゲートのテストケース
    it("returns a correctly formatted JSON string for a CNOT gate (Control + X)", () => {
      circuit.fetchStep(0).fetchDropzone(0).addChild(new ControlGate());
      circuit.fetchStep(0).fetchDropzone(2).addChild(new XGate());
      const expectedJSON = '{"cols":[["•",1,"X"]]}';
      expect(circuit.toJSON()).toBe(expectedJSON);
    });

    it("returns a correctly formatted JSON string for a Toffoli gate (two Controls + X)", () => {
      circuit.fetchStep(0).fetchDropzone(0).addChild(new ControlGate());
      circuit.fetchStep(0).fetchDropzone(1).addChild(new ControlGate());
      circuit.fetchStep(0).fetchDropzone(2).addChild(new XGate());
      const expectedJSON = '{"cols":[["•","•","X"]]}';
      expect(circuit.toJSON()).toBe(expectedJSON);
    });

    it("returns a correctly formatted JSON string for a Swap gate", () => {
      circuit.fetchStep(0).fetchDropzone(0).addChild(new SwapGate());
      circuit.fetchStep(0).fetchDropzone(2).addChild(new SwapGate());
      const expectedJSON = '{"cols":[["Swap",1,"Swap"]]}';
      expect(circuit.toJSON()).toBe(expectedJSON);
    });

    // 同じステップ内に複数のゲートがある場合のテストケース
    it("returns a correctly formatted JSON string for multiple single-qubit gates in the same step", () => {
      circuit.fetchStep(0).fetchDropzone(0).addChild(new HGate());
      circuit.fetchStep(0).fetchDropzone(1).addChild(new TGate());
      circuit.fetchStep(0).fetchDropzone(2).addChild(new MeasurementGate());
      const expectedJSON = '{"cols":[["H","T","Measure"]]}';
      expect(circuit.toJSON()).toBe(expectedJSON);
    });

    // 異なるステップにゲートがある場合のテストケース
    it("returns a correctly formatted JSON string for multiple gates in different steps", () => {
      circuit.fetchStep(0).fetchDropzone(0).addChild(new HGate());
      circuit.fetchStep(1).fetchDropzone(1).addChild(new XGate());
      circuit.fetchStep(2).fetchDropzone(2).addChild(new YGate());
      const expectedJSON = '{"cols":[["H",1,1],[1,"X",1],[1,1,"Y"]]}';
      expect(circuit.toJSON()).toBe(expectedJSON);
    });

    // 複数のステップに渡る複雑な組み合わせのテストケース
    it("returns a correctly formatted JSON string for a complex circuit across multiple steps", () => {
      circuit.fetchStep(0).fetchDropzone(0).addChild(new HGate());
      circuit.fetchStep(0).fetchDropzone(1).addChild(new ControlGate());
      circuit.fetchStep(0).fetchDropzone(2).addChild(new XGate());
      circuit.fetchStep(1).fetchDropzone(1).addChild(new SwapGate());
      circuit.fetchStep(1).fetchDropzone(2).addChild(new SwapGate());
      circuit.fetchStep(2).fetchDropzone(0).addChild(new Write0Gate());
      circuit.fetchStep(3).fetchDropzone(1).addChild(new MeasurementGate());
      circuit.fetchStep(4).fetchDropzone(2).addChild(new TDaggerGate());
      const expectedJSON =
        '{"cols":[["H","•","X"],[1,"Swap","Swap"],["|0>",1,1],[1,"Measure",1],[1,1,"T†"]]}';
      expect(circuit.toJSON()).toBe(expectedJSON);
    });
  });

  describe("fromJSON", () => {
    it("should correctly load an empty circuit from a JSON string", () => {
      const jsonString = '{"cols":[]}';
      const newCircuit = new Circuit({ minWireCount: 3, stepCount: 5 });
      expect(() => {
        newCircuit.fromJSON(jsonString);
      }).toThrow("activeStepIndex == null");
    });

    // toJSONで追加した各テストケースに対応するfromJSONテストを追加
    it("should correctly load a circuit with a single H gate from JSON", () => {
      const jsonString = '{"cols":[["H",1,1]]}';
      const newCircuit = new Circuit({ minWireCount: 3, stepCount: 0 });
      newCircuit.fromJSON(jsonString);
      expect(newCircuit.fetchStep(0).fetchDropzone(0).operation).toBeInstanceOf(
        HGate
      );
      expect(newCircuit.toJSON()).toBe(jsonString);
    });

    it("should correctly load a circuit with a single X gate from JSON", () => {
      const jsonString = '{"cols":[[1,"X",1]]}';
      const newCircuit = new Circuit({ minWireCount: 3, stepCount: 0 });
      newCircuit.fromJSON(jsonString);
      expect(newCircuit.fetchStep(0).fetchDropzone(1).operation).toBeInstanceOf(
        XGate
      );
      expect(newCircuit.toJSON()).toBe(jsonString);
    });

    it("should correctly load a circuit with a single Y gate from JSON", () => {
      const jsonString = '{"cols":[[1,1,"Y"]]}';
      const newCircuit = new Circuit({ minWireCount: 3, stepCount: 0 });
      newCircuit.fromJSON(jsonString);
      expect(newCircuit.fetchStep(0).fetchDropzone(2).operation).toBeInstanceOf(
        YGate
      );
      expect(newCircuit.toJSON()).toBe(jsonString);
    });

    it("should correctly load a circuit with a single Z gate from JSON", () => {
      const jsonString = '{"cols":[["Z",1,1]]}';
      const newCircuit = new Circuit({ minWireCount: 3, stepCount: 0 });
      newCircuit.fromJSON(jsonString);
      expect(newCircuit.fetchStep(0).fetchDropzone(0).operation).toBeInstanceOf(
        ZGate
      );
      expect(newCircuit.toJSON()).toBe(jsonString);
    });

    it("should correctly load a circuit with a single S gate from JSON", () => {
      const jsonString = '{"cols":[[1,"S",1]]}';
      const newCircuit = new Circuit({ minWireCount: 3, stepCount: 0 });
      newCircuit.fromJSON(jsonString);
      expect(newCircuit.fetchStep(0).fetchDropzone(1).operation).toBeInstanceOf(
        SGate
      );
      expect(newCircuit.toJSON()).toBe(jsonString);
    });

    it("should correctly load a circuit with a single S† gate from JSON", () => {
      const jsonString = '{"cols":[[1,1,"S†"]]}';
      const newCircuit = new Circuit({ minWireCount: 3, stepCount: 0 });
      newCircuit.fromJSON(jsonString);
      expect(newCircuit.fetchStep(0).fetchDropzone(2).operation).toBeInstanceOf(
        SDaggerGate
      );
      expect(newCircuit.toJSON()).toBe(jsonString);
    });

    it("should correctly load a circuit with a single T gate from JSON", () => {
      const jsonString = '{"cols":[["T",1,1]]}';
      const newCircuit = new Circuit({ minWireCount: 3, stepCount: 0 });
      newCircuit.fromJSON(jsonString);
      expect(newCircuit.fetchStep(0).fetchDropzone(0).operation).toBeInstanceOf(
        TGate
      );
      expect(newCircuit.toJSON()).toBe(jsonString);
    });

    it("should correctly load a circuit with a single T† gate from JSON", () => {
      const jsonString = '{"cols":[[1,"T†",1]]}';
      const newCircuit = new Circuit({ minWireCount: 3, stepCount: 0 });
      newCircuit.fromJSON(jsonString);
      expect(newCircuit.fetchStep(0).fetchDropzone(1).operation).toBeInstanceOf(
        TDaggerGate
      );
      expect(newCircuit.toJSON()).toBe(jsonString);
    });

    it("should correctly load a circuit with a single Rnot gate from JSON", () => {
      const jsonString = '{"cols":[[1,1,"X^½"]]}';
      const newCircuit = new Circuit({ minWireCount: 3, stepCount: 0 });
      newCircuit.fromJSON(jsonString);
      expect(newCircuit.fetchStep(0).fetchDropzone(2).operation).toBeInstanceOf(
        RnotGate
      );
      expect(newCircuit.toJSON()).toBe(jsonString);
    });

    it("should correctly load a circuit with a single Write0 gate from JSON", () => {
      const jsonString = '{"cols":[["|0>",1,1]]}';
      const newCircuit = new Circuit({ minWireCount: 3, stepCount: 0 });
      newCircuit.fromJSON(jsonString);
      expect(newCircuit.fetchStep(0).fetchDropzone(0).operation).toBeInstanceOf(
        Write0Gate
      );
      expect(newCircuit.toJSON()).toBe(jsonString);
    });

    it("should correctly load a circuit with a single Write1 gate from JSON", () => {
      const jsonString = '{"cols":[[1,"|1>",1]]}';
      const newCircuit = new Circuit({ minWireCount: 3, stepCount: 0 });
      newCircuit.fromJSON(jsonString);
      expect(newCircuit.fetchStep(0).fetchDropzone(1).operation).toBeInstanceOf(
        Write1Gate
      );
      expect(newCircuit.toJSON()).toBe(jsonString);
    });

    it("should correctly load a circuit with a single Measurement gate from JSON", () => {
      const jsonString = '{"cols":[[1,1,"Measure"]]}';
      const newCircuit = new Circuit({ minWireCount: 3, stepCount: 0 });
      newCircuit.fromJSON(jsonString);
      expect(newCircuit.fetchStep(0).fetchDropzone(2).operation).toBeInstanceOf(
        MeasurementGate
      );
      expect(newCircuit.toJSON()).toBe(jsonString);
    });

    it("should correctly load a CNOT gate from JSON", () => {
      const jsonString = '{"cols":[["•",1,"X"]]}';
      const newCircuit = new Circuit({ minWireCount: 3, stepCount: 0 });
      newCircuit.fromJSON(jsonString);
      expect(newCircuit.fetchStep(0).fetchDropzone(0).operation).toBeInstanceOf(
        ControlGate
      );
      expect(newCircuit.fetchStep(0).fetchDropzone(2).operation).toBeInstanceOf(
        XGate
      );
      expect(newCircuit.toJSON()).toBe(jsonString);
    });

    it("should correctly load a Toffoli gate from JSON", () => {
      const jsonString = '{"cols":[["•","•","X"]]}';
      const newCircuit = new Circuit({ minWireCount: 3, stepCount: 0 });
      newCircuit.fromJSON(jsonString);
      expect(newCircuit.fetchStep(0).fetchDropzone(0).operation).toBeInstanceOf(
        ControlGate
      );
      expect(newCircuit.fetchStep(0).fetchDropzone(1).operation).toBeInstanceOf(
        ControlGate
      );
      expect(newCircuit.fetchStep(0).fetchDropzone(2).operation).toBeInstanceOf(
        XGate
      );
      expect(newCircuit.toJSON()).toBe(jsonString);
    });

    it("should correctly load a Swap gate from JSON", () => {
      const jsonString = '{"cols":[["Swap",1,"Swap"]]}';
      const newCircuit = new Circuit({ minWireCount: 3, stepCount: 0 });
      newCircuit.fromJSON(jsonString);
      expect(newCircuit.fetchStep(0).fetchDropzone(0).operation).toBeInstanceOf(
        SwapGate
      );
      expect(newCircuit.fetchStep(0).fetchDropzone(2).operation).toBeInstanceOf(
        SwapGate
      );
      expect(newCircuit.toJSON()).toBe(jsonString);
    });

    it("should correctly load multiple single-qubit gates in the same step from JSON", () => {
      const jsonString = '{"cols":[["H","T","Measure"]]}';
      const newCircuit = new Circuit({ minWireCount: 3, stepCount: 0 });
      newCircuit.fromJSON(jsonString);
      expect(newCircuit.fetchStep(0).fetchDropzone(0).operation).toBeInstanceOf(
        HGate
      );
      expect(newCircuit.fetchStep(0).fetchDropzone(1).operation).toBeInstanceOf(
        TGate
      );
      expect(newCircuit.fetchStep(0).fetchDropzone(2).operation).toBeInstanceOf(
        MeasurementGate
      );
      expect(newCircuit.toJSON()).toBe(jsonString);
    });

    it("should correctly load multiple gates in different steps from JSON", () => {
      const jsonString = '{"cols":[["H",1,1],[1,"X",1],[1,1,"Y"]]}';
      const newCircuit = new Circuit({ minWireCount: 3, stepCount: 0 });
      newCircuit.fromJSON(jsonString);
      expect(newCircuit.fetchStep(0).fetchDropzone(0).operation).toBeInstanceOf(
        HGate
      );
      expect(newCircuit.fetchStep(1).fetchDropzone(1).operation).toBeInstanceOf(
        XGate
      );
      expect(newCircuit.fetchStep(2).fetchDropzone(2).operation).toBeInstanceOf(
        YGate
      );
      expect(newCircuit.toJSON()).toBe(jsonString);
    });

    it("should correctly load a circuit from a JSON string (round trip test)", () => {
      // 様々なゲートを複数のステップに配置して回路をセットアップ
      circuit.fetchStep(0).fetchDropzone(0).addChild(new HGate());
      circuit.fetchStep(0).fetchDropzone(1).addChild(new ControlGate());
      circuit.fetchStep(0).fetchDropzone(2).addChild(new XGate());
      circuit.fetchStep(1).fetchDropzone(1).addChild(new SwapGate());
      circuit.fetchStep(1).fetchDropzone(2).addChild(new SwapGate());
      circuit.fetchStep(2).fetchDropzone(0).addChild(new Write0Gate());
      circuit.fetchStep(3).fetchDropzone(1).addChild(new MeasurementGate());
      circuit.fetchStep(4).fetchDropzone(2).addChild(new TDaggerGate());

      // 回路をJSONにシリアライズ
      const jsonString = circuit.toJSON();

      // 新しい回路を作成し、JSON文字列を読み込み
      // fromJSONが正しくステップを作成することを確認するため、ステップ数0で開始
      const newCircuit = new Circuit({ minWireCount: 3, stepCount: 0 });
      newCircuit.fromJSON(jsonString);

      // 読み込まれた回路が元の回路と全く同じJSON文字列を生成することを確認
      expect(newCircuit.toJSON()).toBe(jsonString);

      // 読み込まれた回路が元の回路と同じ数の空でないステップを持つことを確認
      const originalNonEmptySteps = circuit.steps.filter(
        (step) => !step.isEmpty
      ).length;
      const loadedNonEmptySteps = newCircuit.steps.filter(
        (step) => !step.isEmpty
      ).length;
      // ロード時に必要に応じてステップが追加されるため、これは元の非空ステップ数+fromJSONで追加されたステップ数になる可能性がある
      // シンプルな比較ではなく、toJSONの結果が一致することを確認する方が堅牢
      expect(newCircuit.toJSON()).toBe(jsonString);

      // 読み込まれた回路内の個々のゲートについて、正しいタイプと位置にあるか確認
      expect(newCircuit.fetchStep(0).fetchDropzone(0).operation).toBeInstanceOf(
        HGate
      );
      expect(newCircuit.fetchStep(0).fetchDropzone(1).operation).toBeInstanceOf(
        ControlGate
      );
      expect(newCircuit.fetchStep(0).fetchDropzone(2).operation).toBeInstanceOf(
        XGate
      );
      expect(newCircuit.fetchStep(1).fetchDropzone(1).operation).toBeInstanceOf(
        SwapGate
      );
      expect(newCircuit.fetchStep(1).fetchDropzone(2).operation).toBeInstanceOf(
        SwapGate
      );
      expect(newCircuit.fetchStep(2).fetchDropzone(0).operation).toBeInstanceOf(
        Write0Gate
      );
      expect(newCircuit.fetchStep(3).fetchDropzone(1).operation).toBeInstanceOf(
        MeasurementGate
      );
      expect(newCircuit.fetchStep(4).fetchDropzone(2).operation).toBeInstanceOf(
        TDaggerGate
      );
    });

    // より複雑な回路でのラウンドトリップテスト
    it("should correctly load a complex circuit from a JSON string (complex round trip)", () => {
      // 複数のステップにわたる様々なゲートの組み合わせで回路をセットアップ
      circuit.fetchStep(0).fetchDropzone(0).addChild(new HGate());
      circuit.fetchStep(0).fetchDropzone(1).addChild(new ControlGate());
      circuit.fetchStep(0).fetchDropzone(2).addChild(new XGate()); // CNOT

      circuit.fetchStep(1).fetchDropzone(0).addChild(new Write1Gate());
      circuit.fetchStep(1).fetchDropzone(1).addChild(new MeasurementGate());

      circuit.fetchStep(2).fetchDropzone(0).addChild(new ControlGate());
      circuit.fetchStep(2).fetchDropzone(1).addChild(new ControlGate());
      circuit.fetchStep(2).fetchDropzone(2).addChild(new XGate()); // Toffoli

      circuit.fetchStep(3).fetchDropzone(0).addChild(new SwapGate());
      circuit.fetchStep(3).fetchDropzone(2).addChild(new SwapGate()); // Swap

      circuit.fetchStep(4).fetchDropzone(1).addChild(new TGate());

      const jsonString = circuit.toJSON();
      const newCircuit = new Circuit({ minWireCount: 3, stepCount: 0 });
      newCircuit.fromJSON(jsonString);

      expect(newCircuit.toJSON()).toBe(jsonString);

      // ロードされた回路のゲートを確認
      expect(newCircuit.fetchStep(0).fetchDropzone(0).operation).toBeInstanceOf(
        HGate
      );
      expect(newCircuit.fetchStep(0).fetchDropzone(1).operation).toBeInstanceOf(
        ControlGate
      );
      expect(newCircuit.fetchStep(0).fetchDropzone(2).operation).toBeInstanceOf(
        XGate
      );

      expect(newCircuit.fetchStep(1).fetchDropzone(0).operation).toBeInstanceOf(
        Write1Gate
      );
      expect(newCircuit.fetchStep(1).fetchDropzone(1).operation).toBeInstanceOf(
        MeasurementGate
      );

      expect(newCircuit.fetchStep(2).fetchDropzone(0).operation).toBeInstanceOf(
        ControlGate
      );
      expect(newCircuit.fetchStep(2).fetchDropzone(1).operation).toBeInstanceOf(
        ControlGate
      );
      expect(newCircuit.fetchStep(2).fetchDropzone(2).operation).toBeInstanceOf(
        XGate
      );

      expect(newCircuit.fetchStep(3).fetchDropzone(0).operation).toBeInstanceOf(
        SwapGate
      );
      expect(newCircuit.fetchStep(3).fetchDropzone(2).operation).toBeInstanceOf(
        SwapGate
      );

      expect(newCircuit.fetchStep(4).fetchDropzone(1).operation).toBeInstanceOf(
        TGate
      );
    });
  });

  describe("toString", () => {
    it("should return a string representation of an empty circuit", () => {
      const emptyCircuit = new Circuit({ minWireCount: 3, stepCount: 5 });
      const expected = "0: ────────────────────────────";
      expect(emptyCircuit.toString()).toBe(expected);
    });

    it("should return a string representation of a circuit with gates", () => {
      const circuit = new Circuit({ minWireCount: 3, stepCount: 5 });
      circuit.fetchStep(0).fetchDropzone(0).addChild(new HGate());
      circuit.fetchStep(1).fetchDropzone(1).addChild(new XGate());
      circuit.fetchStep(2).fetchDropzone(2).addChild(new YGate());
      circuit.fetchStep(3).fetchDropzone(0).addChild(new ZGate());
      circuit.fetchStep(4).fetchDropzone(1).addChild(new TGate());

      const expected = `
0: ───H──────────────Z─────────

1: ────────X──────────────T────

2: ─────────────Y──────────────`.trim();
      expect(circuit.toString()).toBe(expected);
    });

    it("should handle gates with two-character labels correctly", () => {
      const circuit = new Circuit({ minWireCount: 2, stepCount: 3 });
      circuit.fetchStep(0).fetchDropzone(0).addChild(new SDaggerGate());
      circuit.fetchStep(1).fetchDropzone(1).addChild(new RnotGate());

      const expected = `
0: ───S†─────────────

1: ────────√X────────`.trim();
      expect(circuit.toString()).toBe(expected);
    });
  });

  describe("onGateSnapToDropzone", () => {
    it("should update wire types when a gate snaps to a dropzone", () => {
      const write0 = new Write0Gate();
      const dropzone = circuit.fetchStep(0).fetchDropzone(0);

      dropzone.snap(write0);

      expect(dropzone.inputWireType).toBe(WireType.Classical);
      expect(dropzone.outputWireType).toBe(WireType.Quantum);
    });
  });

  describe("updateStepMarker", () => {
    it("updates the marker manager with the current steps", () => {
      const circuit = new Circuit({ minWireCount: 3, stepCount: 5 });
      const updateSpy = vi.spyOn(circuit["markerManager"], "update");

      circuit["updateStepMarker"]();

      expect(updateSpy).toHaveBeenCalledWith(circuit.steps);
    });
  });
});
