import {expect, test} from "./fixtures";
import {dragAndDrop} from "./test-helpers";
import fs from "fs";

test.describe("QASM Export", () => {
  test.beforeEach(async ({page}) => {
    await page.goto("/");
  });

  test("Button default state", async ({page}) => {
    const exportButton = page.locator('#exportButton');


    await expect(page).toHaveScreenshot("qasm-export-button-default.png");
  });

  test("Button hover", async ({page}) => {
    const exportButton = page.locator('button:has-text("Export to QASM")');
    await exportButton.hover();
    await expect(page).toHaveScreenshot("qasm-export-button-hover.png");
  });

  test("Button click", async ({page}) => {
    const exportButton = page.locator('#exportButton');
    const buttonBox = await exportButton.boundingBox();

    if (buttonBox) {
      await page.mouse.move(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2);
      await page.mouse.down();
      await expect(page).toHaveScreenshot("qasm-export-button-click.png");
      await page.mouse.up();
    }
  });


  test("1 qubit H gate", async ({page, circuitInfo}) => {
    const hGate = circuitInfo.gatePalette.hGate;

    await dragAndDrop(page, hGate, {step: 0, bit: 0});

    const exportButton = page.locator('button:has-text("Export to QASM")');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ]);

    const downloadPath = await download.path();
    const fileContent = fs.readFileSync(downloadPath, 'utf-8');

    expect(fileContent).toContain(`OPENQASM 3.0;
include "stdgates.inc";
qubit[1] q;
h q[0];
id q[0];
id q[0];
id q[0];
id q[0];`);

  });

  test("2 qubits H gate", async ({page, circuitInfo}) => {
    const hGate = circuitInfo.gatePalette.hGate;

    await dragAndDrop(page, hGate, {step: 0, bit: 1});

    const exportButton = page.locator('button:has-text("Export to QASM")');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ]);

    const downloadPath = await download.path();
    const fileContent = fs.readFileSync(downloadPath, 'utf-8');

    expect(fileContent).toContain(`OPENQASM 3.0;
include "stdgates.inc";
qubit[2] q;
h q[1];
id q[0];
id q[1];
id q[0];
id q[1];
id q[0];
id q[1];
id q[0];
id q[1];`);

  });

  test("3 qubits H gate", async ({page, circuitInfo}) => {
    const hGate = circuitInfo.gatePalette.hGate;

    await dragAndDrop(page, hGate, {step: 0, bit: 2});

    const exportButton = page.locator('button:has-text("Export to QASM")');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ]);

    const downloadPath = await download.path();
    const fileContent = fs.readFileSync(downloadPath, 'utf-8');

    expect(fileContent).toContain(`OPENQASM 3.0;
include "stdgates.inc";
qubit[3] q;
h q[2];
id q[0];
id q[1];
id q[2];
id q[0];
id q[1];
id q[2];
id q[0];
id q[1];
id q[2];
id q[0];
id q[1];
id q[2];`);

  });

  test("1 qubit X gate", async ({page, circuitInfo}) => {
    const xGate = circuitInfo.gatePalette.xGate;

    await dragAndDrop(page, xGate, {step: 0, bit: 0});

    const exportButton = page.locator('button:has-text("Export to QASM")');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ]);

    const downloadPath = await download.path();
    const fileContent = fs.readFileSync(downloadPath, 'utf-8');

    expect(fileContent).toContain(`OPENQASM 3.0;
include "stdgates.inc";
qubit[1] q;
x q[0];
id q[0];
id q[0];
id q[0];
id q[0];`);

  });

  test("1 qubit Y gate", async ({page, circuitInfo}) => {
    const yGate = circuitInfo.gatePalette.yGate;

    await dragAndDrop(page, yGate, {step: 0, bit: 0});

    const exportButton = page.locator('button:has-text("Export to QASM")');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ]);

    const downloadPath = await download.path();
    const fileContent = fs.readFileSync(downloadPath, 'utf-8');

    expect(fileContent).toContain(`OPENQASM 3.0;
include "stdgates.inc";
qubit[1] q;
y q[0];
id q[0];
id q[0];
id q[0];
id q[0];`);

  });

  test("1 qubit Z gate", async ({page, circuitInfo}) => {
    const zGate = circuitInfo.gatePalette.zGate;

    await dragAndDrop(page, zGate, {step: 0, bit: 0});

    const exportButton = page.locator('button:has-text("Export to QASM")');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ]);

    const downloadPath = await download.path();
    const fileContent = fs.readFileSync(downloadPath, 'utf-8');

    expect(fileContent).toContain(`OPENQASM 3.0;
include "stdgates.inc";
qubit[1] q;
z q[0];
id q[0];
id q[0];
id q[0];
id q[0];`);

  });

  test("1 qubit √X gate", async ({page, circuitInfo}) => {
    const rnotGate = circuitInfo.gatePalette.rnotGate;

    await dragAndDrop(page, rnotGate, {step: 0, bit: 0});

    const exportButton = page.locator('button:has-text("Export to QASM")');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ]);

    const downloadPath = await download.path();
    const fileContent = fs.readFileSync(downloadPath, 'utf-8');

    expect(fileContent).toContain(`OPENQASM 3.0;
include "stdgates.inc";
qubit[1] q;
sx q[0];
id q[0];
id q[0];
id q[0];
id q[0];`);

  });

  test("1 qubit S gate", async ({page, circuitInfo}) => {
    const sGate = circuitInfo.gatePalette.sGate;

    await dragAndDrop(page, sGate, {step: 0, bit: 0});

    const exportButton = page.locator('button:has-text("Export to QASM")');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ]);

    const downloadPath = await download.path();
    const fileContent = fs.readFileSync(downloadPath, 'utf-8');

    expect(fileContent).toContain(`OPENQASM 3.0;
include "stdgates.inc";
qubit[1] q;
s q[0];
id q[0];
id q[0];
id q[0];
id q[0];`);

  });

  test("1 qubit S† gate", async ({page, circuitInfo}) => {
    const sDaggerGate = circuitInfo.gatePalette.sDaggerGate;

    await dragAndDrop(page, sDaggerGate, {step: 0, bit: 0});

    const exportButton = page.locator('button:has-text("Export to QASM")');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ]);

    const downloadPath = await download.path();
    const fileContent = fs.readFileSync(downloadPath, 'utf-8');

    expect(fileContent).toContain(`OPENQASM 3.0;
include "stdgates.inc";
qubit[1] q;
sdg q[0];
id q[0];
id q[0];
id q[0];
id q[0];`);

  });

  test("1 qubit T gate", async ({page, circuitInfo}) => {
    const tGate = circuitInfo.gatePalette.tGate;

    await dragAndDrop(page, tGate, {step: 0, bit: 0});

    const exportButton = page.locator('button:has-text("Export to QASM")');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ]);

    const downloadPath = await download.path();
    const fileContent = fs.readFileSync(downloadPath, 'utf-8');

    expect(fileContent).toContain(`OPENQASM 3.0;
include "stdgates.inc";
qubit[1] q;
t q[0];
id q[0];
id q[0];
id q[0];
id q[0];`);

  });

  test("1 qubit T† gate", async ({page, circuitInfo}) => {
    const tDaggerGate = circuitInfo.gatePalette.tDaggerGate;

    await dragAndDrop(page, tDaggerGate, {step: 0, bit: 0});

    const exportButton = page.locator('button:has-text("Export to QASM")');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ]);

    const downloadPath = await download.path();
    const fileContent = fs.readFileSync(downloadPath, 'utf-8');

    expect(fileContent).toContain(`OPENQASM 3.0;
include "stdgates.inc";
qubit[1] q;
tdg q[0];
id q[0];
id q[0];
id q[0];
id q[0];`);

  });

  test("1 qubit Swap gate", async ({page, circuitInfo}) => {
    const swapGate = circuitInfo.gatePalette.swapGate;

    await dragAndDrop(page, swapGate, {step: 0, bit: 0});
    await dragAndDrop(page, swapGate, {step: 0, bit: 1});

    const exportButton = page.locator('button:has-text("Export to QASM")');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ]);

    const downloadPath = await download.path();
    const fileContent = fs.readFileSync(downloadPath, 'utf-8');

    expect(fileContent).toContain(`OPENQASM 3.0;
include "stdgates.inc";
qubit[2] q;
swap q[0], q[1];
id q[0];
id q[1];
id q[0];
id q[1];
id q[0];
id q[1];
id q[0];
id q[1];`);

  });

  test("1 qubit Control gate", async ({page, circuitInfo}) => {
    const controlGate = circuitInfo.gatePalette.controlGate;

    await dragAndDrop(page, controlGate, {step: 0, bit: 0});

    const exportButton = page.locator('button:has-text("Export to QASM")');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ]);

    const downloadPath = await download.path();
    const fileContent = fs.readFileSync(downloadPath, 'utf-8');

    expect(fileContent).toContain(`OPENQASM 3.0;
include "stdgates.inc";
qubit[1] q;
id q[0];
id q[0];
id q[0];
id q[0];
id q[0];`);

  });

  test("1 qubit |0> gate", async ({page, circuitInfo}) => {
    const write0Gate = circuitInfo.gatePalette.write0Gate;

    await dragAndDrop(page, write0Gate, {step: 0, bit: 0});

    const exportButton = page.locator('button:has-text("Export to QASM")');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ]);

    const downloadPath = await download.path();
    const fileContent = fs.readFileSync(downloadPath, 'utf-8');

    expect(fileContent).toContain(`OPENQASM 3.0;
include "stdgates.inc";
qubit[1] q;
reset q[0];
id q[0];
id q[0];
id q[0];
id q[0];`);

  });

  test("1 qubit |1> gate", async ({page, circuitInfo}) => {
    const write1Gate = circuitInfo.gatePalette.write1Gate;

    await dragAndDrop(page, write1Gate, {step: 0, bit: 0});

    const exportButton = page.locator('button:has-text("Export to QASM")');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ]);

    const downloadPath = await download.path();
    const fileContent = fs.readFileSync(downloadPath, 'utf-8');

    expect(fileContent).toContain(`OPENQASM 3.0;
include "stdgates.inc";
qubit[1] q;
reset q[0];
x q[0];
id q[0];
id q[0];
id q[0];
id q[0];`);

  });

  test("1 qubit Measurement gate", async ({page, circuitInfo}) => {
    const measurementGate = circuitInfo.gatePalette.measurementGate;

    await dragAndDrop(page, measurementGate, {step: 0, bit: 0});

    const exportButton = page.locator('button:has-text("Export to QASM")');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ]);

    const downloadPath = await download.path();
    const fileContent = fs.readFileSync(downloadPath, 'utf-8');

    const match = fileContent.match(/bit\[\d+\] (\w+);/);
    const classicalRegisterName = match ? match[1] : "c";

    expect(fileContent).toContain(`OPENQASM 3.0;
include "stdgates.inc";
bit[1] ${classicalRegisterName};
qubit[1] q;
${classicalRegisterName}[0] = measure q[0];
id q[0];
id q[0];
id q[0];
id q[0];`);

  });
});
