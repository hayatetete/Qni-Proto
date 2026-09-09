import { App } from "./app";
import { Colors } from "./colors";
import { CIRCUIT_STEP_EVENTS } from "./events";
import { scaleTicks } from "./step-slider";
import type { SerializedOperation } from "./types";
import "./inspection-panel.css";

export type InspectionCheckpoint = { name: string; step: number; expected_probabilities: Record<string, number>; expected_amplitudes?: Record<string, [number, number]>; tolerance?: number; source?: string };
type StepResult = { amplitudes: Record<string, [number, number]> };
type BasisState = { index: number; amplitude: [number, number]; probability: number };
type ResizeDirection = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";

const TEXT = { title: "State inspection", inspect: "Inspect", selectStep: "Inspection step", step: "Step", major: "Dominant states", qubits: "Qubits", basis: "Basis state", decimal: "decimal index", probability: "Probability", amplitude: "Amplitude", phase: "Phase", showMore: "Show more states", first: "First failure", whyFailed: "Why this checkpoint failed", expected: "Expected", actual: "Actual", difference: "Difference", passed: "All checkpoints passed", waiting: "Waiting for simulation…", noChecks: "No checkpoints", close: "Close state inspection", resize: "Resize state inspection" } as const;
const MIN_WIDTH = 300;
const MIN_HEIGHT = 280;

