import { expect, test } from "./fixtures";
import { activateStep, dragAndDrop } from "./test-helpers";

test.describe("Controlled-S gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Place a controlled-S gate (00)", async ({ page, circuitInfo }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const sGate = circuitInfo.gatePalette.sGate;

    await dragAndDrop(page, controlGate, { step: 0, bit: 0 });
    await dragAndDrop(page, sGate, { step: 0, bit: 1 });

    await expect(page).toHaveScreenshot("controlled-s-gate-00.png");
  });

  test("Place a controlled-S gate (01)", async ({ page, circuitInfo }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const sGate = circuitInfo.gatePalette.sGate;
    const xGate = circuitInfo.gatePalette.xGate;

    await dragAndDrop(page, xGate, { step: 0, bit: 0 });
    await dragAndDrop(page, controlGate, { step: 1, bit: 0 });
    await dragAndDrop(page, sGate, { step: 1, bit: 1 });
    await activateStep(page, 1);

    await expect(page).toHaveScreenshot("controlled-s-gate-01.png");
  });

  test("Place a controlled-S gate (10)", async ({ page, circuitInfo }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const sGate = circuitInfo.gatePalette.sGate;
    const xGate = circuitInfo.gatePalette.xGate;

    await dragAndDrop(page, xGate, { step: 0, bit: 1 });
    await dragAndDrop(page, controlGate, { step: 1, bit: 0 });
    await dragAndDrop(page, sGate, { step: 1, bit: 1 });
    await activateStep(page, 1);

    await expect(page).toHaveScreenshot("controlled-s-gate-10.png");
  });

  test("Place a controlled-S gate (11)", async ({ page, circuitInfo }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const sGate = circuitInfo.gatePalette.sGate;
    const xGate = circuitInfo.gatePalette.xGate;

    await dragAndDrop(page, xGate, { step: 0, bit: 0 });
    await dragAndDrop(page, xGate, { step: 0, bit: 1 });
    await dragAndDrop(page, controlGate, { step: 1, bit: 0 });
    await dragAndDrop(page, sGate, { step: 1, bit: 1 });
    await activateStep(page, 1);

    await expect(page).toHaveScreenshot("controlled-s-gate-11.png");
  });

  test("Place a controlled-S gate with 2 controls (000)", async ({ page, circuitInfo }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const sGate = circuitInfo.gatePalette.sGate;

    await dragAndDrop(page, controlGate, { step: 0, bit: 0 });
    await dragAndDrop(page, controlGate, { step: 0, bit: 1 });
    await dragAndDrop(page, sGate, { step: 0, bit: 2 });
    await activateStep(page, 0);

    await expect(page).toHaveScreenshot("controlled-s-gate-000.png");
  });

  test("Place a controlled-S gate with 2 controls (011)", async ({ page, circuitInfo }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const sGate = circuitInfo.gatePalette.sGate;
    const xGate = circuitInfo.gatePalette.xGate;

    await dragAndDrop(page, xGate, { step: 0, bit: 0 });
    await dragAndDrop(page, xGate, { step: 0, bit: 1 });
    await dragAndDrop(page, controlGate, { step: 1, bit: 0 });
    await dragAndDrop(page, controlGate, { step: 1, bit: 1 });
    await dragAndDrop(page, sGate, { step: 1, bit: 2 });
    await activateStep(page, 1);

    await expect(page).toHaveScreenshot("controlled-s-gate-011.png");
  });
});
