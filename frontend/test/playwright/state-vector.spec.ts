import { expect, test } from "./fixtures";
import { dropAt, getCircuitInfo, grab } from "./test-helpers";

test.describe("State vector", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  // TODO: GPU 環境で 32 までテスト
  const qubitCounts = [1, 2, 3, 4, 5, 6, 7];

  for (const qubitCount of qubitCounts) {
    test(`${qubitCount} qubit${qubitCount > 1 ? "s" : ""}`, async ({
      page,
      circuitInfo,
    }) => {
      const hGate = circuitInfo.gatePalette.hGate;

      for (let i = 0; i < qubitCount; i++) {
        if (i > 3) {
          await page.mouse.wheel(0, 100);
        }

        await grab(page, hGate);
        circuitInfo = await getCircuitInfo(page);

        await dropAt(page, { step: 0, bit: i });
      }

      await expect(page).toHaveScreenshot(
        `state-vector-${qubitCount}qubit.png`
      );
    });
  }
});
