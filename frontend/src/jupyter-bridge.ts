import { App } from "./app";
import { SerializedOperation } from "./types";
import { generateQuriCode } from "./quri-code-generator";

type JupyterInitialState = {
  steps?: SerializedOperation[][];
  qubit_count?: number;
  title?: string;
  view?: JupyterViewMode;
  active_step_index?: number;
  editable?: boolean;
  draft_id?: string;
  backendUrl?: string;
};

type CircuitJson = {
  cols: (string | null)[][];
  qubitCount: number;
  title?: string;
  activeStepIndex?: number;
  editable?: boolean;
};

export type JupyterViewMode = "notebook" | "state" | "circuit";

/**
 * Jupyter用URLに含まれる初期状態を読み取り、QniGPUの既存回路JSONへ変換して読み込む。
 */
export function loadJupyterInitialState(app: App): void {
  setupNotebookScrollBridge(app);
  setupNotebookResizeBridge(app);

  const state = parseInitialStateFromUrl();
  if (!state) {
    return;
  }

  app.setJupyterViewMode(state.view ?? "notebook");
  app.loadCircuitJson({
    ...toCircuitJson(state),
    editable: state.editable,
  });
  setupEditorDraftSync(app, state);
}

function setupEditorDraftSync(app: App, state: JupyterInitialState): void {
  if (!state.editable || !state.draft_id || !state.backendUrl) {
    return;
  }

  const endpoint = new URL(
    `/editor-drafts/${encodeURIComponent(state.draft_id)}`,
    state.backendUrl,
  ).toString();
  const initialKey = JSON.stringify({
    steps: state.steps ?? [],
    qubit_count: state.qubit_count ?? 1,
  });
  let lastSavedKey = "";
  let dirty = false;

  window.addEventListener("beforeunload", (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  const save = async () => {
    const steps = withoutTrailingEmptySteps(app.circuit.serialize());
    const qubitCount = app.stateVector.qubitCount;
    const key = JSON.stringify({ steps, qubit_count: qubitCount });
    if (key === lastSavedKey) {
      return;
    }
    lastSavedKey = key;
    dirty = key !== initialKey;
    const generated = generateQuriCode(steps, qubitCount);
    window.dispatchEvent(
      new CustomEvent("qni-editor-dirty", { detail: { dirty } }),
    );
    try {
      await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steps,
          qubit_count: qubitCount,
          code: generated.code,
          warnings: generated.warnings,
          dirty,
        }),
      });
    } catch {
      lastSavedKey = "";
    }
  };

  void save();
  window.setInterval(() => void save(), 250);
}

function withoutTrailingEmptySteps(
  serializedSteps: SerializedOperation[][],
): SerializedOperation[][] {
  const steps = [...serializedSteps];
  while (steps.length > 0 && steps.at(-1)?.length === 0) {
    steps.pop();
  }
  return steps;
}

function setupNotebookResizeBridge(app: App): void {
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) {
      return;
    }
    const data = event.data ?? {};
    if (
      data.source === "qni-notebook" &&
      data.type === "qni:set-height"
    ) {
      app.setJupyterViewportHeight(Number(data.height));
    }
  });
}

/**
 * iframe内のwheel操作を親Notebookへ渡し、Qni上でもNotebook全体をスクロールできるようにする。
 */
function setupNotebookScrollBridge(app: App): void {
  window.addEventListener(
    "wheel",
    (event) => {
      const viewMode = jupyterViewModeFromUrl();
      if (viewMode === "state" || viewMode === "circuit") {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        return;
      }

      if (app.shouldConsumeJupyterWheel(event.clientX)) {
        event.preventDefault();
        return;
      }

      window.parent.postMessage(
        {
          source: "qni-gl",
          type: "qni:wheel",
          deltaX: event.deltaX,
          deltaY: event.deltaY,
        },
        "*",
      );
    },
    { passive: false },
  );
}