export function setupInspectionPanel(app: App, checkpoints: InspectionCheckpoint[], steps: SerializedOperation[][], qubitNames: string[]): HTMLElement {
  document.getElementById("qni-inspection-panel")?.remove();
  let results: StepResult[] = [];
  const panel = document.createElement("aside");
  panel.id = "qni-inspection-panel";
  panel.setAttribute("role", "region");
  panel.className = "fixed z-50 flex flex-col overflow-hidden rounded-lg border border-gray-300 bg-white text-left shadow-lg";
  Object.assign(panel.style, { top: "56px", right: "16px", width: "min(460px, calc(100vw - 24px))", height: "520px", maxWidth: "calc(100vw - 24px)", maxHeight: "calc(100vh - 72px)", minWidth: `${MIN_WIDTH}px`, minHeight: `${MIN_HEIGHT}px` });
  panel.style.setProperty("--inspection-success", Colors["status-success"]);
  panel.style.setProperty("--inspection-error", Colors["status-error"]);
  panel.style.setProperty("--inspection-brand", Colors["bg-brand"]);
  document.body.append(panel);

  const header = document.createElement("header");
  header.className = "flex shrink-0 cursor-move select-none items-center gap-2 border-b border-gray-300 bg-white px-3 py-2";
  const title = document.createElement("h2");
  title.className = "text-sm font-semibold text-neutral-900";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "ml-auto grid h-7 w-7 place-items-center rounded-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 active:text-purple-700 focus:outline-none focus:ring-1 focus:ring-purple-500";
  close.innerHTML = '<svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg>';
  close.addEventListener("pointerdown", (event) => event.stopPropagation());
  header.append(title, close);

  const controls = document.createElement("div");
  controls.id = "inspection-step-control";
  controls.className = "border-b border-gray-200 bg-neutral-50";
  controls.innerHTML = `
    <label id="inspection-step-value" for="inspection-step-number">
      <span>${TEXT.step}</span>
      <input id="inspection-step-number" type="number" min="0" value="0" aria-label="Inspection step number" />
      <span aria-hidden="true">/</span>
      <output id="inspection-step-maximum" for="inspection-step-number">0</output>
    </label>
    <div id="inspection-step-track"></div>
    <div id="inspection-step-ticks"></div>
    <div id="inspection-step-hover" aria-hidden="true" hidden></div>
    <div id="inspection-step-labels"></div>
    <input id="inspection-step-slider" type="range" min="0" max="0" step="1" value="0" aria-label="${TEXT.selectStep}" />
  `;
  const stepSlider = requiredElement(controls, "inspection-step-slider", HTMLInputElement);
  const stepNumber = requiredElement(controls, "inspection-step-number", HTMLInputElement);
  const stepMaximum = requiredElement(controls, "inspection-step-maximum", HTMLOutputElement);
  const stepTicks = requiredElement(controls, "inspection-step-ticks", HTMLDivElement);
  const stepLabels = requiredElement(controls, "inspection-step-labels", HTMLDivElement);
  const stepHover = requiredElement(controls, "inspection-step-hover", HTMLDivElement);
  const body = document.createElement("div");
  body.className = "min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-neutral-50 p-3 text-xs text-neutral-900";
  panel.append(header, controls, body, ...createResizeHandles(panel, () => TEXT.resize));

  const toggle = document.getElementById("inspection-panel-toggle") as HTMLButtonElement | null;
  const setVisible = (visible: boolean) => {
    panel.classList.toggle("hidden", !visible);
    toggle?.setAttribute("aria-expanded", String(visible));
    toggle?.setAttribute("aria-pressed", String(visible));
    toggle?.classList.toggle("border-purple-500", visible);
    toggle?.classList.toggle("border-sky-700", !visible);
    window.dispatchEvent(
      new CustomEvent("qni-inspection-visibility", { detail: { visible } }),
    );
  };
  toggle?.addEventListener("click", () => setVisible(panel.classList.contains("hidden")));
  close.addEventListener("click", () => setVisible(false));
  setVisible(checkpoints.length > 0);
  startDragging(panel, header);
  const selectStep = (value: number) => {
    const maximum = Math.max(0, app.circuit.steps.length - 1);
    const selected = clamp(Math.round(value), 0, maximum);
    app.circuit.fetchStep(selected).activate();
    app.circuitFrame.scrollStepIntoView(selected);
  };
  stepSlider.addEventListener("input", () => selectStep(Number(stepSlider.value)));
  stepNumber.addEventListener("change", () => selectStep(Number(stepNumber.value)));
  stepNumber.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    selectStep(Number(stepNumber.value));
  });
  stepSlider.addEventListener("pointermove", (event) => {
    const rect = stepSlider.getBoundingClientRect();
    const maximum = Math.max(0, app.circuit.steps.length - 1);
    const progress = clamp((event.clientX - rect.left - 3.5) / Math.max(1, rect.width - 7), 0, 1);
    const hovered = Math.round(progress * maximum);
    controls.style.setProperty("--inspection-step-hover-progress", maximum === 0 ? "0" : String(hovered / maximum));
    stepHover.hidden = hovered === (app.circuit.activeStepIndex ?? 0);
    app.circuit.steps.forEach((step, index) => step.setHovered(index === hovered));
  });
  stepSlider.addEventListener("pointerleave", () => {
    stepHover.hidden = true;
    app.circuit.steps.forEach((step) => step.setHovered(false));
  });

  const renderScale = () => {
    const maximum = Math.max(0, app.circuit.steps.length - 1);
    stepSlider.max = String(maximum);
    stepNumber.max = String(maximum);
    stepMaximum.textContent = String(maximum);
    stepTicks.replaceChildren();
    stepLabels.replaceChildren();
    const scale = scaleTicks(maximum, stepTicks.getBoundingClientRect().width);
    controls.dataset.representativeScale = String(scale.representative);
    for (const value of scale.values) {
      const position = maximum === 0 ? 0 : value / maximum * 100;
      const tick = document.createElement("span");
      tick.dataset.value = String(value);
      tick.dataset.active = String(value === (app.circuit.activeStepIndex ?? 0));
      tick.style.left = `${position}%`;
      tick.style.width = `${scale.width}px`;
      stepTicks.append(tick);
      if (scale.representative) {
        const label = document.createElement("span");
        label.textContent = String(value);
        label.style.left = `${position}%`;
        stepLabels.append(label);
      }
    }
  };

  const render = () => {
    title.textContent = TEXT.title;
    close.setAttribute("aria-label", TEXT.close);
    toggle?.setAttribute("aria-label", TEXT.inspect);
    const active = app.circuit.activeStepIndex ?? 0;
    const maximum = Math.max(0, app.circuit.steps.length - 1);
    if (stepSlider.max !== String(maximum)) renderScale();
    stepSlider.value = String(clamp(active, 0, maximum));
    stepNumber.value = String(clamp(active, 0, maximum));
    for (const tick of stepTicks.children) {
      if (tick instanceof HTMLElement) tick.dataset.active = String(Number(tick.dataset.value) === active);
    }
    body.replaceChildren(renderSummary(app, checkpoints, results, steps, qubitNames, TEXT));
  };
  app.circuit.on(CIRCUIT_STEP_EVENTS.ACTIVATED, render);
  window.addEventListener("qni-inspection-results", (event) => { results = (event as CustomEvent<{ results: StepResult[] }>).detail.results; render(); });
  new ResizeObserver(renderScale).observe(controls);
  renderScale();
  render();
  return panel;
}

