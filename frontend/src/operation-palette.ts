import { AntiControlGate } from "./anti-control-gate";
import { BlochSphere } from "./bloch-sphere";
import { Colors } from "./colors";
import { Container, Graphics } from "pixi.js";
import { ControlGate } from "./control-gate";
import { DropShadowFilter } from "pixi-filters";
import { HGate } from "./h-gate";
import { List } from "@pixi/ui";
import { MeasurementGate } from "./measurement-gate";
import { OPERATION_EVENTS } from "./events";
import { OperationClass } from "./operation";
import { OperationComponent } from "./operation-component";
import { OperationSource } from "./operation-source";
import { PhaseGate } from "./phase-gate";
import { QftDaggerGate } from "./qft-dagger-gate";
import { QftGate } from "./qft-gate";
import { RnotGate } from "./rnot-gate";
import { RxGate } from "./rx-gate";
import { RyGate } from "./ry-gate";
import { RzGate } from "./rz-gate";
import { SDaggerGate } from "./s-dagger-gate";
import { SGate } from "./s-gate";
import { SwapGate } from "./swap-gate";
import { TDaggerGate } from "./t-dagger-gate";
import { TGate } from "./t-gate";
import { Write0Gate } from "./write0-gate";
import { Write1Gate } from "./write1-gate";
import { XGate } from "./x-gate";
import { YGate } from "./y-gate";
import { ZGate } from "./z-gate";
import { spacingInPx } from "./util";

const FIRST_ROW_OPERATIONS = [
  HGate,
  XGate,
  YGate,
  ZGate,
  RnotGate,
  SGate,
  SDaggerGate,
  TGate,
  TDaggerGate,
  PhaseGate,
  RxGate,
  RyGate,
  RzGate,
];

const SECOND_ROW_OPERATIONS = [
  SwapGate,
  ControlGate,
  AntiControlGate,
  Write0Gate,
  Write1Gate,
  MeasurementGate,
  BlochSphere,
  QftGate,
  QftDaggerGate,
];

/**
 * Represents the palette of available operations in the UI.
 * This component manages the display and interaction of operation sources.
 */
export class OperationPalette extends Container {
  private static horizontalPadding = spacingInPx(6);
  private static verticalPadding = spacingInPx(4);
  private static gapBetweenOperations = spacingInPx(2);
  private static cornerRadius = spacingInPx(3);
  private static minimumFirstRowGateCountThroughRz = 13;

  operations: { [key: string]: OperationComponent | null } = {};

  private body: Graphics;
  private rows: List;

  constructor() {
    super();

    this.interactive = true;

    this.body = new Graphics();
    this.addChild(this.body);

    this.rows = new List({
      type: "vertical",
      elementsMargin: OperationPalette.gapBetweenOperations,
      vertPadding: OperationPalette.verticalPadding,
      horPadding: OperationPalette.horizontalPadding,
    });
    this.addChild(this.rows);

    this.newRow();
    FIRST_ROW_OPERATIONS.forEach((gate) => {
      this.addOperation(gate);
    });
    this.newRow();
    SECOND_ROW_OPERATIONS.forEach((gate) => this.addOperation(gate));

    this.draw();
  }

  get contentWidth(): number {
    return this.backgroundWidth();
  }

  private addOperation(operationClass: OperationClass) {
    const currentRow = this.rows.children[this.rows.children.length - 1];
    const operationSource = new OperationSource(operationClass);

    currentRow.addChild(operationSource);

    this.setupOperationSourceEvents(operationSource);

    const operation = operationSource.generateNewOperation();
    this.operations[operation.operationType] = operation;
  }

  private newRow() {
    const row = new List({
      type: "horizontal",
      elementsMargin: OperationPalette.gapBetweenOperations,
    });

    this.rows.addChild(row);
  }

  private setupOperationSourceEvents(operationSource: OperationSource) {
    operationSource.on(
      OPERATION_EVENTS.GRABBED,
      (operation, globalPosition) => {
        this.emit(OPERATION_EVENTS.GRABBED, operation, globalPosition);
      }
    );
    operationSource.on(OPERATION_EVENTS.MOUSE_LEFT, (operation) => {
      this.emit(OPERATION_EVENTS.MOUSE_LEFT, operation);
    });
    operationSource.on(OPERATION_EVENTS.DISCARDED, (operation) => {
      this.operations[operation.operationType] = null;
      this.emit(OPERATION_EVENTS.DISCARDED, operation);
    });
  }

  private draw(): void {
    const width = this.backgroundWidth();
    const height = this.rows.height + OperationPalette.verticalPadding * 2;

    this.body
      .clear()
      .roundRect(0, 0, width, height, OperationPalette.cornerRadius)
      .fill(Colors["bg-component"])
      .stroke({ color: Colors["border-component"], width: 1 });

    this.body.filters = [
      new DropShadowFilter({
        offset: { x: 0, y: 4 },
        blur: 3,
        alpha: 0.07,
        resolution: window.devicePixelRatio,
      }),
      new DropShadowFilter({
        offset: { x: 0, y: 2 },
        blur: 2,
        alpha: 0.06,
        resolution: window.devicePixelRatio,
      }),
    ];
  }

  private static requiredContentWidth(): number {
    const longestRowOperationCount = Math.max(
      OperationPalette.minimumFirstRowGateCountThroughRz,
      FIRST_ROW_OPERATIONS.length,
      SECOND_ROW_OPERATIONS.length
    );

    return (
      longestRowOperationCount * OperationComponent.sizeInPx.base +
      (longestRowOperationCount - 1) * OperationPalette.gapBetweenOperations +
      OperationPalette.horizontalPadding * 2
    );
  }

  private backgroundWidth(): number {
    return Math.max(OperationPalette.requiredContentWidth(), this.rows.width);
  }
}