/**
 * Python側がURLに入れたJSON stateを、安全にパースして返す。
 */
function parseInitialStateFromUrl(): JupyterInitialState | null {
  const rawState = new URLSearchParams(window.location.search).get("state");
  if (!rawState) {
    return null;
  }

  const parsed = JSON.parse(rawState) as JupyterInitialState;
  if (parsed.steps !== undefined && !Array.isArray(parsed.steps)) {
    throw new Error("Jupyter initial state steps must be an array.");
  }
  if (
    parsed.view !== undefined &&
    parsed.view !== "notebook" &&
    parsed.view !== "state" &&
    parsed.view !== "circuit"
  ) {
    throw new Error("Jupyter initial state view is invalid.");
  }
  if (
    parsed.active_step_index !== undefined &&
    (!Number.isInteger(parsed.active_step_index) || parsed.active_step_index < 0)
  ) {
    throw new Error("Jupyter initial state active_step_index is invalid.");
  }

  return parsed;
}

export function jupyterViewModeFromUrl(): JupyterViewMode {
  const rawState = new URLSearchParams(window.location.search).get("state");
  if (!rawState) {
    return "notebook";
  }

  try {
    const parsed = JSON.parse(rawState) as Pick<JupyterInitialState, "view">;
    return parsed.view === "state" || parsed.view === "circuit"
      ? parsed.view
      : "notebook";
  } catch {
    return "notebook";
  }
}

/**
 * QniGPU stepsを、既存のCircuit.fromJSONが読めるcols形式へ変換する。
 */
export function toCircuitJson(state: JupyterInitialState): CircuitJson {
  const steps = state.steps ?? [];
  const qubitCount = requiredQubitCount(steps, state.qubit_count);
  const cols =
    steps.length === 0
      ? [emptyColumn(qubitCount)]
      : steps.map((step) => stepToColumn(step, qubitCount));

  return {
    cols,
    qubitCount,
    ...(state.title ? { title: state.title } : {}),
    ...(state.active_step_index !== undefined
      ? { activeStepIndex: state.active_step_index }
      : {}),
    ...(state.editable !== undefined ? { editable: state.editable } : {}),
  };
}

/**
 * 明示qubit_countとsteps内の最大target/controlから、表示に必要な量子ビット数を決める。
 */
function requiredQubitCount(
  steps: SerializedOperation[][],
  explicitQubitCount?: number,
): number {
  const maxQubitIndex = steps.reduce((maxIndex, step) => {
    return Math.max(
      maxIndex,
      ...step.flatMap((operation) => [
        ...operation.targets,
        ...(operation.controls ?? []),
        ...(operation.antiControls ?? []),
      ]),
    );
  }, -1);

  return Math.max(1, explicitQubitCount ?? 0, maxQubitIndex + 1);
}

/**
 * 1ステップ内の操作を、制御点やSWAPも含めて1列のラベル配列へ展開する。
 */
function stepToColumn(
  step: SerializedOperation[],
  qubitCount: number,
): (string | null)[] {
  const column = emptyColumn(qubitCount);

  for (const operation of step) {
    for (const control of operation.controls ?? []) {
      column[control] = "•";
    }
    for (const antiControl of operation.antiControls ?? []) {
      column[antiControl] = "◦";
    }
    for (const target of operation.targets) {
      column[target] = labelForOperation(operation);
    }
  }

  return column;
}

/**
 * 既存のURL/JSON復元で使われているゲートラベルへ、SerializedOperationを対応させる。
 */
function labelForOperation(operation: SerializedOperation): string {
  if (operation.type === "QFT" || operation.type === "QFT†") {
    const span = operation.span ?? operation.targets.length;
    return span > 1 ? `${operation.type}${span}` : operation.type;
  }

  return operation.type;
}

function emptyColumn(qubitCount: number): null[] {
  return Array.from({ length: qubitCount }, () => null);
}
