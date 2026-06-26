import { expect, test } from "./fixtures";
import { dragAndDrop } from "./test-helpers";

test.describe("S gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Place an S gate on the first bit", async ({ page, circuitInfo }) => {
    const sGate = circuitInfo.gatePalette.sGate;

    await dragAndDrop(page, sGate, { step: 0, bit: 0 });

    await expect(page).toHaveScreenshot("s-gate-bit1.png");
  });

  test("Place an S gate on the second bit", async ({ page, circuitInfo }) => {
    const sGate = circuitInfo.gatePalette.sGate;

    await dragAndDrop(page, sGate, { step: 0, bit: 1 });

    await expect(page).toHaveScreenshot("s-gate-bit2.png");
  });

  test("Place an S gate on the third bit", async ({ page, circuitInfo }) => {
    const sGate = circuitInfo.gatePalette.sGate;

    await dragAndDrop(page, sGate, { step: 0, bit: 2 });

    await expect(page).toHaveScreenshot("s-gate-bit3.png");
  });
});
