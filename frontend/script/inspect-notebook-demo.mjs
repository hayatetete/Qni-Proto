/* global process, window */

import { chromium } from "playwright";

const viewerUrl = process.argv[2];
if (!viewerUrl) throw new Error("viewer URL is required");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 560 } });
  await page.goto(viewerUrl);
  await page.waitForFunction(() => window.pixiApp?.element.dataset.state === "idle");

  const supportByStep = [];
  for (let stepIndex = 0; stepIndex < 6; stepIndex += 1) {
    await page.evaluate((index) => window.pixiApp?.circuit.fetchStep(index).activate(), stepIndex);
    await page.waitForFunction(() => window.pixiApp?.element.dataset.state === "idle");
    supportByStep.push(
      await page.evaluate(() =>
        Array.from({ length: 16 }, (_, index) => ({
          index,
          probability: window.pixiApp?.stateVector.qubitCircleAt(index)?.probability ?? 0,
        }))
          .filter(({ probability }) => probability > 0.0001)
          .map(({ index }) => index),
      ),
    );
  }

  const headerVisible = await page.locator("#demo-header").isVisible();
  const editMenuHidden = await page.locator("#menu-container").isHidden();
  process.stdout.write(JSON.stringify({ supportByStep, headerVisible, editMenuHidden }));
} finally {
  await browser.close();
}
