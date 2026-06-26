// @vitest-environment jsdom

import { beforeEach, describe, expect, test } from "vitest";
import { Write1Gate } from "../../src/write1-gate";

describe("Write1Gate", () => {
  let gate: Write1Gate;

  beforeEach(() => {
    gate = new Write1Gate();
  });

  test("operationType", () => {
    expect(gate.operationType).toBe("Write1Gate");
  });

  test("label", () => {
    expect(gate.label).toBe("1");
  });

  test("toJSON", () => {
    expect(gate.toJSON()).toBe('"|1>"');
  });

  test("serialize", () => {
    expect(gate.serialize([0])).toEqual({ type: "|1>", targets: [0] });
  });
});
