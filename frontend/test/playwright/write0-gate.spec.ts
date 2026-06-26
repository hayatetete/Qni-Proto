import { expect, test } from "./fixtures";
import { dragAndDrop } from "./test-helpers";

test.describe("|0> gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Place a |0> gate on the first bit", async ({ page, circuitInfo }) => {
    const write0Gate = circuitInfo.gatePalette.write0Gate;

    await dragAndDrop(page, write0Gate, { step: 0, bit: 0 });

    await expect(page).toHaveScreenshot("write0-gate-bit1.png");
  });

  test("Place a |0> gate on the second bit", async ({ page, circuitInfo }) => {
    const write0Gate = circuitInfo.gatePalette.write0Gate;

    await dragAndDrop(page, write0Gate, { step: 0, bit: 1 });

    await expect(page).toHaveScreenshot("write0-gate-bit2.png");
  });

  test("Place a |0> gate on the third bit", async ({ page, circuitInfo }) => {
    const write0Gate = circuitInfo.gatePalette.write0Gate;

    await dragAndDrop(page, write0Gate, { step: 0, bit: 2 });

    await expect(page).toHaveScreenshot("write0-gate-bit3.png");
  });
});