function renderSummary(app: App, checkpoints: InspectionCheckpoint[], results: StepResult[], steps: SerializedOperation[][], qubitNames: string[], text: typeof TEXT): HTMLElement {
  const fragment = document.createElement("div");
  fragment.className = "space-y-3";
  const active = app.circuit.activeStepIndex ?? 0;
  const amplitudes = results[active]?.amplitudes ?? {};
  const states = Object.entries(amplitudes).map(([index, amplitude]) => ({ index: Number(index), amplitude, probability: amplitude[0] ** 2 + amplitude[1] ** 2 })).filter(({ probability }) => probability > 1e-12).sort((a, b) => b.probability - a.probability);
  const width = app.stateVector.qubitCount;
  const source = active > 0 ? (steps[active - 1] ?? []).flatMap((operation) => operation.source ? [operation.source] : []) : [];
  const sourceCard = source.length ? `<section class="rounded-md border border-gray-300 bg-white p-3"><div class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Python source</div>${source.map((item) => `<div class="min-w-0"><div class="truncate font-mono" title="${escapeHtml(item.code)}"><span class="text-sky-700">L${item.line}</span> ${escapeHtml(item.code)}</div>${item.scope ? `<div class="mt-0.5 truncate text-[11px] text-neutral-500" title="${escapeHtml(item.scope)}">${escapeHtml(item.scope)}</div>` : ""}</div>`).join("")}</section>` : "";
  const qubitCard = qubitNames.length ? `<section class="rounded-md border border-gray-300 bg-white p-3"><h3 class="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">${text.qubits}</h3><dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">${qubitNames.map((name, index) => `<div class="flex min-w-0 items-baseline gap-2"><dt class="shrink-0 font-mono font-semibold text-sky-700">q${index}</dt><dd class="truncate text-neutral-700" title="${escapeHtml(name)}">${escapeHtml(name)}</dd></div>`).join("")}</dl></section>` : "";
  const maximumProbability = states[0]?.probability ?? 0;
  const primaryStates = states.filter(({ probability }) => probability >= maximumProbability * .5).slice(0, 8);
  const hiddenStates = states.slice(primaryStates.length);
  const table = states.length ? renderStateTable(primaryStates, width, text) : `<div class="py-4 text-center text-neutral-500">${text.waiting}</div>`;
  const moreStates = hiddenStates.length ? `<details class="border-t border-gray-200 pt-2"><summary class="cursor-pointer font-semibold text-sky-700">${text.showMore} (${hiddenStates.length})</summary><div class="mt-2 max-h-56 overflow-auto">${renderStateTable(hiddenStates, width, text)}</div></details>` : "";
  const evaluations = checkpoints.map((checkpoint) => ({ checkpoint, passed: evaluate(checkpoint, results) }));
  const failed = evaluations
    .filter(({ passed }) => passed === false)
    .sort((left, right) => left.checkpoint.step - right.checkpoint.step)[0]?.checkpoint;
  const allPassed = evaluations.length > 0 && evaluations.every(({ passed }) => passed === true);
  const status = failed ? `<div class="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-800"><b>${text.first}: Step ${failed.step}</b><div>${escapeHtml(failed.name)}</div></div>` : allPassed ? `<div class="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2">${statusMark(true, text.passed)}</div>` : checkpoints.length ? `<div class="text-neutral-500">${text.waiting}</div>` : `<div class="text-neutral-500">${text.noChecks}</div>`;
  const failureDetails = failed ? renderFailureDetails(failed, results, text) : "";
  const checks = evaluations.map(({ checkpoint, passed }) => `<li class="grid grid-cols-[auto_1fr_auto] items-start gap-2 rounded-md border border-gray-300 bg-white px-2.5 py-2"><button type="button" data-check-step="${checkpoint.step}" class="font-semibold text-sky-700 hover:underline">Step ${checkpoint.step}</button><span class="min-w-0"><span>${escapeHtml(checkpoint.name)}</span>${checkpoint.source ? `<small class="block truncate text-neutral-500">${escapeHtml(checkpoint.source)}</small>` : ""}</span>${statusMark(passed, passed === undefined ? "WAIT" : passed ? "PASS" : "FAIL")}</li>`).join("");
  fragment.innerHTML = `<section class="rounded-md border border-gray-300 bg-white p-3"><h3 class="text-sm font-semibold text-neutral-900">${text.major}</h3><div class="mt-3 max-h-56 overflow-auto">${table}</div>${moreStates}</section>${qubitCard}${sourceCard}${status}${failureDetails}${checks ? `<ol class="space-y-1.5">${checks}</ol>` : ""}`;
  fragment.querySelectorAll<HTMLButtonElement>("[data-check-step]").forEach((button) => button.addEventListener("click", () => app.circuit.fetchStep(Number(button.dataset.checkStep)).activate()));
  return fragment;
}

