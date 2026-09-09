import { describe, it, expect, vi, beforeEach } from "vitest";
import { CircuitStepMarkerManager } from "../../src/circuit-step-marker-manager";
import { CircuitStep } from "../../src";

describe("CircuitStepMarkerManager", () => {
  let mockSteps: unknown[];

  beforeEach(() => {
    mockSteps = [
      {
        width: 100,
        height: 50,
        isActive: vi.fn(),
        isHovered: vi.fn(),
        activate: vi.fn(),
        setHovered: vi.fn(),
      },
      {
        width: 100,
        height: 50,
        isActive: vi.fn(),
        isHovered: vi.fn(),
        activate: vi.fn(),
        setHovered: vi.fn(),
      },
    ];
  });

  it("should position markers correctly", () => {
    const manager = new CircuitStepMarkerManager({
      steps: mockSteps as CircuitStep[],
    });
    const markers = manager["markers"];

    expect(markers[0].position.x).toBe(98); // 100 - markerWidth/2
    expect(markers[1].position.x).toBe(198); // 200 - markerWidth/2
  });

  it("activates the corresponding step when its marker is selected", () => {
    const manager = new CircuitStepMarkerManager({
      steps: mockSteps as CircuitStep[],
    });
    const stopPropagation = vi.fn();

    manager["markers"][0].emit("pointerdown", { stopPropagation });

    expect(
      (mockSteps[0] as { activate: ReturnType<typeof vi.fn> }).activate,
    ).toHaveBeenCalledOnce();
    expect(
      (mockSteps[1] as { activate: ReturnType<typeof vi.fn> }).activate,
    ).not.toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalledOnce();
  });

  it("keeps the step preview active over an interactive marker", () => {
    const manager = new CircuitStepMarkerManager({
      steps: mockSteps as CircuitStep[],
    });

    manager["markers"][1].emit("pointerover");
    manager["markers"][1].emit("pointerout");

    expect(
      (mockSteps[1] as { setHovered: ReturnType<typeof vi.fn> }).setHovered,
    ).toHaveBeenNthCalledWith(1, true);
    expect(
      (mockSteps[1] as { setHovered: ReturnType<typeof vi.fn> }).setHovered,
    ).toHaveBeenNthCalledWith(2, false);
  });
});
