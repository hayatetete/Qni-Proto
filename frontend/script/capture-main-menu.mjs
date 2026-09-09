/* global process */

import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const outputDir = resolve(process.argv[2] ?? "../doc/screenshot");
const framesDir = join(tmpdir(), "qni-main-menu-frames");
const baseUrl = process.env.QNI_FRONTEND_URL ?? "http://127.0.0.1:5173";
await mkdir(framesDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(baseUrl);

  const button = page.locator("#menu-button");
  const dropdown = page.locator("#menu-dropdown");
  await button.click();
  await dropdown.waitFor({ state: "visible" });
  await page.waitForTimeout(500);

  const buttonBox = await button.boundingBox();
  const dropdownBox = await dropdown.boundingBox();
  if (!buttonBox || !dropdownBox) {
    throw new Error("Main menu is not visible");
  }
  const padding = 8;
  const left = Math.max(0, Math.min(buttonBox.x, dropdownBox.x) - padding);
  const top = Math.max(0, Math.min(buttonBox.y, dropdownBox.y) - padding);
  const right = Math.max(
    buttonBox.x + buttonBox.width,
    dropdownBox.x + dropdownBox.width,
  );
  const bottom = Math.max(
    buttonBox.y + buttonBox.height,
    dropdownBox.y + dropdownBox.height,
  );
  const clip = {
    x: left,
    y: top,
    width: right - left + padding,
    height: bottom - top + padding,
  };

  await dropdown.screenshot({ path: join(outputDir, "qni-main-menu-open.png") });
  await page.locator("body").click({ position: { x: 500, y: 400 } });

  const captureFrame = (index) =>
    page.screenshot({
      path: join(framesDir, `menu-${String(index).padStart(2, "0")}.png`),
      clip,
    });
  await captureFrame(0);
  await captureFrame(1);
  await button.click();
  await dropdown.waitFor({ state: "visible" });
  await page.waitForTimeout(500);
  for (let index = 2; index < 8; index += 1) {
    await captureFrame(index);
  }
  await page.locator("body").click({ position: { x: 500, y: 400 } });
  await captureFrame(8);
  await captureFrame(9);
} finally {
  await browser.close();
}
