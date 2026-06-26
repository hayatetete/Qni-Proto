// @vitest-environment jsdom

import { beforeEach, describe, expect, test } from "vitest";
import { TGate } from "../../src/t-gate";

describe("TGate", () => {
  let gate: TGate;

  beforeEach(() => {
    gate = new TGate();
  });

  test("operationType", () => {
    expect(gate.operationType).toBe("TGate");
  });

  test("label", () => {
    expect(gate.label).toBe("T");
  });

  test("toJSON", () => {
    expect(gate.toJSON()).toBe('"T"');
  });

  test("serialize", () => {
    expect(gate.serialize([0])).toEqual({ type: "T", targets: [0] });
  });
});
