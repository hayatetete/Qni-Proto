import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  setJupyterLockControlState,
  setupJupyterActions,
} from "../../src/jupyter-actions";

describe("Jupyter actions", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="jupyter-item-download-png" type="button"></button>
      <button id="jupyter-item-lock" type="button" aria-pressed="false">
        <img data-lock-icon="unlocked" />
        <img data-lock-icon="locked" hidden />
      </button>
    `;
  });

  test("PNG保存はロック操作から独立して呼び出せる", () => {
    const app = {
      downloadJupyterPng: vi.fn(),
      toggleJupyterSnapshotLock: vi.fn(),
    };
    setupJupyterActions(app);

    document.getElementById("jupyter-item-lock")?.click();
    document.getElementById("jupyter-item-download-png")?.click();

    expect(app.downloadJupyterPng).toHaveBeenCalledOnce();
  });

  test("ロック時は閉じた南京錠を表示する", () => {
    setJupyterLockControlState(true);

    expect({
      pressed: document
        .getElementById("jupyter-item-lock")
        ?.getAttribute("aria-pressed"),
      unlockedHidden: document.querySelector<HTMLImageElement>(
        '[data-lock-icon="unlocked"]',
      )?.hidden,
      lockedHidden: document.querySelector<HTMLImageElement>(
        '[data-lock-icon="locked"]',
      )?.hidden,
    }).toEqual({
      pressed: "true",
      unlockedHidden: true,
      lockedHidden: false,
    });
  });

  test("解除時は開いた南京錠を表示する", () => {
    setJupyterLockControlState(false);

    expect({
      label: document
        .getElementById("jupyter-item-lock")
        ?.getAttribute("aria-label"),
      unlockedHidden: document.querySelector<HTMLImageElement>(
        '[data-lock-icon="unlocked"]',
      )?.hidden,
      lockedHidden: document.querySelector<HTMLImageElement>(
        '[data-lock-icon="locked"]',
      )?.hidden,
    }).toEqual({
      label: "表示をロック",
      unlockedHidden: false,
      lockedHidden: true,
    });
  });
});
