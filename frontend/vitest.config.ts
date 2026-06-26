import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  test: {
    coverage: {
      provider: "istanbul",
      reporter: ["json", "html"],
      include: ["src/**"],
    },
    browser: {
      provider: "playwright", // or 'webdriverio'
      enabled: true,
      name: "chromium", // browser name is required
      headless: true,
    },
  },
  optimizeDeps: {
    include: ["@vitest/coverage-istanbul"],
  },
});
