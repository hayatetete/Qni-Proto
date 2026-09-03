import { Rectangle } from "pixi.js";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { QubitCircle } from "../../src/qubit-circle";
import { StateVectorComponent } from "../../src";
import { STATE_VECTOR_EVENTS } from "../../src/state-vector-events";
import { stateVectorFittingAspectIndex } from "../../src/state-vector-layout";

describe("StateVectorComponent", () => {
  let stateVector: StateVectorComponent;
  const mockScrollRect = new Rectangle(0, 0, 1000, 1000);

  beforeEach(() => {
    stateVector = new StateVectorComponent({
      initialQubitCount: 1,
      viewport: mockScrollRect,
    });
  });

  it("should initialize with correct default values", () => {
    expect(stateVector.qubitCount).toBe(1);
    expect(stateVector.qubitCircleCount).toBe(2);
    expect(stateVector.visibleQubitCircleIndices).toEqual([0, 1]);
  });

  it("should update qubit count correctly", () => {
    stateVector.qubitCount = 3;
    expect(stateVector.qubitCount).toBe(3);
    expect(stateVector.qubitCircleCount).toBe(8);
  });

  it("should emit CHANGE event when qubit count changes", () => {
    const mockEmit = vi.spyOn(stateVector, "emit");
    stateVector.qubitCount = 2;
    expect(mockEmit).toHaveBeenCalledWith(
      STATE_VECTOR_EVENTS.QUBIT_COUNT_CHANGED,
      2
    );
  });

  it("should adjust scroll correctly", () => {
    const newScrollRect = new Rectangle(500, 500, 1500, 1500);
    const mockEmit = vi.spyOn(stateVector, "emit");
    stateVector.setViewport(newScrollRect);
    expect(mockEmit).toHaveBeenCalledWith(
      STATE_VECTOR_EVENTS.VISIBLE_QUBIT_CIRCLES_CHANGED,
      expect.any(Array)
    );
  });

  it("should get QubitCircle at correct index", () => {
    const result = stateVector.qubitCircleAt(0);
    expect(result).not.toBeUndefined();
    expect(result).toBeInstanceOf(QubitCircle);
  });

  it("should update visible amplitudes when scrolling", () => {
    stateVector.qubitCount = 4; // 16個のQubitCircleを作成
    const newScrollRect = new Rectangle(100, 100, 100, 100);
    stateVector.setViewport(newScrollRect);
    expect(stateVector.visibleQubitCircleIndices.length).toBeLessThan(16);
  });

  it("should arrange all basis states in one row when the widest aspect is selected", () => {
    stateVector.qubitCount = 4;
    stateVector.setAspectIndex(4);
    expect(stateVector.qubitCircleAt(15)?.position.y).toBe(
      stateVector.qubitCircleAt(0)?.position.y
    );
  });

  it("should choose a 4 by 4 grid for sixteen states in a narrow notebook panel", () => {
    expect(stateVectorFittingAspectIndex(4, 244, 331)).toBe(2);
  });

  it("should choose a wider grid when the notebook panel has enough width", () => {
    expect(stateVectorFittingAspectIndex(4, 884, 331)).toBe(3);
  });

  it("should redraw newly exposed circles when viewport size grows", () => {
    const narrowStateVector = new StateVectorComponent({
      initialQubitCount: 6,
      viewport: new Rectangle(0, 0, 64, 64),
    });
    const before = narrowStateVector.visibleQubitCircleIndices.length;

    narrowStateVector.setViewport(new Rectangle(0, 0, 360, 64));

    expect(narrowStateVector.visibleQubitCircleIndices.length).toBeGreaterThan(
      before
    );
  });

  it("should draw fewer representative circles when zoomed far out", () => {
    const zoomedOutStateVector = new StateVectorComponent({
      initialQubitCount: 8,
      viewport: new Rectangle(0, 0, 2000, 2000),
    });
    zoomedOutStateVector.setDisplayScale(0.1);
    const renderedCircles = zoomedOutStateVector.children.filter(
      (child) => child instanceof QubitCircle
    );

    expect(renderedCircles.length).toBeLessThan(
      zoomedOutStateVector.qubitCircleCount
    );
  });

  it("should aggregate the one-row aspect when zoomed far out", () => {
    const rowStateVector = new StateVectorComponent({
      initialQubitCount: 8,
      viewport: new Rectangle(0, 0, 5000, 200),
    });
    rowStateVector.setAspectIndex(8);
    rowStateVector.setDisplayScale(0.1);
    const renderedCircles = rowStateVector.children.filter(
      (child) => child instanceof QubitCircle
    );

    expect(renderedCircles.length).toBeLessThan(rowStateVector.qubitCircleCount);
  });

  it("should return a representative circle for a visible aggregated index", () => {
    const zoomedOutStateVector = new StateVectorComponent({
      initialQubitCount: 8,
      viewport: new Rectangle(0, 0, 2000, 2000),
    });
    zoomedOutStateVector.setDisplayScale(0.1);
    const visibleIndex = zoomedOutStateVector.visibleQubitCircleIndices[1];

    expect(zoomedOutStateVector.qubitCircleAt(visibleIndex)).toBeInstanceOf(
      QubitCircle
    );
  });
});
