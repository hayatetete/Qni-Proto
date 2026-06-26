import { describe, it, expect, beforeEach, vi } from "vitest";
import { StateVectorFrame } from "../../src/state-vector-frame";
import { FederatedWheelEvent, Graphics } from "pixi.js";

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

  it("should handle scroll events", () => {
    const frame = StateVectorFrame.initialize(100, 100);
    const scrollEvent: FederatedWheelEvent = new WheelEvent("wheel", {
      deltaY: 10,
      deltaX: 5,
    }) as FederatedWheelEvent;
    const adjustScrollSpy = vi.spyOn(frame.stateVector, "setViewport");

    frame.emit("wheel", scrollEvent);

    expect(adjustScrollSpy).toHaveBeenCalled();
  });
});
