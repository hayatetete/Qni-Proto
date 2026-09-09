/* global console, document, fetch, process, setTimeout */

import { chromium } from "playwright";

const url = process.env.QNI_DEMO_URL ?? "http://127.0.0.1:8888/lab/tree/qni_demo.ipynb";
const deadline = Date.now() + 120_000;
while (true) {
  try {
    const response = await fetch(url);
    if (response.ok) break;
  } catch {
    // JupyterLab may still be starting; retry until the deadline below.
  }
  if (Date.now() >= deadline) throw new Error(`JupyterLab did not become ready: ${url}`);
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const browserDiagnostics = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserDiagnostics.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) =>
    browserDiagnostics.push(`request failed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`),
  );
  page.on("response", (response) => {
    if (response.url().includes("backend.json")) {
      browserDiagnostics.push(`backend response: ${response.status()} ${response.url()}`);
    }
  });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator(".jp-Notebook").waitFor({ timeout: 120_000 });
  if (process.env.QNI_SKIP_RUN_ALL !== "true") {
    const oldFrameUrl = await page.locator('iframe[src*="jupyter.html"]').first()
      .getAttribute("src").catch(() => null);
    const runMenu = page.locator(".lm-MenuBar-item").filter({ hasText: /^Run$/ });
    await runMenu.waitFor({ state: "visible", timeout: 120_000 });
    await runMenu.click();
    const runAll = page.locator(".lm-Menu-item").filter({
      has: page.locator(".lm-Menu-itemLabel", { hasText: /^Run All Cells$/ }),
    });
    await runAll.waitFor({ state: "visible", timeout: 30_000 });
    await runAll.click();
    if (oldFrameUrl) {
      await page.waitForFunction(
        (previous) => document.querySelector('iframe[src*="jupyter.html"]')?.getAttribute("src") !== previous,
        oldFrameUrl,
        { timeout: 120_000 },
      );
    }
  }
  const qniFrames = page.locator('iframe[src*="jupyter.html"]');
  const targetCell = page.locator(".jp-CodeCell")
    .filter({ hasText: "all_green_checkpoints = [" })
    .filter({ has: page.locator('.jp-OutputArea iframe[src*="jupyter.html"]') })
    .first();
  await targetCell.waitFor({ state: "visible", timeout: 120_000 });
  const iframe = targetCell.locator('iframe[src*="jupyter.html"]');
  const iframeHandle = await iframe.elementHandle();
  const qniFrame = await iframeHandle?.contentFrame();
  if (!qniFrame) throw new Error("QniNotebook feature-demo iframe is not available");
  await qniFrame.locator("#step-slider-container").waitFor({ timeout: 120_000 });
  await qniFrame.locator("#qni-inspection-panel").waitFor({ timeout: 120_000 });
  try {
    await qniFrame.getByText("All checkpoints passed", { exact: true })
      .waitFor({ timeout: 120_000 });
  } catch (error) {
    const sources = await qniFrames.evaluateAll((frames) =>
      frames.map((frame) => frame.getAttribute("src")),
    );
    const panelText = await qniFrame.locator("#qni-inspection-panel").innerText();
    throw new Error(
      `All-PASS checkpoint demo did not render. Panel: ${panelText}\nFrames: ${sources.join("\n")}\nDiagnostics: ${browserDiagnostics.join("\n")}`,
      { cause: error },
    );
  }
  await page.screenshot({ path: "frontend/test-results/docker-demo-notebook.png", fullPage: true });
  console.log("Docker demo notebook rendered the all-PASS checkpoint panel.");
} finally {
  await browser.close();
}
