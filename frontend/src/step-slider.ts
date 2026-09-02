import { App } from "./app";
import { CIRCUIT_EVENTS, CIRCUIT_STEP_EVENTS } from "./events";
import "./step-slider.css";

const MINIMUM_WIDTH = 260;
const VIEWPORT_PADDING = 8;
const MINIMUM_ALL_TICK_SPACING = 14;
const MINIMUM_REPRESENTATIVE_TICK_SPACING = 30;

export function niceTickStep(rawStep: number): number {
  if (rawStep <= 1) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

export function scaleTicks(
  maximum: number,
  trackWidth: number,
): { values: number[]; representative: boolean; width: number } {
  if (maximum <= 0) return { values: maximum === 0 ? [0] : [], representative: false, width: 5 };

  const allTickSpacing = trackWidth / maximum;
  if (allTickSpacing >= MINIMUM_ALL_TICK_SPACING) {
    const width = allTickSpacing >= 30 ? 5 : allTickSpacing >= 20 ? 4 : 3;
    return {
      values: Array.from({ length: maximum + 1 }, (_, value) => value),
      representative: false,
      width,
    };
  }

  const targetIntervals = Math.max(
    1,
    Math.floor(trackWidth / MINIMUM_REPRESENTATIVE_TICK_SPACING),
  );
  const step = niceTickStep(maximum / targetIntervals);
  const values = Array.from(
    { length: Math.floor(maximum / step) + 1 },
    (_, index) => index * step,
  );
  const lastRegularValue = values.at(-1) ?? 0;
  if (lastRegularValue !== maximum) {
    if (maximum - lastRegularValue < step / 2 && values.length > 1) values.pop();
    values.push(maximum);
  }
  return { values, representative: true, width: 5 };
}

/** Notebook用のステップ選択UIを生成し、回路と同期する。 */
export class StepSlider {
  readonly container: HTMLDivElement;
  private readonly slider: HTMLInputElement;
  private readonly number: HTMLInputElement;
  private readonly ticks: HTMLDivElement;
  private readonly labels: HTMLDivElement;
  private readonly resizeHandle: HTMLDivElement;
  private pendingStepIndex: number;
  private selectionFrame: number | null = null;

  constructor(private readonly app: App) {
    this.container = document.createElement("div");
    this.container.id = "step-slider-container";
    this.container.innerHTML = `
      <div id="step-slider-track"></div>
      <div id="step-slider-ticks"></div>
      <div id="step-slider-labels"></div>
      <input id="step-number" type="number" min="0" value="0" aria-label="Step number" />
      <input id="step-slider" type="range" min="0" max="0" step="1" value="0" aria-label="Circuit step" />
      <div
        id="step-slider-resize-handle"
        role="separator"
        aria-label="Resize step slider"
        aria-orientation="vertical"
        aria-valuemin="${MINIMUM_WIDTH}"
        title="Drag to resize"
      >
        <span id="step-slider-resize-mark"></span>
      </div>
    `;

    this.slider = this.requiredElement("step-slider", HTMLInputElement);
    this.number = this.requiredElement("step-number", HTMLInputElement);
    this.ticks = this.requiredElement("step-slider-ticks", HTMLDivElement);
    this.labels = this.requiredElement("step-slider-labels", HTMLDivElement);
    this.resizeHandle = this.requiredElement(
      "step-slider-resize-handle",
      HTMLDivElement,
    );
    this.pendingStepIndex = app.circuit.activeStepIndex ?? 0;
  }

  mount(parent: HTMLElement): void {
    parent.prepend(this.container);
    this.setupSelection();
    this.setupFloatingBox();
    this.renderScale();
    new ResizeObserver(this.renderScale).observe(this.container);
  }

  private requiredElement<T extends HTMLElement>(
    id: string,
    elementType: { new (): T },
  ): T {
    const element = this.container.querySelector(`#${id}`);
    if (!(element instanceof elementType)) {
      throw new Error(`Step slider element #${id} is missing.`);
    }
    return element;
  }

  private clampStepIndex(value: number): number {
    return Math.min(
      Math.max(0, Math.round(value)),
      Math.max(0, this.app.circuit.steps.length - 1),
    );
  }

  private renderValue(stepIndex: number): void {
    const clamped = this.clampStepIndex(stepIndex);
    const maximum = Math.max(0, this.app.circuit.steps.length - 1);
    this.slider.value = String(clamped);
    this.number.value = String(clamped);
    this.container.style.setProperty(
      "--step-progress",
      maximum === 0 ? "0" : String(clamped / maximum),
    );
  }

  private selectStep(stepIndex: number): void {
    this.pendingStepIndex = this.clampStepIndex(stepIndex);
    this.renderValue(this.pendingStepIndex);
    if (this.selectionFrame !== null) return;
    this.selectionFrame = requestAnimationFrame(() => {
      this.selectionFrame = null;
      const selected = this.clampStepIndex(this.pendingStepIndex);
      this.app.circuit.fetchStep(selected).activate();
      this.app.circuitFrame.scrollStepIntoView(selected);
    });
  }

  private renderScale = (): void => {
    const stepCount = this.app.circuit.steps.length;
    const maximum = Math.max(0, stepCount - 1);
    this.slider.max = String(maximum);
    this.number.max = String(maximum);
    this.ticks.replaceChildren();
    this.labels.replaceChildren();
    const trackWidth = this.ticks.getBoundingClientRect().width;
    const scale = scaleTicks(maximum, trackWidth);
    this.container.dataset.representativeScale = String(scale.representative);
    for (const value of scale.values) {
      const position = maximum === 0 ? 0 : (value / maximum) * 100;
      const tick = document.createElement("span");
      tick.dataset.value = String(value);
      tick.style.left = `${position}%`;
      tick.style.width = `${scale.width}px`;
      this.ticks.append(tick);
      if (scale.representative) {
        const label = document.createElement("span");
        label.textContent = String(value);
        label.style.left = `${position}%`;
        this.labels.append(label);
      }
    }
    this.renderValue(this.app.circuit.activeStepIndex ?? 0);
  };

  private setupSelection(): void {
    this.slider.addEventListener("input", () =>
      this.selectStep(Number(this.slider.value)),
    );
    this.slider.addEventListener("change", () =>
      this.selectStep(Number(this.slider.value)),
    );
    this.number.addEventListener("change", () =>
      this.selectStep(Number(this.number.value)),
    );
    this.number.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.ctrlKey || event.metaKey) return;

        const horizontalGesture = Math.abs(event.deltaX) > Math.abs(event.deltaY);
        const delta = horizontalGesture ? event.deltaX : event.deltaY;
        if (delta === 0) return;
        this.selectStep(this.pendingStepIndex + Math.sign(delta));
      },
      { passive: false },
    );
    this.number.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.selectStep(Number(this.number.value));
        this.slider.focus();
      }
    });
    this.app.circuit.on(CIRCUIT_STEP_EVENTS.ACTIVATED, () => {
      this.renderValue(this.app.circuit.activeStepIndex ?? 0);
    });
    this.app.circuit.on(CIRCUIT_EVENTS.STEPS_CHANGED, this.renderScale);
  }

  private setupFloatingBox(): void {
    let moveFrame: number | null = null;
    let pendingLeft = 0;
    let pendingTop = 0;

    const placeAt = (left: number, top: number): void => {
      pendingLeft = left;
      pendingTop = top;
      if (moveFrame !== null) return;
      moveFrame = requestAnimationFrame(() => {
        moveFrame = null;
        const maximumLeft = Math.max(
          VIEWPORT_PADDING,
          window.innerWidth - this.container.offsetWidth - VIEWPORT_PADDING,
        );
        const maximumTop = Math.max(
          VIEWPORT_PADDING,
          window.innerHeight - this.container.offsetHeight - VIEWPORT_PADDING,
        );
        this.container.style.left = `${Math.min(Math.max(VIEWPORT_PADDING, pendingLeft), maximumLeft)}px`;
        this.container.style.top = `${Math.min(Math.max(VIEWPORT_PADDING, pendingTop), maximumTop)}px`;
        this.container.style.bottom = "auto";
        this.container.style.transform = "none";
      });
    };

    this.container.addEventListener("pointerdown", (event) => {
      const target = event.target;
      if (
        !(target instanceof Element) ||
        target === this.slider ||
        target === this.number ||
        target.closest("#step-slider-resize-handle")
      ) {
        return;
      }

      event.preventDefault();
      const rect = this.container.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      this.container.dataset.dragging = "true";
      this.container.setPointerCapture(event.pointerId);

      const move = (moveEvent: PointerEvent) => {
        placeAt(moveEvent.clientX - offsetX, moveEvent.clientY - offsetY);
      };
      const finish = () => {
        delete this.container.dataset.dragging;
        this.container.removeEventListener("pointermove", move);
        this.container.removeEventListener("pointerup", finish);
        this.container.removeEventListener("pointercancel", finish);
      };
      this.container.addEventListener("pointermove", move);
      this.container.addEventListener("pointerup", finish);
      this.container.addEventListener("pointercancel", finish);
    });

    this.resizeHandle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = this.container.getBoundingClientRect();
      const startX = event.clientX;
      const startWidth = rect.width;
      this.resizeHandle.setPointerCapture(event.pointerId);

      this.container.style.left = `${rect.left}px`;
      this.container.style.top = `${rect.top}px`;
      this.container.style.bottom = "auto";
      this.container.style.transform = "none";

      const resize = (moveEvent: PointerEvent) => {
        const maximumWidth = Math.max(
          MINIMUM_WIDTH,
          window.innerWidth - rect.left - VIEWPORT_PADDING,
        );
        const width = Math.min(
          maximumWidth,
          Math.max(MINIMUM_WIDTH, startWidth + moveEvent.clientX - startX),
        );
        this.container.style.width = `${width}px`;
        this.resizeHandle.setAttribute("aria-valuenow", String(Math.round(width)));
      };
      const finish = () => {
        this.resizeHandle.removeEventListener("pointermove", resize);
        this.resizeHandle.removeEventListener("pointerup", finish);
        this.resizeHandle.removeEventListener("pointercancel", finish);
      };
      this.resizeHandle.addEventListener("pointermove", resize);
      this.resizeHandle.addEventListener("pointerup", finish);
      this.resizeHandle.addEventListener("pointercancel", finish);
    });

    window.addEventListener("resize", () => {
      const rect = this.container.getBoundingClientRect();
      const maximumWidth = Math.max(
        MINIMUM_WIDTH,
        window.innerWidth - 2 * VIEWPORT_PADDING,
      );
      if (rect.width > maximumWidth) this.container.style.width = `${maximumWidth}px`;
      placeAt(rect.left, rect.top);
    });
  }
}

export function mountStepSlider(app: App): StepSlider {
  const component = new StepSlider(app);
  const parent = document.getElementById("app");
  if (!parent) throw new Error("#app is required to mount the step slider.");
  component.mount(parent);
  return component;
}
