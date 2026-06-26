import { describe, it, expect, beforeEach } from "vitest";
import { QubitCircle } from "../../src/qubit-circle";
import { Size } from "../../src";

describe("QubitCircle", () => {
  let qubitCircle: QubitCircle;

  beforeEach(() => {
    qubitCircle = new QubitCircle();
  });

  it("should initialize with default values", () => {
    expect(qubitCircle.probability).toBe(0);
    expect(qubitCircle.phase).toBe(0);
    expect(qubitCircle.size).toBe("xl");
  });

  describe("probability", () => {
    it("should set probability correctly", () => {
      qubitCircle.probability = 50;
      expect(qubitCircle.probability).toBe(50);
    });

    it("should throw an error when setting probability out of range", () => {
      expect(() => {
        qubitCircle.probability = -1;
      }).toThrow();
      expect(() => {
        qubitCircle.probability = 101;
      }).toThrow();
    });

    it("should handle boundary values", () => {
      qubitCircle.probability = 0;
      expect(qubitCircle.probability).toBe(0);

      qubitCircle.probability = 100;
      expect(qubitCircle.probability).toBe(100);
    });
  });

  describe("phase", () => {
    it("should set phase correctly", () => {
      qubitCircle.phase = Math.PI;
      expect(qubitCircle.phase).toBe(Math.PI);
    });

    it("should throw an error when setting phase out of range", () => {
      expect(() => {
        qubitCircle.phase = -3 * Math.PI;
      }).toThrow();
      expect(() => {
        qubitCircle.phase = 3 * Math.PI;
      }).toThrow();
    });

    it("should handle boundary values", () => {
      qubitCircle.phase = -2 * Math.PI;
      expect(qubitCircle.phase).toBe(-2 * Math.PI);

      qubitCircle.phase = 2 * Math.PI;
      expect(qubitCircle.phase).toBe(2 * Math.PI);
    });
  });

  describe("size", () => {
    it("should set size correctly", () => {
      qubitCircle.size = "base";
      expect(qubitCircle.size).toBe("base");
    });

    it("should handle all valid sizes", () => {
      const sizes: Size[] = ["xs", "sm", "base", "lg", "xl"];

      sizes.forEach((size) => {
        qubitCircle.size = size;
        expect(qubitCircle.size).toBe(size);
      });
    });
  });
});
