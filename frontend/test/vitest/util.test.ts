// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { spacingInPx } from "../../src";

describe("spacingInPx", () => {
  test("0.25", () => {
    expect(spacingInPx(0.25)).toBe(1);
  });
});
