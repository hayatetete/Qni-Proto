import { FederatedPointerEvent, Graphics } from "pixi.js";
import { Colors } from "./colors";
import { FRAME_DIVIDER_EVENTS } from "./events";

const FrameDividerConfig = {
  HEIGHT: 2,
  CURSOR: "ns-resize",
} as const;

/**
 * 量子回路フレームと状態ベクトルフレーム間のドラッグ可能な分割線を表すクラス。
 */
export class FrameDivider extends Graphics {
  private static instance: FrameDivider | null = null;

  private _isDragging = false;
  private dragStartY = 0;

  static initialize({
    width,
    initialY,
  }: {
    width: number;
    initialY: number;
  }): FrameDivider {
    if (!this.instance) {
      this.instance = new FrameDivider(initialY, width);
    }
    return this.instance;
  }

  static getInstance(): FrameDivider {
    if (this.instance === null) {
      throw new Error(
        "FrameDivider is not initialized. Call initialize() first."
      );
    }
    return this.instance;
  }

  private constructor(initialY: number, width: number) {
    super();

    this.y = initialY;
    this.drawDivider(width);
    this.interactive = true;
    this.cursor = FrameDividerConfig.CURSOR;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.on("pointerdown", this.startDragging, this);
  }

  private drawDivider(width: number): void {
    this.clear()
      .rect(0, 0, width, FrameDividerConfig.HEIGHT)
      .fill(Colors["border-component"]);
  }

  public updateWidth(width: number): void {
    this.drawDivider(width);
  }

  get isDragging(): boolean {
    return this._isDragging;
  }

  private startDragging(event: FederatedPointerEvent): void {
    this._isDragging = true;
    this.dragStartY = event.global.y - this.y;
    this.emit(FRAME_DIVIDER_EVENTS.DRAG_STARTED);
  }

  endDragging(): void {
    if (!this.isDragging) return;

    this._isDragging = false;
  }

  move(y: number, height: number): void {
    if (!this.isDragging) return;

    const newPosition = y - this.dragStartY;
    this.y = this.clampPosition(newPosition, height);
  }

  private clampPosition(position: number, height: number): number {
    const minPosition = 0;
    const maxPosition = height - FrameDividerConfig.HEIGHT;

    return Math.max(minPosition, Math.min(position, maxPosition));
  }
}
