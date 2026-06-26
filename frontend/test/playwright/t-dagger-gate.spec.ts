import { expect, test } from "./fixtures";
import { dragAndDrop } from "./test-helpers";

test.describe("T† gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Place a T† gate on the first bit", async ({ page, circuitInfo }) => {
    const tDaggerGate = circuitInfo.gatePalette.tDaggerGate;

    await dragAndDrop(page, tDaggerGate, { step: 0, bit: 0 });

    await expect(page).toHaveScreenshot("t-dagger-gate-bit1.png");
  });

  test("Place a T† gate on the second bit", async ({ page, circuitInfo }) => {
    const tDaggerGate = circuitInfo.gatePalette.tDaggerGate;

    await dragAndDrop(page, tDaggerGate, { step: 0, bit: 1 });

    await expect(page).toHaveScreenshot("t-dagger-gate-bit2.png");
  });

  test("Place a T† gate on the third bit", async ({ page, circuitInfo }) => {
    const tDaggerGate = circuitInfo.gatePalette.tDaggerGate;

    await dragAndDrop(page, tDaggerGate, { step: 0, bit: 2 });

    await expect(page).toHaveScreenshot("t-dagger-gate-bit3.png");
  });
});
