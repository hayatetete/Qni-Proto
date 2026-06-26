// @vitest-environment jsdom

import { beforeEach, describe, expect, test } from "vitest";
import { SGate } from "../../src/s-gate";

describe("SGate", () => {
  let gate: SGate;

  beforeEach(() => {
    gate = new SGate();
  });

  test("operationType", () => {
    expect(gate.operationType).toBe("SGate");
  });

  test("label", () => {
    expect(gate.label).toBe("S");
  });

  test("toJSON", () => {
    expect(gate.toJSON()).toBe('"S"');
  });

  test("serialize", () => {
    expect(gate.serialize([0])).toEqual({ type: "S", targets: [0] });
  });
});
