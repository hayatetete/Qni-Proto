// @vitest-environment jsdom

import { beforeEach, describe, expect, test } from "vitest";
import { MeasurementGate } from "../../src/measurement-gate";

describe("MeasurementGate", () => {
  let gate: MeasurementGate;

  beforeEach(() => {
    gate = new MeasurementGate();
  });

  test("operationType", () => {
    expect(gate.operationType).toBe("MeasurementGate");
  });

  test("label", () => {
    expect(gate.label).toBe("M");
  });

  test("toJSON", () => {
    expect(gate.toJSON()).toBe('"Measure"');
  });

  test("serialize", () => {
    expect(gate.serialize([0])).toEqual({ type: "Measure", targets: [0] });
  });
});
