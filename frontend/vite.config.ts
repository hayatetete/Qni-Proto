import { VitePWA } from "vite-plugin-pwa";
import { UserConfig } from "vite";
import dotenv from "dotenv";

dotenv.config();

export default {
  build: {
    rollupOptions: {
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
