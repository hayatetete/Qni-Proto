import { expect, test } from "./fixtures";
import { dragAndDrop } from "./test-helpers";

test.describe("H gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("URL encode/decode: H gate", async ({ page, circuitInfo }) => {
    const gate = circuitInfo.gatePalette.hGate;

    await dragAndDrop(page, gate, { step: 0, bit: 0 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain("#circuit={%22cols%22:[[%22H%22,1]]}");
  });

  test("URL encode/decode: X gate", async ({ page, circuitInfo }) => {
    const gate = circuitInfo.gatePalette.xGate;

    await dragAndDrop(page, gate, { step: 0, bit: 0 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain("#circuit={%22cols%22:[[%22X%22,1]]}");
  });

  test("URL encode/decode: Y gate", async ({ page, circuitInfo }) => {
    const gate = circuitInfo.gatePalette.yGate;

    await dragAndDrop(page, gate, { step: 0, bit: 0 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain("#circuit={%22cols%22:[[%22Y%22,1]]}");
  });

  test("URL encode/decode: Z gate", async ({ page, circuitInfo }) => {
    const gate = circuitInfo.gatePalette.zGate;

    await dragAndDrop(page, gate, { step: 0, bit: 0 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain("#circuit={%22cols%22:[[%22Z%22,1]]}");
  });

  test("URL encode/decode: √X gate", async ({ page, circuitInfo }) => {
    const gate = circuitInfo.gatePalette.rnotGate;

    await dragAndDrop(page, gate, { step: 0, bit: 0 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain("#circuit={%22cols%22:[[%22X^½%22,1]]}");
  });

  test("URL encode/decode: S gate", async ({ page, circuitInfo }) => {
    const gate = circuitInfo.gatePalette.sGate;

    await dragAndDrop(page, gate, { step: 0, bit: 0 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain("#circuit={%22cols%22:[[%22S%22,1]]}");
  });

  test("URL encode/decode: S† gate", async ({ page, circuitInfo }) => {
    const gate = circuitInfo.gatePalette.sDaggerGate;

    await dragAndDrop(page, gate, { step: 0, bit: 0 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain("#circuit={%22cols%22:[[%22S†%22,1]]}");
  });

  test("URL encode/decode: T gate", async ({ page, circuitInfo }) => {
    const gate = circuitInfo.gatePalette.tGate;

    await dragAndDrop(page, gate, { step: 0, bit: 0 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain("#circuit={%22cols%22:[[%22T%22,1]]}");
  });

  test("URL encode/decode: T† gate", async ({ page, circuitInfo }) => {
    const gate = circuitInfo.gatePalette.tDaggerGate;

    await dragAndDrop(page, gate, { step: 0, bit: 0 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain("#circuit={%22cols%22:[[%22T†%22,1]]}");
  });

  test("URL encode/decode: Swap gate", async ({ page, circuitInfo }) => {
    const swapGate = circuitInfo.gatePalette.swapGate;

    await dragAndDrop(page, swapGate, { step: 0, bit: 0 });
    await dragAndDrop(page, swapGate, { step: 0, bit: 1 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain("#circuit={%22cols%22:[[%22Swap%22,%22Swap%22");
  });

  test("URL encode/decode: Control gate (single)", async ({
    page,
    circuitInfo,
  }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;

    await dragAndDrop(page, controlGate, { step: 0, bit: 0 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain("#circuit={%22cols%22:[[%22•%22,1,1]]}");
  });

  test("URL encode/decode: |0> gate", async ({ page, circuitInfo }) => {
    const gate = circuitInfo.gatePalette.write0Gate;

    await dragAndDrop(page, gate, { step: 0, bit: 0 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain("#circuit={%22cols%22:[[%22|0>%22,1]]}");
  });

  test("URL encode/decode: |1> gate", async ({ page, circuitInfo }) => {
    const gate = circuitInfo.gatePalette.write1Gate;

    await dragAndDrop(page, gate, { step: 0, bit: 0 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain("#circuit={%22cols%22:[[%22|1>%22,1]]}");
  });

  test("URL encode/decode: Measurement gate", async ({ page, circuitInfo }) => {
    const gate = circuitInfo.gatePalette.measurementGate;

    await dragAndDrop(page, gate, { step: 0, bit: 0 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain("#circuit={%22cols%22:[[%22Measure%22,1]]}");
  });

  test("URL encode/decode: controlled-H gate", async ({
    page,
    circuitInfo,
  }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const hGate = circuitInfo.gatePalette.hGate;

    await dragAndDrop(page, controlGate, { step: 0, bit: 0 });
    await dragAndDrop(page, hGate, { step: 0, bit: 1 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain("#circuit={%22cols%22:[[%22•%22,%22H%22");
  });

  test("URL encode/decode: controlled-X gate", async ({
    page,
    circuitInfo,
  }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const xGate = circuitInfo.gatePalette.xGate;

    await dragAndDrop(page, controlGate, { step: 0, bit: 0 });
    await dragAndDrop(page, xGate, { step: 0, bit: 1 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain("#circuit={%22cols%22:[[%22•%22,%22X%22");
  });

  test("URL encode/decode: controlled-Y gate", async ({
    page,
    circuitInfo,
  }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const yGate = circuitInfo.gatePalette.yGate;

    await dragAndDrop(page, controlGate, { step: 0, bit: 0 });
    await dragAndDrop(page, yGate, { step: 0, bit: 1 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain("#circuit={%22cols%22:[[%22•%22,%22Y%22");
  });

  test("URL encode/decode: controlled-Z gate", async ({
    page,
    circuitInfo,
  }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const zGate = circuitInfo.gatePalette.zGate;

    await dragAndDrop(page, controlGate, { step: 0, bit: 0 });
    await dragAndDrop(page, zGate, { step: 0, bit: 1 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain("#circuit={%22cols%22:[[%22•%22,%22Z%22");
  });

  test("URL encode/decode: controlled-X gate with 2 controls", async ({
    page,
    circuitInfo,
  }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const xGate = circuitInfo.gatePalette.xGate;

    await dragAndDrop(page, controlGate, { step: 0, bit: 0 });
    await dragAndDrop(page, controlGate, { step: 0, bit: 1 });
    await dragAndDrop(page, xGate, { step: 0, bit: 2 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain(
      "#circuit={%22cols%22:[[%22•%22,%22•%22,%22X%22]]}"
    );
  });

  test("URL encode/decode: controlled-Y gate with 2 controls", async ({
    page,
    circuitInfo,
  }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const yGate = circuitInfo.gatePalette.yGate;

    await dragAndDrop(page, controlGate, { step: 0, bit: 0 });
    await dragAndDrop(page, controlGate, { step: 0, bit: 1 });
    await dragAndDrop(page, yGate, { step: 0, bit: 2 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain(
      "#circuit={%22cols%22:[[%22•%22,%22•%22,%22Y%22]]}"
    );
  });

  test("URL encode/decode: controlled-Z gate with 2 controls", async ({
    page,
    circuitInfo,
  }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const zGate = circuitInfo.gatePalette.zGate;

    await dragAndDrop(page, controlGate, { step: 0, bit: 0 });
    await dragAndDrop(page, controlGate, { step: 0, bit: 1 });
    await dragAndDrop(page, zGate, { step: 0, bit: 2 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain(
      "#circuit={%22cols%22:[[%22•%22,%22•%22,%22Z%22]]}"
    );
  });

  test("URL encode/decode: controlled-S gate with 2 controls", async ({
    page,
    circuitInfo,
  }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const sGate = circuitInfo.gatePalette.sGate;

    await dragAndDrop(page, controlGate, { step: 0, bit: 0 });
    await dragAndDrop(page, controlGate, { step: 0, bit: 1 });
    await dragAndDrop(page, sGate, { step: 0, bit: 2 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain(
      "#circuit={%22cols%22:[[%22•%22,%22•%22,%22S%22]]}"
    );
  });

  test("URL encode/decode: controlled-S† gate with 2 controls", async ({
    page,
    circuitInfo,
  }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const sDaggerGate = circuitInfo.gatePalette.sDaggerGate;

    await dragAndDrop(page, controlGate, { step: 0, bit: 0 });
    await dragAndDrop(page, controlGate, { step: 0, bit: 1 });
    await dragAndDrop(page, sDaggerGate, { step: 0, bit: 2 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain(
      "#circuit={%22cols%22:[[%22•%22,%22•%22,%22S†%22]]}"
    );
  });

  test("URL encode/decode: controlled-T gate with 2 controls", async ({
    page,
    circuitInfo,
  }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const tGate = circuitInfo.gatePalette.tGate;

    await dragAndDrop(page, controlGate, { step: 0, bit: 0 });
    await dragAndDrop(page, controlGate, { step: 0, bit: 1 });
    await dragAndDrop(page, tGate, { step: 0, bit: 2 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain(
      "#circuit={%22cols%22:[[%22•%22,%22•%22,%22T%22]]}"
    );
  });

  test("URL encode/decode: controlled-T† gate with 2 controls", async ({
    page,
    circuitInfo,
  }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const tDaggerGate = circuitInfo.gatePalette.tDaggerGate;

    await dragAndDrop(page, controlGate, { step: 0, bit: 0 });
    await dragAndDrop(page, controlGate, { step: 0, bit: 1 });
    await dragAndDrop(page, tDaggerGate, { step: 0, bit: 2 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain(
      "#circuit={%22cols%22:[[%22•%22,%22•%22,%22T†%22]]}"
    );
  });

  test("URL encode/decode: controlled-√X gate with 2 controls", async ({
    page,
    circuitInfo,
  }) => {
    const controlGate = circuitInfo.gatePalette.controlGate;
    const rnotGate = circuitInfo.gatePalette.rnotGate;

    await dragAndDrop(page, controlGate, { step: 0, bit: 0 });
    await dragAndDrop(page, controlGate, { step: 0, bit: 1 });
    await dragAndDrop(page, rnotGate, { step: 0, bit: 2 });

    const urlHash = await page.evaluate(() => location.hash);
    expect(urlHash).toContain(
      "#circuit={%22cols%22:[[%22•%22,%22•%22,%22X^½%22]]}"
    );
  });
});
