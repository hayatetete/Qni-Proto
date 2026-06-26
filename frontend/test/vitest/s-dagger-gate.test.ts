// @vitest-environment jsdom

import { beforeEach, describe, expect, test } from "vitest";
import { SDaggerGate } from "../../src/s-dagger-gate";

describe("SDaggerGate", () => {
  let gate: SDaggerGate;

  beforeEach(() => {
    gate = new SDaggerGate();
  });

  test("operationType", () => {
    expect(gate.operationType).toBe("SDaggerGate");
  });

  test("label", () => {
    expect(gate.label).toBe("S†");
  });

  test("toJSON", () => {
    expect(gate.toJSON()).toBe('"S†"');
  });

  test("serialize", () => {
    expect(gate.serialize([0])).toEqual({ type: "S†", targets: [0] });
  });
});
