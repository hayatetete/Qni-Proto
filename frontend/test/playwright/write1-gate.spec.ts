import { expect, test } from "./fixtures";
import { dragAndDrop } from "./test-helpers";

test.describe("|1> gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Place a |1> gate on the first bit", async ({ page, circuitInfo }) => {
    const write1Gate = circuitInfo.gatePalette.write1Gate;

    await dragAndDrop(page, write1Gate, { step: 0, bit: 0 });

    await expect(page).toHaveScreenshot("write1-gate-bit1.png");
  });

  test("Place a |1> gate on the second bit", async ({ page, circuitInfo }) => {
    const write1Gate = circuitInfo.gatePalette.write1Gate;

    await dragAndDrop(page, write1Gate, { step: 0, bit: 1 });

    await expect(page).toHaveScreenshot("write1-gate-bit2.png");
  });

  test("Place a |1> gate on the third bit", async ({ page, circuitInfo }) => {
    const write1Gate = circuitInfo.gatePalette.write1Gate;

    await dragAndDrop(page, write1Gate, { step: 0, bit: 2 });

    await expect(page).toHaveScreenshot("write1-gate-bit3.png");
  });
});
