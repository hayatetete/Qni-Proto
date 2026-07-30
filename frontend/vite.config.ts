import { VitePWA } from "vite-plugin-pwa";
import { UserConfig } from "vite";
import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const configDir = dirname(fileURLToPath(import.meta.url));

export default {
  build: {
    rollupOptions: {
      input: {
        index: resolve(configDir, "index.html"),
        jupyter: resolve(configDir, "jupyter.html"),
      },
      output: {
        manualChunks: {
          pixi: ["pixi.js"],
        },
      },
    },
  },
  plugins: [
    VitePWA({
      srcDir: "src",
      filename: "service-worker.js",
      strategies: "injectManifest",
      registerType: "autoUpdate",
      injectRegister: false,
      manifest: false,
      injectManifest: {
        injectionPoint: undefined,
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
  optimizeDeps: {
    exclude: ["fsevents"],
  },
} satisfies UserConfig;
