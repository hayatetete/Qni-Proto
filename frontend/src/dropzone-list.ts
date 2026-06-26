import { Dropzone } from "./dropzone";
import { List } from "@pixi/ui";
import { OperationComponent } from "./operation-component";
import { Operation } from "./operation";
import { Container, Graphics } from "pixi.js";

export class DropzoneList extends Container {
  private padding: number;
  private list: List;
  private paddedArea: Graphics;

  get size(): number {
    return this.list.children.length;
  }

  get all(): Dropzone[] {
    return this.list.children as Dropzone[];
  }

  get occupied(): Dropzone[] {
    return this.all.filter((each) => each.isOccupied());
  }

  constructor({ padding }: { padding: number }) {
    super();

    this.padding = padding;

    this.paddedArea = new Graphics({ alpha: 0 });
    this.addChild(this.paddedArea);

    this.list = new List({
      type: "vertical",
      vertPadding: padding,
    });
    this.addChild(this.list);

    this.eventMode = "static";
  }

  at(index: number): Dropzone | undefined {
    if (index < 0 || index >= this.size) {
      return undefined;
    }

    return this.all[index];
  }

  fetch(index: number): Dropzone {
    const dropzone = this.at(index);
    if (!dropzone) {
      throw new Error(`Dropzone not found at index ${index}`);
    }

    return dropzone;
  }

  filterByOperationType(gateType: typeof OperationComponent): Dropzone[] {
    return this.occupied.filter((each) => each.operation instanceof gateType);
  }

  findIndexOf(operation: Operation): number {
    return this.all.findIndex((dropzone) => dropzone.operation === operation);
  }

  append(): Dropzone {
    const dropzone = new Dropzone();

    this.list.addChild(dropzone);
    this.updateSize();

    return dropzone;
  }

  removeLast(): void {
    if (this.size === 0) {
      return;
    }

    const dropzone = this.fetch(this.size - 1);

    this.list.removeChildAt(this.size - 1);
    this.updateSize();

    dropzone.destroy();
  }

  private updateSize() {
    const height = this.list.height + this.padding * 2;

    this.paddedArea.clear().rect(0, 0, this.width, height).fill(0x0000ff);
  }
}
