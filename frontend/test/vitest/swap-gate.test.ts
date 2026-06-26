// @vitest-environment jsdom

import { beforeEach, describe, expect, test } from "vitest";
import { SwapGate } from "../../src/swap-gate";

describe("SwapGate", () => {
  let gate: SwapGate;

  beforeEach(() => {
    gate = new SwapGate();
  });

  test("operationType", () => {
    expect(gate.operationType).toBe("SwapGate");
  });

  test("label", () => {
    expect(gate.label).toBe("×");
  });

  test("toJSON", () => {
    expect(gate.toJSON()).toBe('"Swap"');
  });

  test("serialize", () => {
    expect(gate.serialize([0, 1])).toEqual({ type: "Swap", targets: [0, 1] });
  });
});
