/* global document, HTMLCanvasElement, process, URL, window */

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";

const outputPath = resolve(
  process.argv[2] ?? "../doc/screenshot/qni-tutorial-executed-output.png",
);
const jupyterUrl =
  process.env.QNI_JUPYTER_URL ??
  "http://127.0.0.1:18888/lab/tree/qni_demo.ipynb";
const targetSource =
  process.env.QNI_TARGET_SOURCE ??
  "qni.show_circuit_and_state(state_preparation_circuit)";
const notebookName = decodeURIComponent(
  new URL(jupyterUrl).pathname.split("/").at(-1) ?? "",
);
await mkdir(dirname(outputPath), { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(jupyterUrl);
  const notebookTab = page
    .locator(".lm-TabBar-tab")
    .filter({ hasText: notebookName })
    .last();
  await notebookTab.waitFor({ state: "visible", timeout: 30_000 });
  await notebookTab.click();
  await page.locator(".jp-Notebook:visible").waitFor({
    timeout: 30_000,
  });

  await page.getByText("Run", { exact: true }).first().click();
  await page.getByText("Run All Cells", { exact: true }).click();
  const outputCell = page
    .locator(".jp-CodeCell")
    .filter({ hasText: targetSource })
    .filter({ has: page.locator(".jp-OutputArea iframe") })
    .first();
  await outputCell.waitFor({ state: "visible", timeout: 120_000 });
  await outputCell.scrollIntoViewIfNeeded();
  const iframe = outputCell.locator("iframe");
  const iframeHandle = await iframe.elementHandle();
  const viewerFrame = await iframeHandle?.contentFrame();
  if (!viewerFrame) throw new Error("QniNotebook iframe is not available");
  await viewerFrame.waitForFunction(
    () => window.pixiApp?.element.dataset.state === "idle",
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(1_000);
  await viewerFrame.evaluate(async () => {
    const canvas = document.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const image = document.createElement("img");
    image.src = canvas.toDataURL("image/png");
    image.alt = "QniNotebook circuit and state vector";
    image.style.cssText = canvas.style.cssText;
    image.width = canvas.width;
    image.height = canvas.height;
    await image.decode();
    canvas.replaceWith(image);
  });
  await page.waitForTimeout(100);

  await outputCell.screenshot({ path: outputPath });

  const viewerUrl = await iframe.getAttribute("src");
  if (!viewerUrl) throw new Error("QniNotebook viewer URL was not generated");
  process.stdout.write(`${JSON.stringify({ outputPath, viewerUrl })}\n`);
} finally {
  await browser.close();
}
