import { expect, test } from "./fixtures";

test.describe("Quantum Algorithms Dropdown", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should open quantum algorithms dropdown", async ({ page }) => {
    await page.locator("#menu-button").click();
    await page.locator("#quantum-algorithms").click();

    await expect(page).toHaveScreenshot("quantum-algorithms-dropdown-open.png");
  });

  test("should select Bell state and update circuit", async ({ page }) => {
    await page.locator("#menu-button").click();
    await page.locator("#quantum-algorithms").click();
    await page.locator('button[data-algo="chsh"]').click();

    const urlHash = await page.evaluate(() =>
      decodeURIComponent(location.hash)
    );
    expect(urlHash).toContain('"title":"Bell state generation"');
    expect(urlHash).toContain(
      '"cols":[["|0>","|0>"],["H",1],["•","X"],["Measure","Measure"]]'
    );

    await expect(page).toHaveScreenshot("quantum-algorithms-chsh-selected.png");
  });

  test("should select GHZ state  and update circuit", async ({ page }) => {
    await page.locator("#menu-button").click();
    await page.locator("#quantum-algorithms").click();
    await page.locator('button[data-algo="ghz"]').click();

    const urlHash = await page.evaluate(() =>
      decodeURIComponent(location.hash)
    );
    expect(urlHash).toContain('"title":"GHZ state generation (9 qubits)"');
    expect(urlHash).toContain('"cols":[["|0>",');

    await expect(page).toHaveScreenshot("quantum-algorithms-ghz-selected.png");
  });

  test("should select Grover algorithm and update circuit", async ({
    page,
  }) => {
    await page.locator("#menu-button").click();
    await page.locator("#quantum-algorithms").click();
    await page.locator('button[data-algo="grover"]').click();

    const urlHash = await page.evaluate(() =>
      decodeURIComponent(location.hash)
    );
    expect(urlHash).toContain("Grover's algorithm");
    expect(urlHash).toContain(
      '"cols":[["|0>","|0>","|0>","|1>"],["H","H","H",1]'
    );

    await expect(page).toHaveScreenshot(
      "quantum-algorithms-grover-selected.png"
    );
  });
});
