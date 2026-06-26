import { ColorSource, Container, Graphics } from "pixi.js";
import { Colors, FULL_OPACITY, NO_OPACITY } from "./colors";
import { spacingInPx } from "./util";
import { CircuitStep } from "./circuit-step";

export class CircuitStepMarkerManager extends Container {
  private static readonly MARKER_WIDTH = spacingInPx(1);
  private static readonly COLOR_HOVER = Colors["bg-brand-hover"];
  private static readonly COLOR_ACTIVE = Colors["bg-brand"];

  private markers: Graphics[] = [];
  private steps: CircuitStep[] = [];

  constructor({ steps }: { steps: CircuitStep[] }) {
    super();

    this.steps = steps;
    this.initMarkers();
  }

  update(steps: CircuitStep[]): void {
    this.steps = steps;
    this.adjustMarkers();
    this.updateMarkerPositions();
    this.updateMarkerVisibility();
  }

  private get stepCount() {
    return this.steps.length;
  }

  private get stepWidth() {
    return this.stepAt(0).width;
  }

  private get stepHeight() {
    return this.stepAt(0).height;
  }

  private initMarkers() {
    for (let i = 0; i < this.stepCount; i++) {
      const marker = new Graphics();
      this.addChild(marker);
      this.markers.push(marker);
    }
    this.updateMarkerPositions();
    this.updateMarkerVisibility();
  }

  private updateMarkerPositions() {
    this.markers.forEach((marker, index) => {
      marker.position.x = this.markerXPosition(index);
    });
  }

  private markerXPosition(index: number): number {
    return (
      (index + 1) * this.stepWidth - CircuitStepMarkerManager.MARKER_WIDTH / 2
    );
  }

  private updateMarkerVisibility() {
    this.steps.forEach((step, index) => {
      this.hideMarker(index);

      if (step.isActive) {
        this.drawActiveStepMarker(index);
      }
      if (step.isHovered) {
        this.drawHoveredStepMarker(index);
      }
    });
  }

  private drawActiveStepMarker(index: number) {
    this.drawMarker(
      this.markerAt(index),
      CircuitStepMarkerManager.COLOR_ACTIVE
    );
  }

  private drawHoveredStepMarker(index: number) {
    this.drawMarker(this.markerAt(index), CircuitStepMarkerManager.COLOR_HOVER);
  }

  private hideMarker(index: number) {
    this.markerAt(index).alpha = FULL_OPACITY;
  }

  private stepAt(index: number): CircuitStep {
    const step = this.steps[index];
    if (!step) {
      throw new Error(`Step not found at index ${index}`);
    }

    return step;
  }

  private markerAt(index: number): Graphics {
    const marker = this.markers[index];
    if (!marker) {
      throw new Error(`Marker not found at index ${index}`);
    }

    return marker;
  }

  private drawMarker(marker: Graphics, color: ColorSource) {
    marker
      .clear()
      .moveTo(CircuitStepMarkerManager.MARKER_WIDTH / 2, 0)
      .lineTo(CircuitStepMarkerManager.MARKER_WIDTH / 2, this.stepHeight)
      .stroke({
        color: color,
        width: CircuitStepMarkerManager.MARKER_WIDTH,
      });
    marker.alpha = NO_OPACITY;
  }

  private adjustMarkers(): void {
    const stepCount = this.steps.length;
    const markerCount = this.markers.length;

    if (markerCount < stepCount) {
      for (let i = markerCount; i < stepCount; i++) {
        const marker = new Graphics();
        this.addChild(marker);
        this.markers.push(marker);
      }
    } else if (markerCount > stepCount) {
      for (let i = markerCount - 1; i >= stepCount; i--) {
        const marker = this.markers.pop();
        if (marker) {
          this.removeChild(marker);
        }
      }
    }
  }
}
