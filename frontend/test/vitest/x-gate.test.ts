// @vitest-environment jsdom

import { beforeEach, describe, expect, test } from "vitest";
import { XGate } from "../../src/x-gate";

describe("XGate", () => {
  let gate: XGate;

  beforeEach(() => {
    gate = new XGate();
  });

  test("operationType", () => {
    expect(gate.operationType).toBe("XGate");
  });

  test("label", () => {
    expect(gate.label).toBe("X");
  });

  test("toJSON", () => {
    expect(gate.toJSON()).toBe('"X"');
  });

  test("serialize", () => {
    expect(gate.serialize([0])).toEqual({ type: "X", targets: [0] });
    expect(gate.serialize([0, 1], [2, 3])).toEqual({
      type: "X",
      targets: [0, 1],
      controls: [2, 3],
    });
  });
});
