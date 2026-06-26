import { expect, test } from "./fixtures";
import { dragAndDrop } from "./test-helpers";

test.describe("H gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Place an H gate on the first bit", async ({ page, circuitInfo }) => {
    const hGate = circuitInfo.gatePalette.hGate;

    await dragAndDrop(page, hGate, { step: 0, bit: 0 });

    await expect(page).toHaveScreenshot("h-gate-bit1.png");
  });

  test("Place an H gate on the second bit", async ({ page, circuitInfo }) => {
    const hGate = circuitInfo.gatePalette.hGate;

    await dragAndDrop(page, hGate, { step: 0, bit: 1 });

    await expect(page).toHaveScreenshot("h-gate-bit2.png");
  });

  test("Place an H gate on the third bit", async ({ page, circuitInfo }) => {
    const hGate = circuitInfo.gatePalette.hGate;

    await dragAndDrop(page, hGate, { step: 0, bit: 2 });

    await expect(page).toHaveScreenshot("h-gate-bit3.png");
  });
});
