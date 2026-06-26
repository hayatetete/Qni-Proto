import { fail } from "assert";
import { Page } from "playwright/test";
import { OperationComponent } from "../../src";
import { Container, Point } from "pixi.js";

export async function appData(page: Page) {
  const appEl = page.locator("#app");
  const dataApp = await appEl.getAttribute("data-app");

  if (dataApp === null) {
    fail("data-app is null");
  }

  return JSON.parse(dataApp);
}

export function centerPosition(gate: OperationComponent) {
  return new Point(gate.x + gate.width / 2, gate.y + gate.height / 2);
}

interface CircuitInfo {
  gatePalette: {
    hGate: { x: number; y: number; size: number };
    xGate: { x: number; y: number; size: number };
    yGate: { x: number; y: number; size: number };
    zGate: { x: number; y: number; size: number };
    rnotGate: { x: number; y: number; size: number };
    sGate: { x: number; y: number; size: number };
    sDaggerGate: { x: number; y: number; size: number };
    tGate: { x: number; y: number; size: number };
    tDaggerGate: { x: number; y: number; size: number };
    swapGate: { x: number; y: number; size: number };
    controlGate: { x: number; y: number; size: number };
    write0Gate: { x: number; y: number; size: number };
    write1Gate: { x: number; y: number; size: number };
    measurementGate: { x: number; y: number; size: number };
  };
  steps: { x: number; y: number }[][];
}

export async function getCircuitInfo(page: Page): Promise<CircuitInfo> {
  // アプリケーションの初期化を待つ
  await page.waitForFunction(() => window.pixiApp !== undefined);

  return await page.evaluate(async () => {
    const getInfo = (): CircuitInfo => {
      const { circuitFrame, gatePalette } = window.pixiApp ?? {};
      const { circuit } = circuitFrame ?? {};
      const {
        HGate: hGate,
        XGate: xGate,
        YGate: yGate,
        ZGate: zGate,
        RnotGate: rnotGate,
        SGate: sGate,
        SDaggerGate: sDaggerGate,
        TGate: tGate,
        TDaggerGate: tDaggerGate,
        SwapGate: swapGate,
        ControlGate: controlGate,
        Write0Gate: write0Gate,
        Write1Gate: write1Gate,
        MeasurementGate: measurementGate,
      } = gatePalette?.operations ?? {};

      if (
        !circuit ||
        !gatePalette ||
        !hGate ||
        !xGate ||
        !yGate ||
        !zGate ||
        !rnotGate ||
        !sGate ||
        !sDaggerGate ||
        !tGate ||
        !tDaggerGate ||
        !swapGate ||
        !controlGate ||
        !write0Gate ||
        !write1Gate ||
        !measurementGate
      ) {
        throw new Error("Required components are not initialized");
      }

      const getBounds = (component: Container) => {
        const bounds = component.getBounds();
        return {
          x: bounds.x + bounds.width / 2,
          y: bounds.y + bounds.height / 2,
          size: bounds.width,
        };
      };

      return {
        gatePalette: {
          hGate: getBounds(hGate),
          xGate: getBounds(xGate),
          yGate: getBounds(yGate),
          zGate: getBounds(zGate),
          rnotGate: getBounds(rnotGate),
          sGate: getBounds(sGate),
          sDaggerGate: getBounds(sDaggerGate),
          tGate: getBounds(tGate),
          tDaggerGate: getBounds(tDaggerGate),
          swapGate: getBounds(swapGate),
          controlGate: getBounds(controlGate),
          write0Gate: getBounds(write0Gate),
          write1Gate: getBounds(write1Gate),
          measurementGate: getBounds(measurementGate),
        },
        steps: circuit.steps.map((step) =>
          step.dropzones.map((dropzone) => getBounds(dropzone))
        ),
      };
    };

    // 複数回試行する
    for (let i = 0; i < 10; i++) {
      try {
        const info = getInfo();
        if (
          info.gatePalette.hGate.x !== 0 &&
          info.gatePalette.hGate.y !== 0 &&
          info.gatePalette.yGate.x !== 0 &&
          info.gatePalette.yGate.y !== 0 &&
          info.gatePalette.zGate.x !== 0 &&
          info.gatePalette.zGate.y !== 0 &&
          info.gatePalette.rnotGate.x !== 0 &&
          info.gatePalette.rnotGate.y !== 0 &&
          info.gatePalette.sGate.x !== 0 &&
          info.gatePalette.sGate.y !== 0 &&
          info.gatePalette.sDaggerGate.x !== 0 &&
          info.gatePalette.sDaggerGate.y !== 0 &&
          info.gatePalette.tGate.x !== 0 &&
          info.gatePalette.tGate.y !== 0 &&
          info.gatePalette.tDaggerGate.x !== 0 &&
          info.gatePalette.tDaggerGate.y !== 0 &&
          info.gatePalette.swapGate.x !== 0 &&
          info.gatePalette.swapGate.y !== 0 &&
          info.gatePalette.controlGate.x !== 0 &&
          info.gatePalette.controlGate.y !== 0 &&
          info.gatePalette.write0Gate.x !== 0 &&
          info.gatePalette.write0Gate.y !== 0 &&
          info.gatePalette.write1Gate.x !== 0 &&
          info.gatePalette.write1Gate.y !== 0 &&
          info.gatePalette.measurementGate.x !== 0 &&
          info.gatePalette.measurementGate.y !== 0
        ) {
          return info;
        }
      } catch (error) {
        console.error("Error getting circuit info:", error);
      }
      // 少し待ってから再試行
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error("Failed to get valid circuit info after multiple attempts");
  });
}

export async function dragAndDrop(
  page: Page,
  source: { x: number; y: number },
  target:
    | { step: number; bit: number }
    | { beforeStep: number; bit: number }
    | { afterStep: number; bit: number }
) {
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();

  let targetDropzone: { x: number; y: number };
  const circuitInfo = await getCircuitInfo(page);
  if ("step" in target) {
    targetDropzone = circuitInfo.steps[target.step][target.bit];
  } else if ("beforeStep" in target) {
    targetDropzone = circuitInfo.steps[target.beforeStep][target.bit];
    targetDropzone.x -= circuitInfo.gatePalette.hGate.size / 2;
  } else {
    targetDropzone = circuitInfo.steps[target.afterStep][target.bit];
    targetDropzone.x += circuitInfo.gatePalette.hGate.size / 2;
  }

  await page.mouse.move(targetDropzone.x, targetDropzone.y);
  await page.mouse.up();

  await page.waitForSelector('#app[data-state="idle"]', {
    state: "attached",
    timeout: 5000,
  });
}

export async function activateStep(page: Page, stepIndex: number) {
  const circuitInfo = await getCircuitInfo(page);
  const dropzone = circuitInfo.steps[stepIndex][0];

  await page.mouse.move(dropzone.x, dropzone.y);
  await page.mouse.down();
  await page.mouse.up();

  await page.waitForSelector('#app[data-state="idle"]', {
    state: "attached",
    timeout: 5000,
  });
}

export async function grab(page: Page, target: { x: number; y: number }) {
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
}

export async function dropAt(
  page: Page,
  target: { step: number; bit: number }
) {
  const circuitInfo = await getCircuitInfo(page);
  const dropzone = circuitInfo.steps[target.step][target.bit];

  await page.mouse.move(dropzone.x, dropzone.y);
  await page.mouse.up();

  await page.waitForSelector('#app[data-state="idle"]', {
    state: "attached",
    timeout: 5000,
  });
}
