// @vitest-environment jsdom

import { beforeEach, describe, expect, test } from "vitest";
import { YGate } from "../../src/y-gate";

describe("YGate", () => {
  let gate: YGate;

  beforeEach(() => {
    gate = new YGate();
  });

  test("operationType", () => {
    expect(gate.operationType).toBe("YGate");
  });

  test("label", () => {
    expect(gate.label).toBe("Y");
  });

  test("toJSON", () => {
    expect(gate.toJSON()).toBe('"Y"');
  });

  test("serialize", () => {
    expect(gate.serialize([0])).toEqual({ type: "Y", targets: [0] });
  });
});
