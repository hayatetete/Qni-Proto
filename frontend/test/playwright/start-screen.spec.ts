import { test, expect } from "@playwright/test";

test.describe("Start screen", () => {
  test("Gate palette and an empty quantum circuit are displayed", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveScreenshot("start-screen.png");
  });
});
