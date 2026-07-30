import type { App } from "./app";

type JupyterActionApp = Pick<
  App,
  "downloadJupyterPng" | "toggleJupyterSnapshotLock"
>;

export function setupJupyterActions(app: JupyterActionApp): void {
  document
    .getElementById("jupyter-item-download-png")
    ?.addEventListener("click", () => app.downloadJupyterPng());
  document
    .getElementById("jupyter-item-lock")
    ?.addEventListener("click", () => app.toggleJupyterSnapshotLock());
}

export function setJupyterLockControlState(locked: boolean): void {
  const button = document.getElementById("jupyter-item-lock");
  if (!button) {
    return;
  }

  const label = locked ? "ロックを解除" : "表示をロック";
  button.setAttribute("aria-pressed", String(locked));
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  const unlockedIcon = button.querySelector<HTMLImageElement>(
    '[data-lock-icon="unlocked"]',
  );
  const lockedIcon = button.querySelector<HTMLImageElement>(
    '[data-lock-icon="locked"]',
  );
  if (unlockedIcon) {
    unlockedIcon.hidden = locked;
  }
  if (lockedIcon) {
    lockedIcon.hidden = !locked;
  }
}
