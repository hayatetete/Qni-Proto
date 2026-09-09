import { Colors } from "./colors";

type StateCellHoverDetail = {
  index: number;
  qubitCount: number;
  amplitude: [number, number];
  anchorX: number;
  anchorY: number;
  anchorRadius: number;
};

const icon = {
  amplitude: `
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path class="icon-guide" d="M3 2.5v14.5h14.5" />
      <path class="icon-value" d="M3 17 14 6" />
      <path class="icon-fill" d="m10.25 4.25 6.5-1-1 6.5Z" />
    </svg>`,
  probability: `
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle class="icon-guide" cx="10" cy="10" r="7.5" />
      <circle class="icon-fill" cx="10" cy="10" r="4" />
    </svg>`,
  phase: `
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path class="icon-guide" d="M3 16.5h14M3 16.5 12.5 4" />
      <path class="icon-fill" d="M3 16.5h6.5a6.5 6.5 0 0 0-2.55-5.16Z" />
    </svg>`,
};

export function mountStateVectorTooltip(): HTMLElement {
  const existing = document.getElementById("state-vector-tooltip");
  if (existing) return existing;

  const tooltip = document.createElement("div");
  tooltip.id = "state-vector-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  tooltip.innerHTML = `
    <div data-state-heading></div>
    <div class="state-tooltip-row"><span class="state-tooltip-icon">${icon.amplitude}</span><span>Amplitude:</span><output data-amplitude></output></div>
    <div class="state-tooltip-row"><span class="state-tooltip-icon">${icon.probability}</span><span>Probability:</span><output data-probability></output></div>
    <div class="state-tooltip-row"><span class="state-tooltip-icon">${icon.phase}</span><span>Phase:</span><output data-phase></output></div>
  `;
  Object.assign(tooltip.style, {
    position: "fixed",
    zIndex: "120",
    boxSizing: "border-box",
    width: "296px",
    height: "106px",
    padding: "10px 16px 8px",
    border: `1px solid ${Colors["border-component"]}`,
    borderRadius: "12px",
    background: Colors["bg-component"],
    color: Colors["border-component-strong"],
    boxShadow: "0 12px 24px rgb(24 24 27 / 14%)",
    font: "12px/20px ui-monospace, SFMono-Regular, Menlo, monospace",
    pointerEvents: "none",
  });
  const style = document.createElement("style");
  style.textContent = `
    #state-vector-tooltip [data-state-heading] { color: ${Colors.text}; font-size: 14px; line-height: 20px; margin-bottom: 6px; }
    #state-vector-tooltip .state-tooltip-row { display: grid; grid-template-columns: 16px 88px 1fr; column-gap: 8px; height: 20px; align-items: center; }
    #state-vector-tooltip .state-tooltip-icon { display: grid; width: 16px; height: 16px; place-items: center; }
    #state-vector-tooltip .state-tooltip-icon svg { display: block; width: 16px; height: 16px; overflow: visible; }
    #state-vector-tooltip .icon-guide { fill: none; stroke: ${Colors["border-component"]}; stroke-width: 2.5; stroke-linecap: square; stroke-linejoin: miter; }
    #state-vector-tooltip .icon-value { fill: none; stroke: ${Colors["icon-brand"]}; stroke-width: 2.5; stroke-linecap: square; stroke-linejoin: miter; }
    #state-vector-tooltip .icon-fill { fill: ${Colors["icon-brand"]}; }
    #state-vector-tooltip output { color: ${Colors.text}; text-align: right; white-space: nowrap; }
    #state-vector-tooltip::after { content: ""; position: absolute; left: var(--tail-left, 140px); width: 14px; height: 14px; background: ${Colors["bg-component"]}; transform: rotate(45deg); }
    #state-vector-tooltip[data-placement="above"]::after { bottom: -8px; border-right: 1px solid ${Colors["border-component"]}; border-bottom: 1px solid ${Colors["border-component"]}; }
    #state-vector-tooltip[data-placement="below"]::after { top: -8px; border-left: 1px solid ${Colors["border-component"]}; border-top: 1px solid ${Colors["border-component"]}; }
  `;
  document.head.append(style);
  document.body.append(tooltip);

  let hideTimer: ReturnType<typeof window.setTimeout> | undefined;
  let hoveredCell: StateCellHoverDetail | undefined;
  let hiddenWhilePressed = false;

  window.addEventListener("qni-state-cell-hover", (event) => {
    const inspectionPanel = document.getElementById("qni-inspection-panel");
    if (inspectionPanel && !inspectionPanel.classList.contains("hidden")) {
      hoveredCell = undefined;
      tooltip.hidden = true;
      return;
    }
    const detail = (event as CustomEvent<StateCellHoverDetail>).detail;
    hoveredCell = detail;
    window.clearTimeout(hideTimer);
    if (!hiddenWhilePressed) renderTooltip(tooltip, detail);
  });
  window.addEventListener("qni-state-cell-leave", () => {
    hoveredCell = undefined;
    hideTimer = window.setTimeout(() => {
      tooltip.hidden = true;
    }, 80);
  });
  window.addEventListener("qni-state-cell-dismiss", () => {
    hoveredCell = undefined;
    tooltip.hidden = true;
  });
  window.addEventListener("qni-inspection-visibility", (event) => {
    const visible = (event as CustomEvent<{ visible: boolean }>).detail.visible;
    if (!visible) return;
    hoveredCell = undefined;
    hiddenWhilePressed = false;
    window.clearTimeout(hideTimer);
    tooltip.hidden = true;
  });
  window.addEventListener("pointerdown", () => {
    if (tooltip.hidden) return;
    hiddenWhilePressed = true;
    tooltip.hidden = true;
  });
  window.addEventListener("pointerup", () => {
    if (!hiddenWhilePressed) return;
    hiddenWhilePressed = false;
    if (hoveredCell) renderTooltip(tooltip, hoveredCell);
  });
  return tooltip;
}

function renderTooltip(
  tooltip: HTMLElement,
  detail: StateCellHoverDetail,
): void {
  const [real, imaginary] = detail.amplitude;
  const probability = (real * real + imaginary * imaginary) * 100;
  const phase = probability < 1e-12 ? 0 : Math.atan2(imaginary, real) * 180 / Math.PI;
  const bits = detail.index.toString(2).padStart(detail.qubitCount, "0");
  setText(tooltip, "[data-state-heading]", `|${bits}⟩  decimal ${detail.index}`);
  setText(tooltip, "[data-amplitude]", `${signed(real)}${signed(imaginary)}i`);
  setText(tooltip, "[data-probability]", `${signed(probability)}%`);
  setText(tooltip, "[data-phase]", `${signed(phase)}°`);

  tooltip.hidden = false;
  const width = 296;
  const height = 106;
  const viewportPadding = 8;
  const anchorGap = 8;
  const tailHeight = 7;
  const unclampedLeft = detail.anchorX - width / 2;
  const left = Math.min(
    window.innerWidth - width - viewportPadding,
    Math.max(viewportPadding, unclampedLeft),
  );
  const aboveTop =
    detail.anchorY - detail.anchorRadius - anchorGap - tailHeight - height;
  const placement = aboveTop >= viewportPadding ? "above" : "below";
  const top = placement === "above"
    ? aboveTop
    : Math.min(
        window.innerHeight - height - viewportPadding,
        detail.anchorY + detail.anchorRadius + anchorGap + tailHeight,
      );
  const pixelLeft = Math.round(left);
  tooltip.style.left = `${pixelLeft}px`;
  tooltip.style.top = `${Math.round(Math.max(viewportPadding, top))}px`;
  tooltip.style.setProperty(
    "--tail-left",
    `${Math.round(Math.min(width - 21, Math.max(7, detail.anchorX - pixelLeft - 7)))}px`,
  );
  tooltip.dataset.placement = placement;
}

function setText(root: HTMLElement, selector: string, value: string): void {
  const element = root.querySelector(selector);
  if (element) element.textContent = value;
}

function signed(value: number): string {
  const normalized = Math.abs(value) < 0.000005 ? 0 : value;
  return `${normalized >= 0 ? "+" : "-"}${Math.abs(normalized).toFixed(5)}`;
}
