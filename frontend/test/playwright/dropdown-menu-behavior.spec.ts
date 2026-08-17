import { expect, test } from "@playwright/test";

test("opens and closes the main menu", async ({ page }) => {
  await page.goto("/");

  const button = page.locator("#menu-button");
  const dropdown = page.locator("#menu-dropdown");
  await expect(dropdown).toBeHidden();

  await button.click();
  await expect(dropdown).toBeVisible();
  await expect(button).toHaveAttribute("aria-expanded", "true");

  await page.locator("body").click({ position: { x: 500, y: 400 } });
  await expect(dropdown).toBeHidden();
  await expect(button).toHaveAttribute("aria-expanded", "false");
});
