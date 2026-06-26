import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FrameDivider } from "../../src/frame-divider";
import { Application, FederatedPointerEvent } from "pixi.js";

describe("FrameDivider", () => {
  let app: Application;
  let frameDivider: FrameDivider;

  beforeEach(() => {
    // テスト用のPIXI.Applicationのモックを作成
    app = {
      screen: { width: 800, height: 600 },
      stage: {
        on: vi.fn(),
        cursor: "default",
      },
    } as unknown as Application;

    frameDivider = FrameDivider.initialize({ width: 800, initialY: 300 });
  });

  afterEach(() => {
    vi.clearAllMocks();
    FrameDivider["instance"] = null;
  });

  it("should initialize singleton instance", () => {
    expect(FrameDivider.getInstance()).toBe(frameDivider);
  });

  it("should throw error when getInstance is called before initialization", () => {
    FrameDivider["instance"] = null;
    expect(() => FrameDivider.getInstance()).toThrow(
      "FrameDivider is not initialized"
    );
  });

  it("should set initial position", () => {
    expect(frameDivider.y).toBe(300);
  });

  it("should update width correctly", () => {
    const clearSpy = vi.spyOn(frameDivider, "clear");
    const rectSpy = vi.spyOn(frameDivider, "rect");
    const fillSpy = vi.spyOn(frameDivider, "fill");

    frameDivider.updateWidth(800);

    expect(clearSpy).toHaveBeenCalled();
    expect(rectSpy).toHaveBeenCalledWith(0, 0, 800, 2);
    expect(fillSpy).toHaveBeenCalled();
  });

  it("should start dragging on pointerdown", () => {
    const event = { global: { y: 350 } } as FederatedPointerEvent;

    frameDivider["startDragging"](event);

    expect(frameDivider["isDragging"]).toBe(true);
    expect(frameDivider["dragStartY"]).toBe(50);
  });

  it("should end dragging on pointerup", () => {
    frameDivider["_isDragging"] = true;
    frameDivider["endDragging"]();

    expect(frameDivider["isDragging"]).toBe(false);
    expect(app.stage.cursor).toBe("default");
  });

  it("should move divider on pointermove when dragging", () => {
    frameDivider["_isDragging"] = true;
    frameDivider["dragStartY"] = 50;

    frameDivider.move(400, 600);

    expect(frameDivider.y).toBe(350);
  });

  it("should not move divider on pointermove when not dragging", () => {
    frameDivider["_isDragging"] = false;

    const initialY = frameDivider.y;
    frameDivider.move(400, 600);

    expect(frameDivider.y).toBe(initialY);
  });

  it("should clamp position within bounds", () => {
    expect(frameDivider["clampPosition"](-50, 600)).toBe(0);
    expect(frameDivider["clampPosition"](700, 600)).toBe(598);
    expect(frameDivider["clampPosition"](300, 600)).toBe(300);
  });
});
