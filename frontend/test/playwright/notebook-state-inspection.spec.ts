import { expect, test, type Page } from "@playwright/test";

type StepResult = {
  amplitudes: Record<string, [number, number]>;
  blochVectors: Record<string, { x: number; y: number; z: number }>;
  measuredBits: Record<string, number>;
};

const zeroResult = (basisIndex: number): StepResult => ({
  amplitudes: Object.fromEntries(
    Array.from({ length: 16 }, (_, index) => [
      String(index),
      index === basisIndex ? [1, 0] : [0, 0],
    ]),
  ),
  blochVectors: {},
  measuredBits: {},
});

const viewerState = {
  steps: [
    [{ type: "H", targets: [0] }],
    [{ type: "X", targets: [2], controls: [0] }],
    [{ type: "Z", targets: [3], controls: [1] }],
    [{ type: "X", targets: [3] }],
  ],
  qubit_count: 4,
  view: "notebook",
  editable: false,
  active_step_index: 0,
};

async function freezeWebGlCanvasForScreenshot(page: Page): Promise<void> {
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return;

    const image = document.createElement("img");
    image.src = canvas.toDataURL("image/png");
    image.alt = "Qni canvas snapshot";
    image.style.cssText = canvas.style.cssText;
    image.width = canvas.width;
    image.height = canvas.height;
    canvas.replaceWith(image);
  });
}

