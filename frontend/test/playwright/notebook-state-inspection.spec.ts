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
  test("keeps only the initial boundary and real circuit columns", async ({
    page,
  }) => {
    const state = {
      ...viewerState,
      steps: [[{ type: "H", targets: [0] }]],
      qubit_count: 1,
    };
    await page.route("**/backend.json", (route) =>
      route.fulfill({ status: 200, json: [zeroResult(0), zeroResult(0)] }),
    );
    await page.goto(
      `/jupyter.html?state=${encodeURIComponent(JSON.stringify(state))}`,
    );
    await page.waitForFunction(() => window.pixiApp?.element.dataset.state === "idle");

    await expect(page.getByRole("slider", { name: "Circuit step" })).toHaveAttribute(
      "max",
      "1",
    );
    await expect
      .poll(() => page.evaluate(() => window.pixiApp?.circuit.steps.length))
      .toBe(2);
  });

  test("renders the state vector at high-DPI backing resolution", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 900, height: 520 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.route("**/backend.json", (route) => route.fulfill({ status: 200, json: [zeroResult(0), ...viewerState.steps.map(() => zeroResult(0))] }));
    await page.goto(`/jupyter.html?state=${encodeURIComponent(JSON.stringify(viewerState))}`);
    await page.waitForFunction(() => window.pixiApp?.element.dataset.state === "idle");
    const density = await page.locator("canvas").evaluate((canvas) => ({ backing: canvas.width, css: canvas.getBoundingClientRect().width, dpr: devicePixelRatio }));
    expect(density.dpr).toBe(2);
    expect(density.backing).toBe(Math.round(density.css * 2));
    await context.close();
  });

  test("reports the first failed checkpoint and shows major states", async ({ page }) => {
    test.setTimeout(60_000);
    const state = {
      ...viewerState,
      checkpoints: [
        { name: "Initial", step: 0, expected_probabilities: { "0000": 1 } },
        { name: "Expected X", step: 1, expected_probabilities: { "0001": 1 }, source: "build(): line 12" },
      ],
      qubit_names: ["data 0", "data 1", "work", "flag"],
    };
    await page.route("**/backend.json", (route) => route.fulfill({
      status: 200,
      json: [zeroResult(0), ...viewerState.steps.map(() => zeroResult(0))],
    }));
    await page.goto(`/jupyter.html?state=${encodeURIComponent(JSON.stringify(state))}`);
    await page.waitForFunction(() => window.pixiApp?.element.dataset.state === "idle");

    const panel = page.locator("#qni-inspection-panel");
    const toggle = page.locator("#inspection-panel-toggle");
    await expect(toggle.locator("img")).toHaveAttribute("src", "/icons/inspection.svg");
    await expect(toggle).toHaveClass(/bg-sky-500/);
    await expect(toggle).toHaveClass(/border-2/);
    await expect.poll(() => toggle.evaluate((element) => element.classList.contains("border-purple-500"))).toBe(true);
    await expect.poll(() => toggle.evaluate((element) => element.classList.contains("border-sky-700"))).toBe(false);
    await expect(panel).toContainText("First failure: Step 1");
    await expect(panel).toContainText("Expected X");
    await expect(panel).toContainText("Why this checkpoint failed");
    await expect(panel).toContainText("|0001⟩ probability");
    await expect(panel.locator(".inspection-failure-table")).toContainText("ExpectedActualDifference");
    await expect(panel.locator(".inspection-failure-table")).toContainText("100.0%0.000%−100.0%");
    await expect(panel).toContainText("|0000⟩");
    await expect(panel.locator(".inspection-basis-label").first()).toContainText("|0000⟩|0⟩10");
    const basisLabelBox = await panel.locator(".inspection-basis-label").first().boundingBox();
    const decimalLabelBox = await panel.locator(".inspection-basis-decimal").first().boundingBox();
    expect(Math.abs((decimalLabelBox?.y ?? 0) - (basisLabelBox?.y ?? 0))).toBeLessThan(1);
    await expect(panel).not.toContainText("How to read basis labels");
    await expect(panel).toContainText("q2work");
    await expect(panel).toContainText("q3flag");
    await expect(panel).toContainText("1.000");
    const passedStatus = panel.getByText("PASS", { exact: true });
    await expect(passedStatus).toHaveClass(/inspection-status-pass/);
    expect(await passedStatus.evaluate((element) => getComputedStyle(element).color)).toBe("rgb(16, 185, 129)");
    await expect(panel.getByText("FAIL", { exact: true })).toHaveClass(/inspection-status-fail/);
    await expect(panel.locator("[data-phase-degrees='0']")).toBeVisible();
    expect(await panel.locator(".inspection-probability-fill").first().evaluate((element) => getComputedStyle(element).borderRadius)).toBe("0px");
    const inspectionSlider = panel.getByRole("slider", { name: "Inspection step" });
    const inspectionStepNumber = panel.getByRole("spinbutton", { name: "Inspection step number" });
    await expect(inspectionSlider).toHaveAttribute("max", "4");
    await expect(inspectionSlider).toHaveValue("0");
    await expect(inspectionStepNumber).toHaveValue("0");
    await expect(panel.locator("#inspection-step-ticks > span")).toHaveCount(5);
    await expect(panel).toHaveScreenshot("qni-inspection-checkpoint-panel.png", {
      animations: "disabled",
    });

    await inspectionSlider.fill("3");
    await expect(page.getByRole("slider", { name: "Circuit step" })).toHaveValue("3");
    await expect(inspectionStepNumber).toHaveValue("3");
    await inspectionStepNumber.fill("2");
    await inspectionStepNumber.press("Enter");
    await expect(page.getByRole("slider", { name: "Circuit step" })).toHaveValue("2");

    await expect(panel.locator("header button")).toHaveCount(1);
    await expect(page.locator("#inspection-panel-toggle")).toHaveAttribute(
      "aria-label",
      "Inspect",
    );

    const beforeMove = await panel.boundingBox();
    if (!beforeMove) throw new Error("Inspection panel is not visible");
    await page.mouse.move(beforeMove.x + 80, beforeMove.y + 16);
    await page.mouse.down();
    await page.mouse.move(beforeMove.x - 40, beforeMove.y + 46, { steps: 5 });
    await page.mouse.up();
    const afterMove = await panel.boundingBox();
    expect(afterMove?.x).toBeLessThan(beforeMove.x);

    const southeast = panel.getByRole("button", { name: /Resize state inspection se/ });
    const resizePoint = await southeast.boundingBox();
    const beforeResize = await panel.boundingBox();
    if (!resizePoint || !beforeResize) throw new Error("Resize handle is not visible");
    await page.mouse.move(resizePoint.x + 2, resizePoint.y + 2);
    await page.mouse.down();
    await page.mouse.move(resizePoint.x + 42, resizePoint.y + 32, { steps: 5 });
    await page.mouse.up();
    const afterResize = await panel.boundingBox();
    expect(afterResize?.width).toBeGreaterThan(beforeResize.width);
    expect(afterResize?.height).toBeGreaterThan(beforeResize.height);

    await toggle.click();
    await expect(panel).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect.poll(() => toggle.evaluate((element) => element.classList.contains("border-sky-700"))).toBe(true);
    await expect.poll(() => toggle.evaluate((element) => element.classList.contains("border-purple-500"))).toBe(false);
    await toggle.click();
    await expect(panel).toBeVisible();
  });

  test("shows dominant states first and keeps lower-priority states collapsed", async ({ page }) => {
    const state = {
      ...viewerState,
      active_step_index: 1,
      checkpoints: [
        { name: "Initial", step: 0, expected_probabilities: { "0000": 1 } },
      ],
    };
    const distributed: StepResult = {
      ...zeroResult(0),
      amplitudes: Object.fromEntries(
        Array.from({ length: 16 }, (_, index) => [
          String(index),
          index < 10 ? [0.25, 0] : [0, 0],
        ]),
      ),
    };
    await page.route("**/backend.json", (route) => route.fulfill({
      status: 200,
      json: [zeroResult(0), distributed, ...viewerState.steps.slice(1).map(() => distributed)],
    }));
    await page.goto(`/jupyter.html?state=${encodeURIComponent(JSON.stringify(state))}`);
    await page.waitForFunction(() => window.pixiApp?.element.dataset.state === "idle");

    const panel = page.locator("#qni-inspection-panel");
    await expect(panel.getByText("Dominant states")).toBeVisible();
    const allPassed = panel.getByText("All checkpoints passed", { exact: true });
    await expect(allPassed).toHaveClass(/inspection-status-pass/);
    await expect(allPassed.locator("svg")).toBeVisible();
    await expect(panel.locator("tbody tr:visible")).toHaveCount(8);
    const more = panel.locator("details").filter({ hasText: "Show more states (2)" });
    await expect(more).not.toHaveAttribute("open", "");
    await expect(panel).toHaveScreenshot("qni-inspection-all-passed-panel.png", {
      animations: "disabled",
    });
    await more.locator("summary").click();
    await expect(panel.locator("tbody tr:visible")).toHaveCount(10);
  });

  test("shows the Python source associated with the selected boundary", async ({ page }) => {
    const state = {
      steps: [[{
        type: "H",
        targets: [0],
        source: {
          line: 5,
          code: "circuit.add_H_gate(qubit)",
          scope: "module > build() > for qubit=0",
        },
      }]],
      qubit_count: 1,
      view: "notebook",
      editable: false,
      active_step_index: 1,
      checkpoints: [
        { name: "Prepared", step: 1, expected_probabilities: { "0": 1 } },
      ],
    };
    await page.route("**/backend.json", (route) => route.fulfill({
      status: 200,
      json: [zeroResult(0), zeroResult(0)],
    }));
    await page.goto(`/jupyter.html?state=${encodeURIComponent(JSON.stringify(state))}`);
    await page.waitForFunction(() => window.pixiApp?.element.dataset.state === "idle");

    const panel = page.locator("#qni-inspection-panel");
    await expect(panel).toContainText("Python source");
    await expect(panel).toContainText("L5");
    await expect(panel).toContainText("circuit.add_H_gate(qubit)");
    await expect(panel).toContainText("module > build() > for qubit=0");
  });

  test("shows an equivalent decimal ket and rotates positive phase clockwise", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 369 });
    const state = {
      steps: [[{ type: "H", targets: [7] }]],
      qubit_count: 8,
      view: "notebook",
      editable: false,
      active_step_index: 1,
      checkpoints: [
        { name: "High basis index", step: 1, expected_probabilities: { "11111111": 1 } },
      ],
    };
    const basis255 = {
      ...zeroResult(0),
      amplitudes: Object.fromEntries(
        Array.from({ length: 256 }, (_, index) => [
          String(index),
          index === 255 ? [0, 1] : [0, 0],
        ]),
      ),
    };
    await page.route("**/backend.json", (route) => route.fulfill({
      status: 200,
      json: [zeroResult(0), basis255],
    }));
    await page.goto(`/jupyter.html?state=${encodeURIComponent(JSON.stringify(state))}`);
    await page.waitForFunction(() => window.pixiApp?.element.dataset.state === "idle");

    const panel = page.locator("#qni-inspection-panel");
    const basis = panel.locator(".inspection-basis-label").first();
    await expect(basis).toContainText("|11111111⟩|255⟩10");
    await expect(basis.locator(".inspection-basis-decimal")).toHaveAttribute(
      "aria-label",
      "decimal index 255",
    );
    const phase = panel.locator("[data-phase-degrees='90']");
    await expect(phase).toBeVisible();
    await expect(phase.locator(".inspection-phase-sector")).toHaveAttribute("d", /A6 6 0 0 1 14\.000 8\.000/);
    await expect(phase.locator("path[transform]")).toHaveAttribute("transform", "rotate(90 8 8)");
    const panelBox = await panel.boundingBox();
    expect((panelBox?.y ?? 0) + (panelBox?.height ?? 0)).toBeLessThanOrEqual(369);
  });

  test("does not report success while a checkpoint is still unevaluated", async ({ page }) => {
    const state = {
      ...viewerState,
      checkpoints: [
        { name: "Later boundary", step: 4, expected_probabilities: { "0000": 1 } },
      ],
    };
    await page.route("**/backend.json", (route) => route.fulfill({
      status: 200,
      json: [zeroResult(0)],
    }));
    await page.goto(`/jupyter.html?state=${encodeURIComponent(JSON.stringify(state))}`);
    await page.waitForFunction(() => window.pixiApp?.element.dataset.state === "idle");

    const panel = page.locator("#qni-inspection-panel");
    await expect(panel).toContainText("Waiting for simulation…");
    await expect(panel).toContainText("WAIT");
    await expect(panel).not.toContainText("All checkpoints passed");
  });

  test("reports the earliest failed boundary even when checkpoints are unordered", async ({ page }) => {
    const state = {
      ...viewerState,
      checkpoints: [
        { name: "Later failure", step: 3, expected_probabilities: { "0001": 1 } },
        { name: "Earlier failure", step: 1, expected_probabilities: { "0010": 1 } },
      ],
    };
    await page.route("**/backend.json", (route) => route.fulfill({
      status: 200,
      json: [zeroResult(0), ...viewerState.steps.map(() => zeroResult(0))],
    }));
    await page.goto(`/jupyter.html?state=${encodeURIComponent(JSON.stringify(state))}`);
    await page.waitForFunction(() => window.pixiApp?.element.dataset.state === "idle");

    await expect(page.locator("#qni-inspection-panel")).toContainText(
      "First failure: Step 1",
    );
  });

  test("starts one simulation after the circuit and qubit count are initialized", async ({
    page,
  }) => {
    const eightQubitState = {
      ...viewerState,
      qubit_count: 8,
      backendUrl: "http://127.0.0.1:9876/backend.json",
    };
    const requests: URLSearchParams[] = [];
    const requestUrls: string[] = [];
    await page.route("**/backend.json", (route) => {
      requestUrls.push(route.request().url());
      requests.push(new URLSearchParams(route.request().postData() ?? ""));
      return route.fulfill({
        status: 200,
        json: [zeroResult(0), ...eightQubitState.steps.map(() => zeroResult(0))],
      });
    });

    await page.goto(
      `/jupyter.html?state=${encodeURIComponent(JSON.stringify(eightQubitState))}`,
    );
    await page.waitForFunction(
      () => window.pixiApp?.element.dataset.state === "idle",
    );

    expect(requests).toHaveLength(1);
    expect(requestUrls).toEqual([eightQubitState.backendUrl]);
    expect(requests[0].get("qubitCount")).toBe("8");
    const requestedSteps = JSON.parse(requests[0].get("steps") ?? "[]");
    expect(requestedSteps).toHaveLength(5);
    expect(requestedSteps[0]).toEqual([]);
    expect(requestedSteps[1]).toEqual([{ type: "H", targets: [0] }]);
  });

  test("selects circuit steps with the slider, keyboard, and number input", async ({ page }) => {
    await page.route("**/backend.json", (route) =>
      route.fulfill({
        status: 200,
        json: viewerState.steps.map(() => zeroResult(0)),
      }),
    );
    await page.goto(
      `/jupyter.html?state=${encodeURIComponent(JSON.stringify(viewerState))}`,
    );
    await page.waitForFunction(
      () => window.pixiApp?.element.dataset.state === "idle",
    );

    const slider = page.getByRole("slider", { name: "Circuit step" });
    const number = page.getByRole("spinbutton", { name: "Step number" });
    const sliderContainer = page.locator("#step-slider-container");
    await expect(slider).toBeVisible();

    const circuitStepPoint = await page.evaluate(() => {
      const app = window.pixiApp!;
      const bounds = app.circuit.fetchStep(2).getBounds();
      const canvasBounds = app.app.canvas.getBoundingClientRect();
      return {
        x:
          canvasBounds.left +
          ((bounds.x + bounds.width / 2) / app.app.screen.width) *
            canvasBounds.width,
        y:
          canvasBounds.top +
          ((bounds.y + bounds.height / 2) / app.app.screen.height) *
            canvasBounds.height,
      };
    });
    await page.mouse.move(circuitStepPoint.x, circuitStepPoint.y);
    await expect
      .poll(() =>
        page.evaluate(() => window.pixiApp?.circuit.fetchStep(2).isHovered),
      )
      .toBe(true);
    await expect(page.locator("#step-slider-hover")).toHaveAttribute(
      "data-step",
      "2",
    );

    const sliderContainerBox = await sliderContainer.boundingBox();
    if (!sliderContainerBox) throw new Error("Slider container is not visible");
    await page.mouse.click(
      sliderContainerBox.x + 80,
      sliderContainerBox.y + 8,
    );
    await expect(slider).toBeFocused();
    await expect
      .poll(() =>
        page.locator("#step-slider-container").evaluate(
          (element) => getComputedStyle(element).borderColor,
        ),
      )
      .toBe("rgb(0, 0, 0)");
    await page.keyboard.press("ArrowRight");
    await expect(number).toHaveValue("1");
    await expect
      .poll(() => page.evaluate(() => window.pixiApp?.circuit.activeStepIndex))
      .toBe(1);

    await number.fill("0");
    await page.keyboard.press("Enter");
    await expect(slider).toHaveValue("0");

    const sliderBox = await slider.boundingBox();
    if (!sliderBox) throw new Error("Slider is not visible");
    await page.mouse.move(
      sliderBox.x + sliderBox.width * 0.7,
      sliderBox.y + sliderBox.height / 2,
    );
    const hoverMarker = page.locator("#step-slider-hover");
    await expect(hoverMarker).toBeVisible();
    await expect
      .poll(() =>
        hoverMarker.evaluate((element) => getComputedStyle(element).borderRadius),
      )
      .toBe("0px");
    const previewStep = Number(await hoverMarker.getAttribute("data-step"));
    expect(previewStep).not.toBe(0);
    await expect
      .poll(() =>
        page.evaluate(
          (index) => window.pixiApp?.circuit.fetchStep(index).isHovered,
          previewStep,
        ),
      )
      .toBe(true);
    await expect
      .poll(() => page.evaluate(() => window.pixiApp?.circuit.activeStepIndex))
      .toBe(0);

    await number.fill("3");
    await expect
      .poll(() =>
        page.locator("#step-slider-container").evaluate(
          (element) => getComputedStyle(element).borderColor,
        ),
      )
      .toBe("rgb(0, 0, 0)");
    await page.keyboard.press("Enter");
    await expect(slider).toHaveValue("3");
    await expect
      .poll(() => page.evaluate(() => window.pixiApp?.circuit.activeStepIndex))
      .toBe(3);
  });

  test("shows basis-state values for the hovered state-vector circle", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.route("**/backend.json", (route) =>
      route.fulfill({
        status: 200,
        json: [zeroResult(0), ...viewerState.steps.map(() => zeroResult(0))],
      }),
    );
    await page.goto(
      `/jupyter.html?state=${encodeURIComponent(JSON.stringify(viewerState))}`,
    );
    await page.waitForFunction(
      () => window.pixiApp?.element.dataset.state === "idle",
    );
    const point = await page.evaluate(() => {
      const app = window.pixiApp!;
      const bounds = app.stateVector.qubitCircleAt(0)!.getBounds();
      const canvas = app.app.canvas.getBoundingClientRect();
      return {
        x: canvas.left + bounds.x,
        y: canvas.top + bounds.y,
      };
    });
    await page.mouse.move(point.x + 8, point.y + 8);

    await expect(page.getByRole("tooltip")).toContainText("|0000⟩  decimal 0");
    await expect(page.getByRole("tooltip")).toContainText("Amplitude:+1.00000+0.00000i");
    await expect(page.getByRole("tooltip")).toContainText("Probability:+100.00000%");
    await expect(page.getByRole("tooltip")).toContainText("Phase:+0.00000°");
    await page.mouse.move(point.x + 12, point.y + 10);
    await expect(page.getByRole("tooltip")).toBeVisible();
    const anchoredPosition = await page.getByRole("tooltip").boundingBox();
    await page.mouse.move(point.x + 14, point.y + 12);
    expect(await page.getByRole("tooltip").boundingBox()).toEqual(anchoredPosition);
    const circlePoints = await page.evaluate(() => {
      const app = window.pixiApp!;
      const canvas = app.app.canvas.getBoundingClientRect();
      return Array.from({ length: 16 }, (_, index) => {
        const bounds = app.stateVector.qubitCircleAt(index)!.getBounds();
        return {
          index,
          x: canvas.left + bounds.x + bounds.width / 2,
          y: canvas.top + bounds.y + bounds.height / 2,
        };
      });
    });
    for (const circlePoint of circlePoints) {
      await page.mouse.move(circlePoint.x, circlePoint.y);
      await expect(page.getByRole("tooltip")).toContainText(
        `decimal ${circlePoint.index}`,
      );
      const popup = await page.getByRole("tooltip").boundingBox();
      expect(popup).not.toBeNull();
      expect(popup!.y + popup!.height).toBeLessThanOrEqual(circlePoint.y);
    }
    await page.mouse.move(point.x + 8, point.y + 8);
    await expect(page.getByRole("tooltip")).toHaveScreenshot(
      "qni-state-vector-cell-tooltip.png",
      { animations: "disabled" },
    );
    await page.mouse.down();
    await expect(page.getByRole("tooltip")).toBeHidden();
    await page.mouse.up();
    await expect(page.getByRole("tooltip")).toBeVisible();
  });

  test("disables state-vector hover while the inspection panel is open", async ({
    page,
  }) => {
    const state = {
      ...viewerState,
      checkpoints: [
        { name: "Initial", step: 0, expected_probabilities: { "0000": 1 } },
      ],
    };
    await page.route("**/backend.json", (route) =>
      route.fulfill({
        status: 200,
        json: [zeroResult(0), ...viewerState.steps.map(() => zeroResult(0))],
      }),
    );
    await page.goto(
      `/jupyter.html?state=${encodeURIComponent(JSON.stringify(state))}`,
    );
    await page.waitForFunction(
      () => window.pixiApp?.element.dataset.state === "idle",
    );
    const circlePoint = await page.evaluate(() => {
      const app = window.pixiApp!;
      const bounds = app.stateVector.qubitCircleAt(0)!.getBounds();
      const canvas = app.app.canvas.getBoundingClientRect();
      return {
        x: canvas.left + bounds.x + bounds.width / 2,
        y: canvas.top + bounds.y + bounds.height / 2,
      };
    });

    await expect(page.locator("#qni-inspection-panel")).toBeVisible();
    await page.mouse.move(circlePoint.x, circlePoint.y);
    await expect(page.getByRole("tooltip")).toBeHidden();

    await page.locator("#qni-inspection-panel").getByRole("button", {
      name: "Close state inspection",
    }).click();
    await page.mouse.move(circlePoint.x, circlePoint.y);
    await expect(page.getByRole("tooltip")).toBeVisible();

    await page.locator("#inspection-panel-toggle").click();
    await expect(page.getByRole("tooltip")).toBeHidden();
  });

  test("updates slider scale when the circuit step count changes", async ({ page }) => {
    await page.route("**/backend.json", (route) =>
      route.fulfill({ status: 200, json: viewerState.steps.map(() => zeroResult(0)) }),
    );
    await page.goto(
      `/jupyter.html?state=${encodeURIComponent(JSON.stringify(viewerState))}`,
    );
    await page.waitForFunction(() => window.pixiApp !== undefined);

    const slider = page.getByRole("slider", { name: "Circuit step" });
    const initialStepCount = await page.evaluate(
      () => window.pixiApp?.circuit.steps.length ?? 0,
    );
    await expect(slider).toHaveAttribute("max", String(initialStepCount - 1));
    await page.evaluate(() => {
      const circuit = window.pixiApp?.circuit;
      if (circuit) circuit.insertStepAt(circuit.steps.length);
    });
    await expect(slider).toHaveAttribute("max", String(initialStepCount));
    await expect(page.locator("#step-slider-ticks > span")).toHaveCount(
      initialStepCount + 1,
    );
  });

  test("moves and resizes the floating slider while preserving its padding", async ({ page }) => {
    await page.route("**/backend.json", (route) =>
      route.fulfill({ status: 200, json: viewerState.steps.map(() => zeroResult(0)) }),
    );
    await page.goto(
      `/jupyter.html?state=${encodeURIComponent(JSON.stringify(viewerState))}`,
    );
    await page.waitForFunction(() => window.pixiApp !== undefined);

    const box = page.locator("#step-slider-container");
    const track = page.locator("#step-slider-track");
    const handle = page.getByRole("separator", { name: "Resize step slider" });
    const before = await box.boundingBox();
    const beforeTrack = await track.boundingBox();
    if (!before || !beforeTrack) throw new Error("Slider box is not visible");
    expect(before.width).toBeCloseTo(400, 0);
    expect(before.height).toBeCloseTo(64, 0);
    const beforeTickPositions = await page
      .locator("#step-slider-ticks > span")
      .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().x));
    const sliderMetrics = await page.evaluate(() => {
      const slider = document.getElementById("step-slider");
      const track = document.getElementById("step-slider-track");
      const stepNumber = document.getElementById("step-number");
      const ticks = Array.from(document.querySelectorAll("#step-slider-ticks > span"));
      if (
        !(slider instanceof HTMLInputElement) ||
        !(track instanceof HTMLDivElement) ||
        !(stepNumber instanceof HTMLInputElement) ||
        ticks.length < 2
      )
        return null;
      const sliderRect = slider.getBoundingClientRect();
      const trackRect = track.getBoundingClientRect();
      const stepNumberRect = stepNumber.getBoundingClientRect();
      const firstTickRect = ticks[0].getBoundingClientRect();
      const lastTickRect = ticks[ticks.length - 1].getBoundingClientRect();
      const style = getComputedStyle(document.getElementById("step-slider-container")!);
      const thumbWidth = Number.parseFloat(
        style.getPropertyValue("--step-slider-thumb-width"),
      );
      return {
        thumbWidth,
        firstTickCenter: firstTickRect.x + firstTickRect.width / 2,
        lastTickCenter: lastTickRect.x + lastTickRect.width / 2,
        expectedFirstCenter: sliderRect.x + thumbWidth / 2,
        expectedLastCenter: sliderRect.right - thumbWidth / 2,
        widestTick: Math.max(...ticks.map((tick) => tick.getBoundingClientRect().width)),
        tickHeight: firstTickRect.height,
        tickColor: getComputedStyle(ticks[1]).backgroundColor,
        trackLeft: trackRect.left,
        trackRight: trackRect.right,
        numberToThumbGap: sliderRect.top - stepNumberRect.bottom,
      };
    });
    if (!sliderMetrics) throw new Error("Slider scale is not visible");
    expect(sliderMetrics.firstTickCenter).toBeCloseTo(
      sliderMetrics.expectedFirstCenter,
      1,
    );
    expect(sliderMetrics.lastTickCenter).toBeCloseTo(
      sliderMetrics.expectedLastCenter,
      1,
    );
    expect(sliderMetrics.thumbWidth).toBeGreaterThan(sliderMetrics.widestTick);
    expect(sliderMetrics.tickHeight).toBeCloseTo(17, 0);
    expect(sliderMetrics.tickColor).toBe("rgb(196, 196, 196)");
    expect(sliderMetrics.trackLeft).toBeCloseTo(sliderMetrics.firstTickCenter, 1);
    expect(sliderMetrics.trackRight).toBeCloseTo(sliderMetrics.lastTickCenter, 1);
    expect(sliderMetrics.numberToThumbGap).toBeCloseTo(6, 0);
    const beforeLeftPadding = beforeTrack.x - before.x;
    const beforeRightPadding =
      before.x + before.width - (beforeTrack.x + beforeTrack.width);

    const grabX = before.x + 80;
    const grabY = before.y + 5;
    await page.mouse.move(grabX, grabY);
    await page.mouse.down();
    await page.mouse.move(grabX + 10, grabY - 10);
    await expect
      .poll(async () => (await box.boundingBox())?.x)
      .toBeCloseTo(before.x + 10, 0);
    await page.mouse.move(120, 110, { steps: 5 });
    await page.mouse.up();
    const moved = await box.boundingBox();
    if (!moved) throw new Error("Slider box did not move");
    expect(moved.x).toBeLessThan(before.x);
    expect(moved.y).toBeLessThan(before.y);

    const resizeHandle = await handle.boundingBox();
    const resizeMark = await page.locator("#step-slider-resize-mark").boundingBox();
    if (!resizeHandle || !resizeMark) throw new Error("Resize handle is not visible");
    expect(resizeMark.y + resizeMark.height / 2).toBeCloseTo(
      resizeHandle.y + resizeHandle.height / 2,
      1,
    );
    const stacking = await page.evaluate(() => ({
      number: Number(getComputedStyle(document.getElementById("step-number")!).zIndex),
      resizeHandle: Number(
        getComputedStyle(document.getElementById("step-slider-resize-handle")!).zIndex,
      ),
    }));
    expect(stacking.number).toBeGreaterThan(stacking.resizeHandle);
    await page.mouse.move(
      resizeHandle.x + resizeHandle.width / 2,
      resizeHandle.y + resizeHandle.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(resizeHandle.x + 100, resizeHandle.y + 20, { steps: 5 });
    await page.mouse.up();

    const resized = await box.boundingBox();
    const resizedTrack = await track.boundingBox();
    if (!resized || !resizedTrack) throw new Error("Slider box did not resize");
    expect(resized.width).toBeGreaterThan(moved.width);
    expect(resized.height).toBeCloseTo(moved.height, 0);
    expect(resizedTrack.x - resized.x).toBeCloseTo(beforeLeftPadding, 1);
    expect(
      resized.x + resized.width - (resizedTrack.x + resizedTrack.width),
    ).toBeCloseTo(beforeRightPadding, 1);
    const resizedTickPositions = await page
      .locator("#step-slider-ticks > span")
      .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().x));
    const resizedGaps = resizedTickPositions.slice(1).map(
      (position, index) => position - resizedTickPositions[index],
    );
    expect(resizedGaps[0]).toBeGreaterThan(
      beforeTickPositions[1] - beforeTickPositions[0],
    );
    resizedGaps.forEach((gap) => expect(gap).toBeCloseTo(resizedGaps[0], 1));
  });

  test("uses responsive representative marks without changing step granularity", async ({
    page,
  }) => {
    const steps = Array.from({ length: 41 }, () => [
      { type: "X", targets: [0] },
    ]);
    const state = { ...viewerState, steps, qubit_count: 1 };
    await page.route("**/backend.json", (route) =>
      route.fulfill({ status: 200, json: [zeroResult(0), ...steps.map(() => zeroResult(0))] }),
    );
    await page.goto(
      `/jupyter.html?state=${encodeURIComponent(JSON.stringify(state))}`,
    );
    await page.waitForFunction(() => window.pixiApp !== undefined);

    await expect(page.getByRole("slider", { name: "Circuit step" })).toHaveAttribute(
      "max",
      "41",
    );
    await expect(page.locator("#step-slider-ticks > span")).toHaveCount(9);
    await expect(page.locator("#step-slider-labels > span")).toHaveText([
      "0",
      "5",
      "10",
      "15",
      "20",
      "25",
      "30",
      "35",
      "41",
    ]);
    await expect
      .poll(() =>
        page.locator("#step-slider-labels").evaluate(
          (element) => getComputedStyle(element).fontSize,
        ),
      )
      .toBe("11px");
    await expect(page.getByRole("slider", { name: "Circuit step" })).toHaveAttribute(
      "step",
      "1",
    );
    await page.evaluate(() => {
      const slider = document.getElementById("step-slider") as HTMLInputElement;
      for (let index = 0; index <= 41; index += 1) {
        slider.value = String(index);
        slider.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await expect(page.getByRole("spinbutton", { name: "Step number" })).toHaveValue(
      "41",
    );
    await expect
      .poll(() => page.evaluate(() => window.pixiApp?.circuit.activeStepIndex))
      .toBe(41);

    await page.locator("#step-slider-container").evaluate((element) => {
      (element as HTMLElement).style.width = "800px";
    });
    await expect(page.locator("#step-slider-ticks > span")).toHaveCount(42);
    await expect(page.locator("#step-slider-labels > span")).toHaveCount(0);
  });

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

  test("shows an 8-qubit circuit without starting a state-vector simulation", async ({
    page,
  }) => {
    const simulatedQubitCounts: string[] = [];
    await page.route("**/backend.json", (route) => {
      simulatedQubitCounts.push(
        new URLSearchParams(route.request().postData() ?? "").get("qubitCount") ??
          "",
      );
      return route.abort();
    });
    const circuitOnlyState = {
      steps: [[{ type: "H", targets: [7] }]],
      qubit_count: 8,
      view: "circuit",
      editable: false,
    };

    await page.goto(
      `/jupyter.html?state=${encodeURIComponent(JSON.stringify(circuitOnlyState))}`,
    );
    await page.waitForFunction(
      () => window.pixiApp?.element.dataset.state === "idle",
    );

    expect(
      await page.evaluate(
        () => window.pixiApp?.circuit.highestOccupiedQubitNumber,
      ),
    ).toBe(8);
    expect(simulatedQubitCounts).not.toContain("8");
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
            .fetchStep(2)
            .fetchDropzone(qubit).operation;
          return operation && "value" in operation
            ? operation.value
            : undefined;
        }),
      );
    expect(await measurementValues()).toEqual([1, 0, 1]);
    const requestsAfterInitialLoad = simulationSeeds.length;

    await page.evaluate(() => window.pixiApp?.circuit.fetchStep(2).activate());
    await page.waitForFunction(
      () => window.pixiApp?.element.dataset.state === "idle",
    );
    expect(await measurementValues()).toEqual([1, 0, 1]);

    await page.evaluate(() => window.pixiApp?.circuit.fetchStep(0).activate());
    await page.waitForFunction(
      () => window.pixiApp?.element.dataset.state === "idle",
    );
    expect(await measurementValues()).toEqual([1, 0, 1]);
    expect(simulationSeeds.length).toBe(requestsAfterInitialLoad);
    expect(simulationSeeds.length).toBeGreaterThanOrEqual(1);
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
      const results = [
        zeroResult(0),
        ...viewerState.steps.map((_, index) =>
          zeroResult(index === 2 ? 2 : 0),
        ),
      ];
      await route.fulfill({ status: 200, json: results });
    });

    await page.goto(
      `/jupyter.html?state=${encodeURIComponent(JSON.stringify(viewerState))}&height=360`,
    );
    await expect(page.locator("#demo-header")).toBeVisible();
    await expect(page.locator('#demo-header img[alt="QniNotebook"]')).toHaveAttribute(
      "src",
      "/title.svg",
    );
    await expect(page.locator("#demo-header")).toContainText(
      "Select a circuit boundary to inspect the state at that point",
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
      { animations: "disabled", maxDiffPixels: 96 },
    );
  });

  test("does not let an older step response overwrite the current state", async ({
    page,
  }) => {
    await page.route("**/backend.json", async (route) => {
      await route.fulfill({
        status: 200,
        json: viewerState.steps.map((_, index) =>
          zeroResult(index === 3 ? 2 : 0),
        ),
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
          json: viewerState.steps.map((_, index) =>
            index === 0
              ? zeroResult(0)
              : { measuredBits: {}, blochVectors: {} },
          ),
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
      { animations: "disabled", maxDiffPixels: 1600 },
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
        json: [zeroResult(0), ...viewerState.steps.map(() => complexState)],
      }),
    );
    await page.goto(
      `/jupyter.html?state=${encodeURIComponent(JSON.stringify({ ...viewerState, active_step_index: 1 }))}`,
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
        json: [zeroResult(0), zeroResult(0), {
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
      const operation = window.pixiApp?.circuit.fetchStep(2).fetchDropzone(0).operation;
      return operation && "x" in operation && "y" in operation && "z" in operation
        ? { x: operation.x, y: operation.y, z: operation.z }
        : null;
    });
    expect(vector).toEqual({ x: 1, y: 0, z: 0 });
  });
});
