import { App } from "./src/app";

/** The PixiJS app Application instance, shared across the project */
export const app = App.instance;

// Expose that app to the PixiJS Devtools (https://chrome.google.com/webstore/detail/pixijs-devtools/aamddddknhcagpehecnhphigffljadon)
// so we can debug the pixi app layers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__PIXI_APP__ = app;
