// @vitest-environment jsdom

import { beforeEach, describe, expect, test } from "vitest";
import { RnotGate } from "../../src/rnot-gate";

describe("RnotGate", () => {
  let gate: RnotGate;

  beforeEach(() => {
    gate = new RnotGate();
  });

  test("operationType", () => {
    expect(gate.operationType).toBe("RnotGate");
  });

  test("label", () => {
    expect(gate.label).toBe("√X");
  });

  test("toJSON", () => {
    expect(gate.toJSON()).toBe('"X^½"');
  });

  test("serialize", () => {
    expect(gate.serialize([0])).toEqual({ type: "X^½", targets: [0] });
  });
});
