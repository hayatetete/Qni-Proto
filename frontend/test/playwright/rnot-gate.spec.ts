import { expect, test } from "./fixtures";
import { dragAndDrop } from "./test-helpers";

test.describe("√X gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Place a √X gate on the first bit", async ({ page, circuitInfo }) => {
    const rnotGate = circuitInfo.gatePalette.rnotGate;

    await dragAndDrop(page, rnotGate, { step: 0, bit: 0 });

    await expect(page).toHaveScreenshot("rnot-gate-bit1.png");
  });

  test("Place a √X gate on the second bit", async ({ page, circuitInfo }) => {
    const rnotGate = circuitInfo.gatePalette.rnotGate;

    await dragAndDrop(page, rnotGate, { step: 0, bit: 1 });

    await expect(page).toHaveScreenshot("rnot-gate-bit2.png");
  });

  test("Place a √X gate on the third bit", async ({ page, circuitInfo }) => {
    const rnotGate = circuitInfo.gatePalette.rnotGate;

    await dragAndDrop(page, rnotGate, { step: 0, bit: 2 });

    await expect(page).toHaveScreenshot("rnot-gate-bit3.png");
  });
});
