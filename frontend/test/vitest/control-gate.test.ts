// @vitest-environment jsdom

import { beforeEach, describe, expect, test } from "vitest";
import { ControlGate } from "../../src/control-gate";

describe("ControlGate", () => {
  let gate: ControlGate;

  beforeEach(() => {
    gate = new ControlGate();
  });

  test("operationType", () => {
    expect(gate.operationType).toBe("ControlGate");
  });

  test("label", () => {
    expect(gate.label).toBe("@");
  });

  test("toJSON", () => {
    expect(gate.toJSON()).toBe('"•"');
  });

  test("serialize", () => {
    expect(gate.serialize([0])).toEqual({ type: "•", targets: [0] });
  });
});
