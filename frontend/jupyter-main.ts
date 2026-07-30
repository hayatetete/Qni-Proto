import { App } from "./src/app";
import { loadJupyterInitialState } from "./src/jupyter-bridge";
import { setupJupyterSidePanel } from "./src/jupyter-side-panel";

if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}

/** The PixiJS app Application instance used by the Jupyter entry point. */
export const app = App.instance;

app.initialized.then(() => {
  setupJupyterSidePanel(app);
  loadJupyterInitialState(app);
});

// Expose the app to PixiJS Devtools and Playwright checks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__PIXI_APP__ = app;