test.describe("QniNotebook intermediate-state inspection", () => {
  test("slides from the left edge to the requested final step", async ({ page }) => {
    const steps = Array.from({ length: 30 }, () => [
      { type: "X", targets: [0] },
    ]);
    const circuitOnlyState = {
      steps,
      qubit_count: 1,
      view: "circuit",
      editable: false,
      active_step_index: steps.length - 1,
      focus_active_step: true,
    };

    await page.route("**/backend.json", (route) =>
      route.fulfill({
        status: 200,
        json: steps.map(() => zeroResult(0)),
      }),
    );
    await page.goto(
      `/jupyter.html?state=${encodeURIComponent(JSON.stringify(circuitOnlyState))}`,
    );
    await page.waitForFunction(() => window.pixiApp !== undefined);
    const initialPosition = await page.evaluate(() => {
      const app = window.pixiApp!;
      const first = app.circuit.fetchStep(0);
      const last = app.circuit.fetchStep(app.circuit.steps.length - 1);
      return {
        firstX: first.getGlobalPosition().x,
        lastX: last.getGlobalPosition().x,
        width: window.innerWidth,
      };
    });
    expect(initialPosition.firstX).toBeGreaterThanOrEqual(0);
    expect(initialPosition.lastX).toBeGreaterThan(initialPosition.width);

    await page.waitForFunction(
      () => window.pixiApp?.element.dataset.state === "idle",
    );
    await expect
      .poll(() =>
        page.evaluate(() => {
          const app = window.pixiApp!;
          return app.circuit
            .fetchStep(app.circuit.steps.length - 1)
            .getGlobalPosition().x;
        }),
      )
      .toBeLessThan(initialPosition.width);
  });

  test("hides step boundaries in the circuit-only view", async ({ page }) => {
    const circuitOnlyState = { ...viewerState, view: "circuit" };

    await page.route("**/backend.json", (route) =>
      route.fulfill({
        status: 200,
        json: viewerState.steps.map(() => zeroResult(0)),
      }),
    );

    await page.goto(
      `/jupyter.html?state=${encodeURIComponent(JSON.stringify(circuitOnlyState))}`,
    );
    await page.waitForFunction(
      () => window.pixiApp?.element.dataset.state === "idle",
    );

    const mode = await page.evaluate(() => ({
      readOnly: window.pixiApp?.isJupyterReadOnly,
      circuitVisible: window.pixiApp?.circuitFrame.visible,
      stateVectorVisible: window.pixiApp?.stateVectorFrame.visible,
      paletteVisible: window.pixiApp?.circuitFrame.operationPalette.visible,
      stepMarkersVisible: window.pixiApp?.circuit.stepMarkersVisible,
    }));
    expect(mode).toEqual({
      readOnly: true,
      circuitVisible: true,
      stateVectorVisible: false,
      paletteVisible: false,
      stepMarkersVisible: false,
    });
    await expect(page.locator("#menu-container")).toBeHidden();
    // Pixiのゲート文字・輪郭が最初のフレームへ反映されてから固定する。
    await page.waitForTimeout(500);
    await freezeWebGlCanvasForScreenshot(page);
    await expect(page.locator("body")).toHaveScreenshot(
      "qni-notebook-circuit-only-layout.png",
      { animations: "disabled", maxDiffPixels: 3200 },
    );
  });

  test("shows final measurement bits in the circuit-only view", async ({
    page,
  }) => {
    const circuitOnlyState = {
      ...viewerState,
      steps: [
        [{ type: "H", targets: [0] }],
        [{ type: "Measure", targets: [0, 1, 2] }],
      ],
      view: "circuit",
      active_step_index: 1,
    };
    await page.route("**/backend.json", async (route) => {
      await route.fulfill({
        status: 200,
        json: [
          zeroResult(0),
          { ...zeroResult(5), measuredBits: { 0: 1, 1: 0, 2: 1 } },
        ],
      });
    });

    await page.goto(
      `/jupyter.html?state=${encodeURIComponent(JSON.stringify(circuitOnlyState))}`,
    );
    await page.waitForFunction(
      () => window.pixiApp?.element.dataset.state === "idle",
    );

    const measuredValues = await page.evaluate(() =>
      [0, 1, 2].map((qubit) => {
        const operation = window.pixiApp?.circuit
          .fetchStep(1)
          .fetchDropzone(qubit).operation;
        return operation && "value" in operation ? operation.value : undefined;
      }),
    );
    expect(measuredValues).toEqual([1, 0, 1]);
  });

  test("keeps the cell measurement while selecting step boundaries", async ({
    page,
  }) => {
    const simulationSeeds: string[] = [];
    const stateWithMeasurement = {
      ...viewerState,
      steps: [
        [{ type: "H", targets: [0] }],
        [{ type: "Measure", targets: [0, 1, 2] }],
      ],
      active_step_index: 0,
    };
    await page.route("**/backend.json", async (route) => {
      const body = new URLSearchParams(route.request().postData() ?? "");
      simulationSeeds.push(body.get("simulationSeed") ?? "");
      await route.fulfill({
        status: 200,
        json: [
          zeroResult(0),
          { ...zeroResult(5), measuredBits: { 0: 1, 1: 0, 2: 1 } },
        ],
      });
    });
    await page.goto(
      `/jupyter.html?state=${encodeURIComponent(JSON.stringify(stateWithMeasurement))}`,
    );
    await page.waitForFunction(
      () => window.pixiApp?.element.dataset.state === "idle",
    );

    const measurementValues = () =>
      page.evaluate(() =>
        [0, 1, 2].map((qubit) => {
          const operation = window.pixiApp?.circuit
            .fetchStep(1)
            .fetchDropzone(qubit).operation;
          return operation && "value" in operation
            ? operation.value
            : undefined;
        }),
      );
    expect(await measurementValues()).toEqual([1, 0, 1]);

    await page.evaluate(() => window.pixiApp?.circuit.fetchStep(1).activate());
    await page.waitForFunction(
      () => window.pixiApp?.element.dataset.state === "idle",
    );
    expect(await measurementValues()).toEqual([1, 0, 1]);

    await page.evaluate(() => window.pixiApp?.circuit.fetchStep(0).activate());
    await page.waitForFunction(
      () => window.pixiApp?.element.dataset.state === "idle",
    );
    expect(await measurementValues()).toEqual([1, 0, 1]);
    expect(simulationSeeds.length).toBeGreaterThanOrEqual(3);
    expect(new Set(simulationSeeds).size).toBe(1);
    expect(simulationSeeds[0]).not.toBe("");
  });

  test("hides editing controls before the notebook app initializes", async ({
    page,
  }) => {
    await page.route("**/jupyter-main.ts", (route) => route.abort());

    await page.goto(
      `/jupyter.html?state=${encodeURIComponent(JSON.stringify(viewerState))}`,
    );

    await expect(page.locator("#menu-container")).toBeHidden();
    await expect(page.locator("#demo-header")).toBeVisible();
  });

  test("shows the read-only purpose and updates to the selected step", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1000, height: 360 });
    await page.route("**/backend.json", async (route) => {
      const body = new URLSearchParams(route.request().postData() ?? "");
      const selectedStep = Number(body.get("untilStepIndex"));
      const results = viewerState.steps.map((_, index) =>
        zeroResult(index <= selectedStep ? (selectedStep === 3 ? 2 : 0) : 0),
      );
      await route.fulfill({ status: 200, json: results });
    });

    await page.goto(
      `/jupyter.html?state=${encodeURIComponent(JSON.stringify(viewerState))}&height=360`,
    );
    await expect(page.locator("#demo-header")).toBeVisible();
    await expect(page.locator("#demo-header")).toContainText(
      "回路のステップ境界を選ぶと、その時点までの状態を確認できます",
    );
    await expect(page.locator("#menu-container")).toBeHidden();
    await page.waitForFunction(
      () => window.pixiApp?.element.dataset.state === "idle",
    );
    await expect(page.getByLabel("State vector shape 4 by 4")).toBeVisible();

    const chromeLayout = await page.evaluate(() => ({
      headerBottom:
        document.getElementById("demo-header")?.getBoundingClientRect().bottom,
      circuitTop: window.pixiApp?.circuitFrame.y,
      stateControlsBottom: document
        .querySelector('[data-jupyter-side-panel-header="true"]')
        ?.getBoundingClientRect().bottom,
      stateVectorTop: window.pixiApp?.stateVectorFrame.y,
    }));
    expect(chromeLayout.circuitTop).toBeGreaterThanOrEqual(
      chromeLayout.headerBottom ?? 0,
    );
    expect(
      Math.abs(
        (chromeLayout.stateVectorTop ?? 0) -
          (chromeLayout.stateControlsBottom ?? 0),
      ),
    ).toBeLessThanOrEqual(1);

    const visibleStateCount = await page.evaluate(
      () => window.pixiApp?.stateVector.visibleQubitCircleIndices.length,
    );
    expect(visibleStateCount).toBe(16);
    await page.evaluate(() => window.pixiApp?.circuit.fetchStep(3).activate());
    await page.waitForFunction(() => window.pixiApp?.element.dataset.state === "idle");

    const probabilities = await page.evaluate(() => ({
      basis0: window.pixiApp?.stateVector.qubitCircleAt(0)?.probability,
      basis2: window.pixiApp?.stateVector.qubitCircleAt(2)?.probability,
    }));
    expect(probabilities).toEqual({ basis0: 0, basis2: 100 });
    await freezeWebGlCanvasForScreenshot(page);
    await expect(page.locator("body")).toHaveScreenshot(
      "qni-notebook-read-only-layout.png",
      { animations: "disabled", maxDiffPixels: 64 },
    );
  });

  test("does not let an older step response overwrite the current state", async ({
    page,
  }) => {
    await page.route("**/backend.json", async (route) => {
      const body = new URLSearchParams(route.request().postData() ?? "");
      const selectedStep = Number(body.get("untilStepIndex"));
      if (selectedStep === 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      const basisIndex = selectedStep === 3 ? 2 : 0;
      await route.fulfill({
        status: 200,
        json: viewerState.steps.map(() => zeroResult(basisIndex)),
      });
    });

    await page.goto(
      `/jupyter.html?state=${encodeURIComponent(JSON.stringify(viewerState))}`,
    );
    await page.waitForFunction(() => window.pixiApp !== undefined);
    await page.evaluate(() => window.pixiApp?.circuit.fetchStep(3).activate());
    await page.waitForFunction(() => window.pixiApp?.element.dataset.state === "idle");
    await page.waitForTimeout(300);

    const probabilities = await page.evaluate(() => ({
      basis0: window.pixiApp?.stateVector.qubitCircleAt(0)?.probability,
      basis2: window.pixiApp?.stateVector.qubitCircleAt(2)?.probability,
    }));
    expect(probabilities).toEqual({ basis0: 0, basis2: 100 });
  });

  test("shows backend availability failures in the notebook", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1000, height: 360 });
    let requestCount = 0;
    await page.route("**/backend.json", async (route) => {
      requestCount += 1;
      if (requestCount === 1) {
        await route.fulfill({
          status: 200,
          json: viewerState.steps.map(() => zeroResult(0)),
        });
        return;
      }
      await route.fulfill({
        status: 503,
        json: { error: "State simulation is temporarily unavailable" },
      });
    });
    await page.goto(
      `/jupyter.html?state=${encodeURIComponent(JSON.stringify(viewerState))}&height=360`,
    );
    await page.waitForFunction(
      () => window.pixiApp?.element.dataset.state === "idle",
    );
    await page.evaluate(() => window.pixiApp?.circuit.fetchStep(3).activate());

    const errorBanner = page.locator("#simulation-error");
    await expect(errorBanner).toContainText(
      "State simulation is temporarily unavailable",
    );
    await page.waitForTimeout(500);
    await freezeWebGlCanvasForScreenshot(page);
    await expect(page.locator("body")).toHaveScreenshot(
      "qni-notebook-backend-unavailable-layout.png",
      { animations: "disabled", maxDiffPixels: 64 },
    );
  });

  test("renders known complex amplitudes as probability and phase", async ({
    page,
  }) => {
    const complexState: StepResult = {
      amplitudes: {
        "0": [0.5, 0],
        "1": [0, 0.5],
        "2": [-0.5, 0],
        "3": [0, -0.5],
      },
      blochVectors: {},
      measuredBits: {},
    };
    await page.route("**/backend.json", (route) =>
      route.fulfill({
        status: 200,
        json: viewerState.steps.map(() => complexState),
      }),
    );
    await page.goto(
      `/jupyter.html?state=${encodeURIComponent(JSON.stringify(viewerState))}`,
    );
    await page.waitForFunction(() => window.pixiApp?.element.dataset.state === "idle");

    const displayed = await page.evaluate(() =>
      Array.from({ length: 4 }, (_, index) => {
        const circle = window.pixiApp?.stateVector.qubitCircleAt(index);
        return { probability: circle?.probability, phase: circle?.phase };
      }),
    );
    expect(displayed.map(({ probability }) => probability)).toEqual([
      25, 25, 25, 25,
    ]);
    expect(displayed[0].phase).toBeCloseTo(0);
    expect(displayed[1].phase).toBeCloseTo(Math.PI / 2);
    expect(Math.abs(displayed[2].phase ?? 0)).toBeCloseTo(Math.PI);
    expect(displayed[3].phase).toBeCloseTo(-Math.PI / 2);
  });

  test("renders the Bloch vector returned for a checkpoint", async ({ page }) => {
    const stateWithBloch = {
      ...viewerState,
      steps: [
        [{ type: "H", targets: [0] }],
        [{ type: "Bloch", targets: [0] }],
      ],
      active_step_index: 1,
    };
    await page.route("**/backend.json", (route) =>
      route.fulfill({
        status: 200,
        json: [zeroResult(0), {
          ...zeroResult(0),
          blochVectors: { "0": { x: 1, y: 0, z: 0 } },
        }],
      }),
    );
    await page.goto(
      `/jupyter.html?state=${encodeURIComponent(JSON.stringify(stateWithBloch))}`,
    );
    await page.waitForFunction(() => window.pixiApp?.element.dataset.state === "idle");

    const vector = await page.evaluate(() => {
      const operation = window.pixiApp?.circuit.fetchStep(1).fetchDropzone(0).operation;
      return operation && "x" in operation && "y" in operation && "z" in operation
        ? { x: operation.x, y: operation.y, z: operation.z }
        : null;
    });
    expect(vector).toEqual({ x: 1, y: 0, z: 0 });
  });
});
