import { expect, test } from "./fixtures";
import { dragAndDrop } from "./test-helpers";

test.describe("DropdownMenu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should open dropdown menu", async ({ page }) => {
    await page.locator("#menu-button").click();

    await expect(page).toHaveScreenshot("dropdown-open.png");
  });

  test("should open share modal from dropdown", async ({ page }) => {
    await page.locator("#menu-button").click();
    await page.locator("#menu-item-share").click();

    await expect(page).toHaveScreenshot("dropdown-share-modal.png");
  });

  test("should update URL title when editing circuit title in share modal", async ({
    page,
  }) => {
    await page.locator("#menu-button").click();
    await page.locator("#menu-item-share").click();

    await page.locator("#circuit-title-input").fill("test");
    await page.locator("#circuit-title-input").blur();

    const hash = await page.evaluate(() => decodeURIComponent(location.hash));
    expect(hash).toContain("#circuit=");
    const jsonStr = hash.replace(/^#circuit=/, "");
    const circuit = JSON.parse(jsonStr);
    expect(circuit.title).toBe("test");

    await expect(page).toHaveScreenshot("dropdown-share-modal-title-test.png");
  });

  test("should show correct share URL after placing H gate", async ({
    page,
    circuitInfo,
  }) => {
    const hGate = circuitInfo.gatePalette.hGate;
    await dragAndDrop(page, hGate, { step: 0, bit: 0 });

    await page.locator("#menu-button").click();
    await page.locator("#menu-item-share").click();

    await page.waitForSelector("#circuit-url", { state: "visible" });

    const modalUrl = await page.locator("#circuit-url").innerText();
    const currentUrl = await page.evaluate(() => location.href);
    expect(modalUrl).toContain(currentUrl.split("#")[0]);

    await expect(page).toHaveScreenshot("dropdown-share-modal-hgate.png");
  });

  test("should open X share intent from share modal", async ({ page }) => {
    await page.locator("#menu-button").click();
    await page.locator("#menu-item-share").click();

    const shareUrl = await page.evaluate(() => {
      const hashtagsParam = "hashtags=qni";
      const urlParam = `url=${encodeURIComponent(window.location.href)}`;
      let title = "";
      try {
        if (location.hash.startsWith("#circuit=")) {
          const json = JSON.parse(
            decodeURIComponent(location.hash.substring(9))
          );
          if (json.title) title = json.title;
        }
      } catch (e) {}
      const params = title
        ? [`text=${encodeURIComponent(title)}`, hashtagsParam, urlParam]
        : [hashtagsParam, urlParam];
      return `https://x.com/intent/post?${params.join("&")}`;
    });

    expect(shareUrl).toContain("https://x.com/intent/post?hashtags=qni&url=");
  });

  test("should open tutorial link from dropdown", async ({ page }) => {
    await page.locator("#menu-button").click();

    const href = await page.locator("#menu-item-tutorial").getAttribute("href");
    expect(href).toBe("https://qniapp.github.io/qni/");
  });

  test("should open GitHub link from dropdown", async ({ page }) => {
    await page.locator("#menu-button").click();

    const href = await page.locator("#menu-item-github").getAttribute("href");

    expect(href).toBe("https://github.com/yasuhito/qni-gl");
  });

  test("should clear circuit after clicking clear circuit in dropdown", async ({
    page,
    circuitInfo,
  }) => {
    const hGate = circuitInfo.gatePalette.hGate;
    await dragAndDrop(page, hGate, { step: 0, bit: 0 });

    await page.locator("#menu-button").click();
    await page.locator("#menu-item-clear-circuit").click();

    await expect(page).toHaveScreenshot("dropdown-clear-circuit.png");
  });
});