function renderFailureDetails(checkpoint: InspectionCheckpoint, results: StepResult[], text: typeof TEXT): string {
  const amplitudes = results[checkpoint.step]?.amplitudes ?? {};
  const tolerance = checkpoint.tolerance ?? 1e-6;
  const probabilityRows = Object.entries(checkpoint.expected_probabilities).flatMap(([bits, expected]) => {
    const [real, imaginary] = amplitudes[parseInt(bits, 2)] ?? [0, 0];
    const actual = real ** 2 + imaginary ** 2;
    const difference = actual - expected;
    if (Math.abs(difference) <= tolerance) return [];
    return [`<tr><th scope="row">|${escapeHtml(bits)}⟩ probability</th><td>${formatPercent(expected)}</td><td>${formatPercent(actual)}</td><td>${formatSignedPercent(difference)}</td></tr>`];
  });
  const amplitudeRows = Object.entries(checkpoint.expected_amplitudes ?? {}).flatMap(([bits, expected]) => {
    const actual = amplitudes[parseInt(bits, 2)] ?? [0, 0];
    if (Math.abs(actual[0] - expected[0]) <= tolerance && Math.abs(actual[1] - expected[1]) <= tolerance) return [];
    return [`<tr><th scope="row">|${escapeHtml(bits)}⟩ amplitude</th><td>${formatComplex(expected)}</td><td>${formatComplex(actual)}</td><td>—</td></tr>`];
  });
  const rows = [...probabilityRows, ...amplitudeRows].join("");
  if (!rows) return "";
  return `<section class="rounded-md border border-red-200 bg-white p-3"><h3 class="text-xs font-semibold text-red-800">${text.whyFailed}</h3><div class="mt-2 overflow-x-auto"><table class="inspection-failure-table w-full"><thead><tr><th></th><th>${text.expected}</th><th>${text.actual}</th><th>${text.difference}</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function renderStateTable(states: BasisState[], width: number, text: typeof TEXT): string {
  const rows = states.map(({ index, amplitude, probability }) => {
    const bits = index.toString(2).padStart(width, "0");
    const phase = Math.atan2(amplitude[1], amplitude[0]);
    return `<tr class="border-t border-gray-200"><th scope="row" class="py-2 pr-2 text-left font-mono font-semibold"><span class="inspection-basis-label"><span>|${bits}⟩</span><span class="inspection-basis-decimal" aria-label="${text.decimal} ${index}">|${index}⟩<sub>10</sub></span></span></th><td class="py-2 pr-2"><div class="flex items-center gap-2"><div class="inspection-probability-track"><div class="inspection-probability-fill" style="width:${Math.max(1, probability * 100)}%"></div></div><span class="w-12 text-right tabular-nums">${formatPercent(probability)}</span></div></td><td class="py-2 pr-2 text-right font-mono text-[11px] tabular-nums">${formatComplex(amplitude)}</td><td class="py-2 text-right tabular-nums"><span class="inline-flex items-center justify-end gap-1">${phaseIcon(phase)}<span>${formatDegrees(phase)}</span></span></td></tr>`;
  }).join("");
  return `<table class="inspection-state-table w-full table-fixed"><colgroup><col style="width:34%"><col style="width:27%"><col style="width:25%"><col style="width:14%"></colgroup><thead><tr class="text-[11px] text-neutral-500"><th class="pb-1 text-left">${text.basis}</th><th class="pb-1 text-left">${text.probability}</th><th class="pb-1 text-right">${text.amplitude}</th><th class="pb-1 text-right">${text.phase}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function phaseIcon(phase: number): string {
  const degrees = phase * 180 / Math.PI;
  const sector = phaseSectorPath(phase);
  return `<svg class="inspection-phase-icon" viewBox="0 0 16 16" aria-hidden="true" data-phase-degrees="${Math.round(degrees)}">${sector ? `<path class="inspection-phase-sector" d="${sector}"/>` : ""}<circle cx="8" cy="8" r="6.25" fill="none" stroke="#a1a1aa" stroke-width="1.5"/><path d="M8 8V2.5" stroke="#0369a1" stroke-width="1.75" stroke-linecap="round" transform="rotate(${degrees} 8 8)"/></svg>`;
}

function phaseSectorPath(phase: number): string {
  if (Math.abs(phase) < 1e-12) return "";
  const radius = 6;
  const x = 8 + radius * Math.sin(phase);
  const y = 8 - radius * Math.cos(phase);
  const largeArc = Math.abs(phase) > Math.PI ? 1 : 0;
  const sweep = phase >= 0 ? 1 : 0;
  return `M8 8 L8 2 A6 6 0 ${largeArc} ${sweep} ${x.toFixed(3)} ${y.toFixed(3)} Z`;
}

function statusMark(passed: boolean | undefined, label: string): string {
  if (passed === undefined) return `<strong class="text-neutral-500">${label}</strong>`;
  const path = passed ? '<path d="m3 8.5 3 3L13 4.5"/>' : '<path d="m4.5 4.5 7 7m0-7-7 7"/>';
  return `<strong class="inline-flex items-center gap-1 ${passed ? "inspection-status-pass" : "inspection-status-fail"}"><svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>${label}</strong>`;
}

function evaluate(checkpoint: InspectionCheckpoint, results: StepResult[]): boolean | undefined { const amplitudes = results[checkpoint.step]?.amplitudes; if (!amplitudes || !Object.keys(amplitudes).length) return undefined; const tolerance = checkpoint.tolerance ?? 1e-6; return Object.entries(checkpoint.expected_probabilities).every(([bits, expected]) => { const [r, i] = amplitudes[parseInt(bits, 2)] ?? [0, 0]; return Math.abs(r * r + i * i - expected) <= tolerance; }) && Object.entries(checkpoint.expected_amplitudes ?? {}).every(([bits, expected]) => { const actual = amplitudes[parseInt(bits, 2)] ?? [0, 0]; return Math.abs(actual[0] - expected[0]) <= tolerance && Math.abs(actual[1] - expected[1]) <= tolerance; }); }
function formatPercent(value: number): string { return `${(value * 100).toFixed(value >= .01 ? 1 : 3)}%`; }
function formatSignedPercent(value: number): string { return `${value >= 0 ? "+" : "−"}${formatPercent(Math.abs(value))}`; }
function formatComplex([real, imaginary]: [number, number]): string { return `${formatNumber(real)} ${imaginary < 0 ? "−" : "+"} ${formatNumber(Math.abs(imaginary))}i`; }
function formatNumber(value: number): string { return Math.abs(value) < 1e-12 ? "0" : value.toPrecision(4); }
function formatDegrees(value: number): string { return `${Math.round(value * 180 / Math.PI)}°`; }
function escapeHtml(value: string): string { const span = document.createElement("span"); span.textContent = value; return span.innerHTML; }
function clamp(value: number, minimum: number, maximum: number): number { return Math.min(maximum, Math.max(minimum, value)); }
function requiredElement<T extends HTMLElement>(parent: ParentNode, id: string, elementType: { new(): T }): T { const element = parent.querySelector(`#${id}`); if (!(element instanceof elementType)) throw new Error(`Inspection control #${id} is missing.`); return element; }

function startDragging(panel: HTMLElement, handle: HTMLElement): void { handle.addEventListener("pointerdown", (event) => { if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return; const rect = panel.getBoundingClientRect(); const offsetX = event.clientX - rect.left; const offsetY = event.clientY - rect.top; handle.setPointerCapture(event.pointerId); const move = (next: PointerEvent) => { panel.style.left = `${clamp(next.clientX - offsetX, 0, Math.max(0, innerWidth - panel.offsetWidth))}px`; panel.style.top = `${clamp(next.clientY - offsetY, 44, Math.max(44, innerHeight - panel.offsetHeight))}px`; panel.style.right = "auto"; }; const end = () => { handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", end); handle.removeEventListener("pointercancel", end); }; handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", end); handle.addEventListener("pointercancel", end); }); }
function createResizeHandles(panel: HTMLElement, label: () => string): HTMLButtonElement[] { const configs: Array<[ResizeDirection, string]> = [["n", "top-0 left-3 right-3 h-2 cursor-ns-resize"], ["e", "right-0 top-3 bottom-3 w-2 cursor-ew-resize"], ["s", "bottom-0 left-3 right-3 h-2 cursor-ns-resize"], ["w", "left-0 top-3 bottom-3 w-2 cursor-ew-resize"], ["ne", "right-0 top-0 h-4 w-4 cursor-nesw-resize"], ["nw", "left-0 top-0 h-4 w-4 cursor-nwse-resize"], ["se", "right-0 bottom-0 h-4 w-4 cursor-nwse-resize"], ["sw", "left-0 bottom-0 h-4 w-4 cursor-nesw-resize"]]; return configs.map(([direction, classes]) => { const handle = document.createElement("button"); handle.type = "button"; handle.className = `absolute ${classes}`; handle.setAttribute("aria-label", `${label()} ${direction}`); handle.addEventListener("pointerdown", (event) => startResize(panel, handle, event, direction)); return handle; }); }
function startResize(panel: HTMLElement, target: HTMLElement, event: PointerEvent, direction: ResizeDirection): void { if (event.button !== 0) return; event.preventDefault(); const rect = panel.getBoundingClientRect(); const startX = event.clientX; const startY = event.clientY; target.setPointerCapture(event.pointerId); const move = (next: PointerEvent) => { const dx = next.clientX - startX; const dy = next.clientY - startY; let left = rect.left; let top = rect.top; let width = rect.width; let height = rect.height; if (direction.includes("e")) width = clamp(rect.width + dx, MIN_WIDTH, innerWidth - rect.left); if (direction.includes("s")) height = clamp(rect.height + dy, MIN_HEIGHT, innerHeight - rect.top); if (direction.includes("w")) { width = clamp(rect.width - dx, MIN_WIDTH, rect.right); left = rect.right - width; } if (direction.includes("n")) { height = clamp(rect.height - dy, MIN_HEIGHT, rect.bottom - 44); top = rect.bottom - height; } Object.assign(panel.style, { left: `${left}px`, top: `${top}px`, right: "auto", width: `${width}px`, height: `${height}px` }); }; const end = () => { target.removeEventListener("pointermove", move); target.removeEventListener("pointerup", end); target.removeEventListener("pointercancel", end); }; target.addEventListener("pointermove", move); target.addEventListener("pointerup", end); target.addEventListener("pointercancel", end); }
