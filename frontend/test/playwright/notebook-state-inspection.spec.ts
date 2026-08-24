import { expect, test } from "@playwright/test";

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

test.describe("QniNotebook intermediate-state inspection", () => {
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
    await page.route("http://localhost:8000/backend.json", async (route) => {
      const body = new URLSearchParams(route.request().postData() ?? "");
      const selectedStep = Number(body.get("untilStepIndex"));
      const results = viewerState.steps.map((_, index) =>
        zeroResult(index <= selectedStep ? (selectedStep === 3 ? 2 : 0) : 0),
      );
      await route.fulfill({ status: 200, json: results });
    });

    await page.goto(
      `/jupyter.html?state=${encodeURIComponent(JSON.stringify(viewerState))}`,
    );
    await expect(page.locator("#demo-header")).toBeVisible();
    await expect(page.locator("#demo-header")).toContainText(
      "回路のステップ境界を選ぶと、その時点までの状態を確認できます",
    );
    await expect(page.locator("#menu-container")).toBeHidden();

    const chromeLayout = await page.evaluate(() => ({
      headerBottom:
        document.getElementById("demo-header")?.getBoundingClientRect().bottom,
      circuitTop: window.pixiApp?.circuitFrame.y,
    }));
    expect(chromeLayout.circuitTop).toBeGreaterThanOrEqual(
      chromeLayout.headerBottom ?? 0,
    );

    await page.waitForFunction(() => window.pixiApp?.element.dataset.state === "idle");
    await page.evaluate(() => window.pixiApp?.circuit.fetchStep(3).activate());
    await page.waitForFunction(() => window.pixiApp?.element.dataset.state === "idle");

    const probabilities = await page.evaluate(() => ({
      basis0: window.pixiApp?.stateVector.qubitCircleAt(0)?.probability,
      basis2: window.pixiApp?.stateVector.qubitCircleAt(2)?.probability,
    }));
    expect(probabilities).toEqual({ basis0: 0, basis2: 100 });
    await expect(page).toHaveScreenshot("qni-notebook-read-only-layout.png", {
      animations: "disabled",
    });
  });

  test("does not let an older step response overwrite the current state", async ({
    page,
  }) => {
    await page.route("http://localhost:8000/backend.json", async (route) => {
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

  test("shows backend failures in the notebook", async ({ page }) => {
    await page.route("http://localhost:8000/backend.json", (route) =>
      route.fulfill({ status: 400, json: { error: "Unsupported demo circuit" } }),
    );
    await page.goto(
      `/jupyter.html?state=${encodeURIComponent(JSON.stringify(viewerState))}`,
    );

    await expect(page.locator("#simulation-error")).toContainText(
      "Unsupported demo circuit",
    );
    await expect(page).toHaveScreenshot("qni-notebook-backend-error.png", {
      animations: "disabled",
    });
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
    await page.route("http://localhost:8000/backend.json", (route) =>
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
    await page.route("http://localhost:8000/backend.json", (route) =>
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
      return operation && "x" in operation
        ? { x: operation.x, y: operation.y, z: operation.z }
        : null;
    });
    expect(vector).toEqual({ x: 1, y: 0, z: 0 });
  });
});
