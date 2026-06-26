import { expect, test } from "./fixtures";

test.describe("Gate Palette", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test.describe("H Gate", () => {
    test("changes style when mouseover", async ({ page, circuitInfo }) => {
      const gate = circuitInfo.gatePalette.hGate;

      await page.mouse.move(gate.x, gate.y);

      await expect(page).toHaveScreenshot("h-gate-hover.png");
    });
  });

  test.describe("X Gate", () => {
    test("changes style when mouseover", async ({ page, circuitInfo }) => {
      const gate = circuitInfo.gatePalette.xGate;

      await page.mouse.move(gate.x, gate.y);

      await expect(page).toHaveScreenshot("x-gate-hover.png");
    });
  });

  test.describe("Y Gate", () => {
    test("changes style when mouseover", async ({ page, circuitInfo }) => {
      const gate = circuitInfo.gatePalette.yGate;

      await page.mouse.move(gate.x, gate.y);

      await expect(page).toHaveScreenshot("y-gate-hover.png");
    });
  });

  test.describe("Z Gate", () => {
    test("changes style when mouseover", async ({ page, circuitInfo }) => {
      const gate = circuitInfo.gatePalette.zGate;

      await page.mouse.move(gate.x, gate.y);

      await expect(page).toHaveScreenshot("z-gate-hover.png");
    });
  });

  test.describe("√X Gate", () => {
    test("changes style when mouseover", async ({ page, circuitInfo }) => {
      const gate = circuitInfo.gatePalette.rnotGate;

      await page.mouse.move(gate.x, gate.y);

      await expect(page).toHaveScreenshot("rnot-gate-hover.png");
    });
  });

  test.describe("S Gate", () => {
    test("changes style when mouseover", async ({ page, circuitInfo }) => {
      const gate = circuitInfo.gatePalette.sGate;

      await page.mouse.move(gate.x, gate.y);

      await expect(page).toHaveScreenshot("s-gate-hover.png");
    });
  });

  test.describe("S† Gate", () => {
    test("changes style when mouseover", async ({ page, circuitInfo }) => {
      const gate = circuitInfo.gatePalette.sDaggerGate;

      await page.mouse.move(gate.x, gate.y);

      await expect(page).toHaveScreenshot("s-dagger-gate-hover.png");
    });
  });

  test.describe("T Gate", () => {
    test("changes style when mouseover", async ({ page, circuitInfo }) => {
      const gate = circuitInfo.gatePalette.tGate;

      await page.mouse.move(gate.x, gate.y);

      await expect(page).toHaveScreenshot("t-gate-hover.png");
    });
  });

  test.describe("T† Gate", () => {
    test("changes style when mouseover", async ({ page, circuitInfo }) => {
      const gate = circuitInfo.gatePalette.tDaggerGate;

      await page.mouse.move(gate.x, gate.y);

      await expect(page).toHaveScreenshot("t-dagger-gate-hover.png");
    });
  });

  test.describe("Swap Gate", () => {
    test("changes style when mouseover", async ({ page, circuitInfo }) => {
      const gate = circuitInfo.gatePalette.swapGate;

      await page.mouse.move(gate.x, gate.y);

      await expect(page).toHaveScreenshot("swap-gate-hover.png");
    });
  });

  test.describe("Control Gate", () => {
    test("changes style when mouseover", async ({ page, circuitInfo }) => {
      const gate = circuitInfo.gatePalette.controlGate;

      await page.mouse.move(gate.x, gate.y);

      await expect(page).toHaveScreenshot("control-gate-hover.png");
    });
  });

  test.describe("|0> Gate", () => {
    test("changes style when mouseover", async ({ page, circuitInfo }) => {
      const gate = circuitInfo.gatePalette.write0Gate;

      await page.mouse.move(gate.x, gate.y);

      await expect(page).toHaveScreenshot("write0-gate-hover.png");
    });
  });

  test.describe("|1> Gate", () => {
    test("changes style when mouseover", async ({ page, circuitInfo }) => {
      const gate = circuitInfo.gatePalette.write1Gate;

      await page.mouse.move(gate.x, gate.y);

      await expect(page).toHaveScreenshot("write1-gate-hover.png");
    });
  });

  test.describe("Measurement Gate", () => {
    test("changes style when mouseover", async ({ page, circuitInfo }) => {
      const gate = circuitInfo.gatePalette.measurementGate;

      await page.mouse.move(gate.x, gate.y);

      await expect(page).toHaveScreenshot("measurement-gate-hover.png");
    });
  });
});
