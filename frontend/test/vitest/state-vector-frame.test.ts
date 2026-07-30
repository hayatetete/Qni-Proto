import { describe, it, expect, beforeEach, vi } from "vitest";
import { StateVectorFrame } from "../../src/state-vector-frame";
import { FederatedWheelEvent, Graphics } from "pixi.js";

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function waitForZoomCommit(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 120));
}

describe("StateVectorFrame", () => {
  beforeEach(() => {
    StateVectorFrame["instance"] = null;
  });

  it("should create a singleton instance", () => {
    const instance1 = StateVectorFrame.initialize(100, 100);
    const instance2 = StateVectorFrame.initialize(100, 100);

    expect(instance1).toBe(instance2);
  });

  it("should reposition and resize correctly", () => {
    const frame = StateVectorFrame.initialize(100, 100);

    frame.repositionAndResize(50, 200, 150);

    expect(frame.y).toBe(50);
    // expect(frame.width).toBe(200);
    expect(frame["frameWidth"]).toBe(200);
    // expect(frame.height).toBe(150);
    expect(frame["frameHeight"]).toBe(150);

    // 背景のサイズをチェック
    const background = frame.getChildAt(0) as Graphics;
    expect(background.width).toBe(200);
    expect(background.height).toBe(150);
  });

  it("should handle scroll events", async () => {
    const frame = StateVectorFrame.initialize(100, 100);
    const scrollEvent: FederatedWheelEvent = new WheelEvent("wheel", {
      deltaY: 10,
      deltaX: 5,
    }) as FederatedWheelEvent;
    const adjustScrollSpy = vi.spyOn(frame.stateVector, "setViewport");

    frame.emit("wheel", scrollEvent);
    await nextAnimationFrame();
    await waitForZoomCommit();

    expect(adjustScrollSpy).toHaveBeenCalled();
  });

  it("should zoom pinned content with a plain vertical wheel", async () => {
    const frame = StateVectorFrame.initialize(100, 100);
    frame.pinContentToTopLeft();
    const zoomEvent: FederatedWheelEvent = new WheelEvent("wheel", {
      deltaY: -120,
    }) as FederatedWheelEvent;

    frame.emit("wheel", zoomEvent);
    await nextAnimationFrame();

    expect(frame["contentZoom"]).toBeGreaterThan(1);
  });

  it("should keep pinned zoom anchored to the top-left corner", async () => {
    const frame = StateVectorFrame.initialize(100, 100);
    frame.pinContentToTopLeft();
    const zoomEvent: FederatedWheelEvent = new WheelEvent("wheel", {
      deltaY: 120,
    }) as FederatedWheelEvent;

    frame.emit("wheel", zoomEvent);
    await nextAnimationFrame();

    expect({
      x: frame["scrollContainer"].x,
      y: frame["scrollContainer"].y,
    }).toEqual({ x: 0, y: 0 });
  });
});
