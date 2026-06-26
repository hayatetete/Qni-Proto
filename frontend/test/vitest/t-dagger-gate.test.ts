// @vitest-environment jsdom

import { beforeEach, describe, expect, test } from "vitest";
import { TDaggerGate } from "../../src/t-dagger-gate";

describe("TDaggerGate", () => {
  let gate: TDaggerGate;

  beforeEach(() => {
    gate = new TDaggerGate();
  });

  test("operationType", () => {
    expect(gate.operationType).toBe("TDaggerGate");
  });

  test("label", () => {
    expect(gate.label).toBe("T†");
  });

  test("toJSON", () => {
    expect(gate.toJSON()).toBe('"T†"');
  });

  test("serialize", () => {
    expect(gate.serialize([0])).toEqual({ type: "T†", targets: [0] });
  });
});
