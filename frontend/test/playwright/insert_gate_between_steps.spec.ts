import { expect, test } from "./fixtures";
import { dragAndDrop } from "./test-helpers";

test.describe("Insert gate between steps", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Insert a gate before the first step", async ({ page, circuitInfo }) => {
    const hGate = circuitInfo.gatePalette.hGate;

    await dragAndDrop(page, hGate, { beforeStep: 0, bit: 0 });

    await expect(page).toHaveScreenshot("insert-h-gate-before-step0.png");
  });

  test("Insert a gate before the gate on the first step", async ({
    page,
    circuitInfo,
  }) => {
    const hGate = circuitInfo.gatePalette.hGate;

    await dragAndDrop(page, hGate, { step: 0, bit: 0 });
    await dragAndDrop(page, hGate, { beforeStep: 0, bit: 0 });

    await expect(page).toHaveScreenshot("insert-h-gate-before-step0-gate0.png");
  });

  test("Insert a gate after the first step", async ({ page, circuitInfo }) => {
    const hGate = circuitInfo.gatePalette.hGate;

    await dragAndDrop(page, hGate, { afterStep: 0, bit: 0 });

    await expect(page).toHaveScreenshot("insert-h-gate-after-step0.png");
  });

  test("Insert a gate after the gate on the first step", async ({
    page,
    circuitInfo,
  }) => {
    const hGate = circuitInfo.gatePalette.hGate;

    await dragAndDrop(page, hGate, { step: 0, bit: 0 });
    await dragAndDrop(page, hGate, { afterStep: 0, bit: 0 });

    await expect(page).toHaveScreenshot("insert-h-gate-after-step0-gate0.png");
  });
});
