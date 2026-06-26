import { expect, test } from "./fixtures";
import { activateStep, dragAndDrop } from "./test-helpers";

test.describe("Controlled-H gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Place a controlled-H gate (00)", async ({ page, circuitInfo }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const hGate = circuitInfo.gatePalette.hGate;

    await dragAndDrop(page, controlGate, { step: 0, bit: 0 });
    await dragAndDrop(page, hGate, { step: 0, bit: 1 });

    await expect(page).toHaveScreenshot("controlled-h-gate-00.png");
  });

  test("Place a controlled-H gate (01)", async ({ page, circuitInfo }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const hGate = circuitInfo.gatePalette.hGate;
    const xGate = circuitInfo.gatePalette.xGate;

    await dragAndDrop(page, xGate, { step: 0, bit: 0 });
    await dragAndDrop(page, controlGate, { step: 1, bit: 0 });
    await dragAndDrop(page, hGate, { step: 1, bit: 1 });
    await activateStep(page, 1);

    await expect(page).toHaveScreenshot("controlled-h-gate-01.png");
  });

  test("Place a controlled-H gate (10)", async ({ page, circuitInfo }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const hGate = circuitInfo.gatePalette.hGate;
    const xGate = circuitInfo.gatePalette.xGate;

    await dragAndDrop(page, xGate, { step: 0, bit: 1 });
    await dragAndDrop(page, controlGate, { step: 1, bit: 0 });
    await dragAndDrop(page, hGate, { step: 1, bit: 1 });
    await activateStep(page, 1);

    await expect(page).toHaveScreenshot("controlled-h-gate-10.png");
  });

  test("Place a controlled-H gate (11)", async ({ page, circuitInfo }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const hGate = circuitInfo.gatePalette.hGate;
    const xGate = circuitInfo.gatePalette.xGate;

    await dragAndDrop(page, xGate, { step: 0, bit: 0 });
    await dragAndDrop(page, xGate, { step: 0, bit: 1 });
    await dragAndDrop(page, controlGate, { step: 1, bit: 0 });
    await dragAndDrop(page, hGate, { step: 1, bit: 1 });
    await activateStep(page, 1);

    await expect(page).toHaveScreenshot("controlled-h-gate-11.png");
  });

  test("Place a controlled-H gate with 2 controls (000)", async ({
    page,
    circuitInfo,
  }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const hGate = circuitInfo.gatePalette.hGate;

    await dragAndDrop(page, controlGate, { step: 0, bit: 0 });
    await dragAndDrop(page, controlGate, { step: 0, bit: 1 });
    await dragAndDrop(page, hGate, { step: 0, bit: 2 });
    await activateStep(page, 0);

    await expect(page).toHaveScreenshot("controlled-h-gate-000.png");
  });

  test("Place a controlled-H gate with 2 controls (011)", async ({
    page,
    circuitInfo,
  }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const hGate = circuitInfo.gatePalette.hGate;
    const xGate = circuitInfo.gatePalette.xGate;

    await dragAndDrop(page, xGate, { step: 0, bit: 0 });
    await dragAndDrop(page, xGate, { step: 0, bit: 1 });
    await dragAndDrop(page, controlGate, { step: 1, bit: 0 });
    await dragAndDrop(page, controlGate, { step: 1, bit: 1 });
    await dragAndDrop(page, hGate, { step: 1, bit: 2 });
    await activateStep(page, 1);

    await expect(page).toHaveScreenshot("controlled-h-gate-011.png");
  });

  test("Place a controlled-HH gate (000)", async ({ page, circuitInfo }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const hGate = circuitInfo.gatePalette.hGate;

    await dragAndDrop(page, controlGate, { step: 0, bit: 0 });
    await dragAndDrop(page, hGate, { step: 0, bit: 1 });
    await dragAndDrop(page, hGate, { step: 0, bit: 2 });

    await expect(page).toHaveScreenshot("controlled-hh-gate-000.png");
  });

  test("Place a controlled-HH gate (011)", async ({ page, circuitInfo }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const hGate = circuitInfo.gatePalette.hGate;
    const xGate = circuitInfo.gatePalette.xGate;

    await dragAndDrop(page, xGate, { step: 0, bit: 0 });
    await dragAndDrop(page, controlGate, { step: 1, bit: 0 });
    await dragAndDrop(page, hGate, { step: 1, bit: 1 });
    await dragAndDrop(page, hGate, { step: 1, bit: 2 });
    await activateStep(page, 1);

    await expect(page).toHaveScreenshot("controlled-hh-gate-011.png");
  });
});
