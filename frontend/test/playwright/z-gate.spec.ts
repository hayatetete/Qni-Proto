import { expect, test } from "./fixtures";
import { dragAndDrop } from "./test-helpers";

test.describe("Z gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Place a Z gate on the first bit", async ({ page, circuitInfo }) => {
    const zGate = circuitInfo.gatePalette.zGate;

    await dragAndDrop(page, zGate, { step: 0, bit: 0 });

    await expect(page).toHaveScreenshot("z-gate-bit1.png");
  });

  test("Place a Z gate on the second bit", async ({ page, circuitInfo }) => {
    const zGate = circuitInfo.gatePalette.zGate;

    await dragAndDrop(page, zGate, { step: 0, bit: 1 });

    await expect(page).toHaveScreenshot("z-gate-bit2.png");
  });

  test("Place a Z gate on the third bit", async ({ page, circuitInfo }) => {
    const zGate = circuitInfo.gatePalette.zGate;

    await dragAndDrop(page, zGate, { step: 0, bit: 2 });

    await expect(page).toHaveScreenshot("z-gate-bit3.png");
  });
});
