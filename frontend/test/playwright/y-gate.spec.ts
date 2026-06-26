import { expect, test } from "./fixtures";
import { dragAndDrop } from "./test-helpers";

test.describe("Y gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Place a Y gate on the first bit", async ({ page, circuitInfo }) => {
    const yGate = circuitInfo.gatePalette.yGate;

    await dragAndDrop(page, yGate, { step: 0, bit: 0 });

    await expect(page).toHaveScreenshot("y-gate-bit1.png");
  });

  test("Place a Y gate on the second bit", async ({ page, circuitInfo }) => {
    const yGate = circuitInfo.gatePalette.yGate;

    await dragAndDrop(page, yGate, { step: 0, bit: 1 });

    await expect(page).toHaveScreenshot("y-gate-bit2.png");
  });

  test("Place a Y gate on the third bit", async ({ page, circuitInfo }) => {
    const yGate = circuitInfo.gatePalette.yGate;

    await dragAndDrop(page, yGate, { step: 0, bit: 2 });

    await expect(page).toHaveScreenshot("y-gate-bit3.png");
  });
});
