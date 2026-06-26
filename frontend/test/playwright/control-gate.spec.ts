import { expect, test } from "./fixtures";
import { dragAndDrop } from "./test-helpers";

test.describe("Control gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Place a Control gate on the first bit", async ({
    page,
    circuitInfo,
  }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;

    await dragAndDrop(page, controlGate, { step: 0, bit: 0 });

    await expect(page).toHaveScreenshot("control-gate-bit1.png");
  });

  test("Place a Control gate on the second bit", async ({
    page,
    circuitInfo,
  }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;

    await dragAndDrop(page, controlGate, { step: 0, bit: 1 });

    await expect(page).toHaveScreenshot("control-gate-bit2.png");
  });

  test("Place a Control gate on the third bit", async ({
    page,
    circuitInfo,
  }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;

    await dragAndDrop(page, controlGate, { step: 0, bit: 2 });

    await expect(page).toHaveScreenshot("control-gate-bit3.png");
  });
});
