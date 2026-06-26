// @vitest-environment jsdom

import { beforeEach, describe, expect, test } from "vitest";
import { ZGate } from "../../src/z-gate";

describe("ZGate", () => {
  let gate: ZGate;

  beforeEach(() => {
    gate = new ZGate();
  });

  test("operationType", () => {
    expect(gate.operationType).toBe("ZGate");
  });

  test("label", () => {
    expect(gate.label).toBe("Z");
  });

  test("toJSON", () => {
    expect(gate.toJSON()).toBe('"Z"');
  });

  test("serialize", () => {
    expect(gate.serialize([0])).toEqual({ type: "Z", targets: [0] });
  });
});
