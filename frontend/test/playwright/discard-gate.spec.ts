import { expect, test } from "./fixtures";

test.describe("Discard gates", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Discard gate", async ({ page, circuitInfo, idle }) => {
    const gate = circuitInfo.gatePalette.hGate;

    await page.mouse.move(gate.x, gate.y);
    await page.mouse.down();
    await page.mouse.up();
    await idle.waitFor();

    await expect(page).toHaveScreenshot("discard-gate.png");
  });
});
