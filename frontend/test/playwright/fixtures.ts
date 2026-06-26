import { test as base, Locator } from "@playwright/test";
import { getCircuitInfo } from "./test-helpers";

type QuantumCircuitFixtures = {
  circuitInfo: Awaited<ReturnType<typeof getCircuitInfo>>;
  idle: Locator;
};

export const test = base.extend<QuantumCircuitFixtures>({
  circuitInfo: async ({ page }, use) => {
    const info = await getCircuitInfo(page);
    await use(info);
  },
  idle: async ({ page }, use) => {
    const idle = page.locator('#app[data-state="idle"]');
    await use(idle);
  },
});

export { expect } from "@playwright/test";
