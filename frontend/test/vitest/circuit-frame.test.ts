import { describe, it, expect, beforeEach } from "vitest";
import { FederatedWheelEvent } from "pixi.js";
import { CircuitFrame } from "../../src/circuit-frame";

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

describe("CircuitFrame", () => {
  beforeEach(() => {
    CircuitFrame["instance"] = null;
  });

  it("should keep the palette natural width while resizing the frame", () => {
    const frame = CircuitFrame.initialize(400, 300);
    const naturalWidth = frame.operationPalette.width;

    frame.resize(240, 300);

    expect(frame.operationPalette.width).toBe(naturalWidth);
  });

  it("should expose the natural right edge of the palette", () => {
    const frame = CircuitFrame.initialize(400, 300);

    expect(frame.paletteNaturalRightEdge()).toBe(
      frame.operationPalette.x + frame.operationPalette.contentWidth
    );
  });

  it("should zoom the circuit with ctrl wheel", async () => {
    const frame = CircuitFrame.initialize(400, 300);
    const zoomEvent = new WheelEvent("wheel", {
      ctrlKey: true,
      deltaY: -120,
    }) as FederatedWheelEvent;

    frame.emit("wheel", zoomEvent);
    await nextAnimationFrame();

    expect(frame["circuitZoom"]).toBeGreaterThan(1);
  });

  it("should convert shift wheel into horizontal scrolling", async () => {
    const frame = CircuitFrame.initialize(120, 300);
    const scrollEvent = new WheelEvent("wheel", {
      shiftKey: true,
      deltaY: 80,
    }) as FederatedWheelEvent;

    frame.emit("wheel", scrollEvent);
    await nextAnimationFrame();

    expect(frame["scrollContainer"].x).toBeLessThan(0);
  });

  it("should keep the palette fixed while horizontally scrolling the circuit", async () => {
    const frame = CircuitFrame.initialize(120, 300);
    const paletteX = frame.operationPalette.x;
    const scrollEvent = new WheelEvent("wheel", {
      shiftKey: true,
      deltaY: 80,
    }) as FederatedWheelEvent;

    frame.emit("wheel", scrollEvent);
    await nextAnimationFrame();

    expect(frame.operationPalette.x).toBe(paletteX);
  });
});
