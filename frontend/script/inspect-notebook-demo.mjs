/* global process, window */

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const viewerUrl = process.argv[2];
if (!viewerUrl) throw new Error("viewer URL is required");
const serializedState = new URL(viewerUrl).searchParams.get("state");
if (!serializedState) throw new Error("viewer URL state is required");
const viewerState = JSON.parse(serializedState);
const stepCount = viewerState.steps?.length ?? 0;
const basisStateCount = 2 ** (viewerState.qubit_count ?? 0);
const screenshotDir = process.env.QNI_SCREENSHOT_DIR;
if (screenshotDir) await mkdir(screenshotDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 560 } });
  await page.goto(viewerUrl);
  await page.waitForFunction(() => window.pixiApp?.element.dataset.state === "idle");
  await page.evaluate(() => {
    window.pixiApp?.setJupyterSidePanelWidth(900);
    window.pixiApp?.setJupyterStateVectorAspectIndex(3);
  });

  const stateByStep = [];
  const measuredByStep = [];
  for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
    await page.evaluate((index) => window.pixiApp?.circuit.fetchStep(index).activate(), stepIndex);
    await page.waitForFunction(() => window.pixiApp?.element.dataset.state === "idle");
    if (screenshotDir) {
      await page.screenshot({ path: join(screenshotDir, `step-${stepIndex}.png`) });
    }
    stateByStep.push(
      await page.evaluate((stateCount) =>
        Array.from({ length: stateCount }, (_, index) => ({
          index,
          probability: window.pixiApp?.stateVector.qubitCircleAt(index)?.probability ?? 0,
          phase: window.pixiApp?.stateVector.qubitCircleAt(index)?.phase ?? 0,
        }))
          .filter(({ probability }) => probability > 0.0001)
          .map(({ index, probability, phase }) => ({ index, probability, phase })),
        basisStateCount,
      ),
    );
    measuredByStep.push(
      await page.evaluate(({ stepCount: circuitStepCount, qubitCount }) => {
        const measured = {};
        for (let circuitStep = 0; circuitStep < circuitStepCount; circuitStep += 1) {
          const step = window.pixiApp?.circuit.fetchStep(circuitStep);
          for (let bit = 0; bit < qubitCount; bit += 1) {
            const operation = step?.fetchDropzone(bit).operation;
            if (
              operation?.operationType === "MeasurementGate" &&
              (operation.value === 0 || operation.value === 1)
            ) {
              measured[bit] = operation.value;
            }
          }
        }
        return measured;
      }, { stepCount, qubitCount: viewerState.qubit_count ?? 0 }),
    );
  }

  let revisitedMeasurement = {};
  if (stepCount > 1) {
    await page.evaluate(() => window.pixiApp?.circuit.fetchStep(0).activate());
    await page.waitForFunction(() => window.pixiApp?.element.dataset.state === "idle");
    await page.evaluate((index) => window.pixiApp?.circuit.fetchStep(index).activate(), stepCount - 1);
    await page.waitForFunction(() => window.pixiApp?.element.dataset.state === "idle");
    revisitedMeasurement = await page.evaluate(({ index, qubitCount }) => {
      const measured = {};
      const step = window.pixiApp?.circuit.fetchStep(index);
      for (let bit = 0; bit < qubitCount; bit += 1) {
        const operation = step?.fetchDropzone(bit).operation;
        if (
          operation?.operationType === "MeasurementGate" &&
          (operation.value === 0 || operation.value === 1)
        ) {
          measured[bit] = operation.value;
        }
      }
      return measured;
    }, { index: stepCount - 1, qubitCount: viewerState.qubit_count ?? 0 });
  }

  const headerVisible = await page.locator("#demo-header").isVisible();
  const editMenuHidden = await page.locator("#menu-container").isHidden();
  process.stdout.write(
    JSON.stringify({
      stateByStep,
      measuredByStep,
      revisitedMeasurement,
      headerVisible,
      editMenuHidden,
    }),
  );
} finally {
  await browser.close();
}
