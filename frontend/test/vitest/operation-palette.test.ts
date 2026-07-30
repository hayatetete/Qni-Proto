import { describe, expect, it } from "vitest";
import { OperationComponent } from "../../src/operation-component";
import { OperationPalette } from "../../src/operation-palette";
import { spacingInPx } from "../../src/util";

describe("OperationPalette", () => {
  it("should size the background from the first-row gates through Rz", () => {
    const palette = new OperationPalette();
    const firstRowGateCountThroughRz = 13;
    const expectedWidth =
      firstRowGateCountThroughRz * OperationComponent.sizeInPx.base +
      (firstRowGateCountThroughRz - 1) * spacingInPx(2) +
      spacingInPx(6) * 2;

    expect(palette.contentWidth).toBe(expectedWidth);
  });
});
