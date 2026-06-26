import { expect, test } from "./fixtures";
import { dragAndDrop } from "./test-helpers";

test.describe("Measurement gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Place a Measurement gate on the first bit", async ({
    page,
    circuitInfo,
  }) => {
    const measurementGate = circuitInfo.gatePalette.measurementGate;

    await dragAndDrop(page, measurementGate, { step: 0, bit: 0 });

    await expect(page).toHaveScreenshot("measurement-gate-bit1.png");
  });

  test("Place a Measurement gate on the second bit", async ({
    page,
    circuitInfo,
  }) => {
    const measurementGate = circuitInfo.gatePalette.measurementGate;

    await dragAndDrop(page, measurementGate, { step: 0, bit: 1 });

    await expect(page).toHaveScreenshot("measurement-gate-bit2.png");
  });

  test("Place a Measurement gate on the third bit", async ({
    page,
    circuitInfo,
  }) => {
    const measurementGate = circuitInfo.gatePalette.measurementGate;

    await dragAndDrop(page, measurementGate, { step: 0, bit: 2 });

    await expect(page).toHaveScreenshot("measurement-gate-bit3.png");
  });
});
