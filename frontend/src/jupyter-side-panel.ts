import { App } from "./app";
import { copyTextToClipboard } from "./clipboard";
import { CodePreview, CodePreviewTheme } from "./code-preview";
import { jupyterViewModeFromUrl } from "./jupyter-bridge";
import type { JupyterViewMode } from "./jupyter-bridge";
import { generateQuriCode, QuriCodeMode } from "./quri-code-generator";
import {
  stateVectorAspectOptions,
  stateVectorDefaultAspectIndex,
  type StateVectorAspectIndex,
  type StateVectorAspectOption,
} from "./state-vector-layout";

type JupyterPane = "code" | "state-vector";
type PythonCodeTheme = CodePreviewTheme;

type JupyterLayoutDetail = {
  right: number;
  width: number;
  top: number;
  contentTop: number;
  contentHeight: number;
};

const labels = {
  code: "Python Code",
  stateVector: "State Vector",
  mode: "Mode",
  circuit: "Circuit",
  run: "Run",
  analyze: "Analyze",
  layout: "Layout",
  warnings: "Warnings",
  copy: "Copy Code",
  copied: "Copied Python Code",
  white: "White",
  black: "Black",
};

const panelDefaultWidth = 260;
const panelMinWidth = 56;
const panelEdgeReserve = 50;

/**
 * Notebookセル内で使いやすい、QURIコードと状態ベクトルの切り替えパネルを作る。
 */
export function setupJupyterSidePanel(app: App): void {
  const panel = new JupyterSidePanel(app);
  panel.mount();
}

class JupyterSidePanel {
  private readonly root = document.createElement("aside");
  private readonly resizeHandle = document.createElement("button");
  private readonly tabRow = document.createElement("div");
  private readonly body = document.createElement("div");
  private readonly tabs = new Map<JupyterPane, HTMLButtonElement>();
  private readonly modeButtons = new Map<QuriCodeMode, HTMLButtonElement>();
  private readonly aspectButtons = new Map<
    StateVectorAspectIndex,
    HTMLButtonElement
  >();
  private readonly themeButtons = new Map<PythonCodeTheme, HTMLButtonElement>();
  private readonly codePreview = new CodePreview({
    language: "python",
    theme: "light",
    className:
      "min-h-0 flex-1 w-full overflow-auto rounded-sm border border-gray-300 px-3 py-2 font-mono text-xs leading-5 transition-colors transition-shadow focus:border-purple-500 focus:ring-1 focus:ring-purple-500",
  });
  private readonly modeRow = document.createElement("div");
  private readonly stateLayoutRow = document.createElement("div");
  private readonly aspectTrigger = document.createElement("button");
  private readonly aspectMenu = document.createElement("div");
  private readonly copyBubble = document.createElement("div");
  private readonly status = document.createElement("span");
  private readonly warningBox = document.createElement("div");
  private readonly warningList = document.createElement("ul");
  private activePane: JupyterPane = "state-vector";
  private codeTheme: PythonCodeTheme = "light";
  private mode: QuriCodeMode = "circuit";
  private stateVectorAspectIndex: StateVectorAspectIndex =
    stateVectorDefaultAspectIndex(1);
  private stateVectorAspectCustomized = false;
  private viewMode: JupyterViewMode = "notebook";
  private lastRenderKey = "";
  private renderTimer: number | null = null;

  constructor(private readonly app: App) {}

  /**
   * パネルDOMを組み立て、Jupyter専用レイアウトイベントとコード更新を開始する。
   */
  mount(): void {
    this.viewMode = jupyterViewModeFromUrl();
    this.root.className =
      "fixed z-30 flex flex-col border-l border-gray-300 bg-white text-left shadow-sm pointer-events-none";
    this.root.setAttribute("aria-label", "Qni Jupyter side panel");

    const resizeHandle = this.createResizeHandle();
    const header = this.createHeader();
    const body = this.createBody();
    this.root.append(resizeHandle, header, body);
    document.body.appendChild(this.root);
    this.root.classList.toggle("hidden", this.viewMode === "circuit");
    this.applyViewModeChrome();
    this.tabRow.classList.toggle("hidden", this.app.isJupyterReadOnly);

    window.addEventListener("qni-jupyter-layout", (event) => {
      this.tabRow.classList.toggle("hidden", this.app.isJupyterReadOnly);
      if (this.app.isJupyterReadOnly && this.activePane !== "state-vector") {
        this.selectPane("state-vector");
      }
      this.applyLayout((event as CustomEvent<JupyterLayoutDetail>).detail);
    });
    window.addEventListener("qni-editor-dirty", (event) => {
      const dirty = (event as CustomEvent<{ dirty: boolean }>).detail.dirty;
      this.status.textContent = dirty
        ? "Unsaved Qni edits · run circuit = editor.commit()"
        : "Editor matches the source circuit";
      this.status.classList.toggle("font-semibold", dirty);
      this.status.classList.toggle("text-amber-700", dirty);
    });
    window.addEventListener("pointerdown", (event) => {
      if (!this.root.contains(event.target as Node)) {
        this.aspectMenu.classList.add("hidden");
        this.aspectTrigger.setAttribute("aria-expanded", "false");
      }
    });

    this.applyInitialLayout();
    this.selectPane("state-vector");
    this.render(true);
    this.renderTimer = window.setInterval(() => this.render(), 250);
  }

  /**
   * タブとモード選択を含む固定ヘッダーを作る。
   */
  private createHeader(): HTMLElement {
    const header = document.createElement("div");
    header.className =
      "pointer-events-auto shrink-0 border-b border-gray-300 bg-white px-2 py-2";

    this.tabRow.className =
      "mb-2 grid grid-cols-2 overflow-hidden rounded-sm border border-gray-300 bg-neutral-100";

    this.tabRow.append(
      this.createPaneButton("state-vector", labels.stateVector),
      this.createPaneButton("code", labels.code),
    );

    this.modeRow.className = "flex items-center gap-2";

    const modeLabel = document.createElement("span");
    modeLabel.className = "text-xs font-semibold text-neutral-600";
    modeLabel.textContent = labels.mode;

    const modeGroup = document.createElement("div");
    modeGroup.className =
      "grid flex-1 grid-cols-3 overflow-hidden rounded-sm border border-gray-300 bg-neutral-100";
    modeGroup.append(
      this.createModeButton("circuit", labels.circuit),
      this.createModeButton("run", labels.run),
      this.createModeButton("analyze", labels.analyze),
    );

    this.modeRow.append(modeLabel, modeGroup);

    this.stateLayoutRow.className = "relative flex items-center gap-2";
    const layoutLabel = document.createElement("span");
    layoutLabel.className = "text-xs font-semibold text-neutral-600";
    layoutLabel.textContent = labels.layout;
    this.stateLayoutRow.append(
      layoutLabel,
      this.createAspectTrigger(),
      this.aspectMenu,
    );

    header.append(this.tabRow, this.modeRow, this.stateLayoutRow);
    return header;
  }

  /**
   * コードプレビュー、警告、コピー操作を含む本文領域を作る。
   */
  private createBody(): HTMLElement {
    this.body.className =
      "pointer-events-auto relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden bg-neutral-50 px-3 py-3";
    this.body.setAttribute("data-jupyter-code-body", "true");

    this.warningBox.className =
      "hidden max-h-24 shrink-0 overflow-auto rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900";
    const warningTitle = document.createElement("div");
    warningTitle.className = "mb-1 font-semibold";
    warningTitle.textContent = labels.warnings;
    this.warningList.className = "list-disc space-y-1 pl-4";
    this.warningBox.append(warningTitle, this.warningList);

    this.copyBubble.className =
      "pointer-events-none absolute right-4 top-4 hidden rounded-sm border border-emerald-600 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 shadow-sm";
    this.copyBubble.textContent = labels.copied;

    const footer = document.createElement("div");
    footer.className = "flex shrink-0 items-center gap-2";

    this.status.className = "mr-auto text-xs text-neutral-500";
    this.status.setAttribute("aria-live", "polite");

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className =
      "inline-flex h-8 items-center rounded-sm border border-emerald-600 bg-emerald-500 px-3 text-sm font-semibold text-white hover:bg-emerald-600 active:bg-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500";
    copyButton.textContent = labels.copy;
    copyButton.addEventListener("click", () => this.copyCode());

    footer.append(this.status, this.createThemeToggle(), copyButton);
    this.body.append(
      this.copyBubble,
      this.codePreview.element,
      this.warningBox,
      footer,
    );
    return this.body;
  }

  /**
   * Pythonコード欄の明背景・暗背景を切り替える小さなセグメントトグルを作る。
   */
  private createThemeToggle(): HTMLElement {
    const group = document.createElement("div");
    group.className =
      "grid grid-cols-2 overflow-hidden rounded-sm border border-gray-300 bg-neutral-100";
    group.setAttribute("aria-label", "Python code color theme");

    group.append(
      this.createThemeButton("light", labels.white),
      this.createThemeButton("dark", labels.black),
    );
    this.syncThemeButtons();
    return group;
  }

  /**
   * テーマ選択ボタンを作り、選択時にコード欄の色を即時反映する。
   */
  private createThemeButton(
    theme: PythonCodeTheme,
    label: string,
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "h-8 border-r border-gray-300 px-2 text-xs font-semibold last:border-r-0 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:ring-inset";
    button.textContent = label;
    button.addEventListener("click", () => {
      this.codeTheme = theme;
      this.codePreview.setTheme(theme);
      this.syncThemeButtons();
    });
    this.themeButtons.set(theme, button);
    return button;
  }

  /**
   * 右ペインの大分類を切り替えるタブボタンを作る。
   */
  private createPaneButton(pane: JupyterPane, label: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "h-8 whitespace-nowrap border-r border-gray-300 px-2 text-sm font-semibold last:border-r-0 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:ring-inset";
    button.textContent = label;
    button.addEventListener("click", () => this.selectPane(pane));
    this.tabs.set(pane, button);
    return button;
  }

  /**
   * 右ペイン左端のドラッググリップを作り、幅変更をAppのPixiレイアウトへ伝える。
   */
  private createResizeHandle(): HTMLButtonElement {
    this.resizeHandle.type = "button";
    this.resizeHandle.className =
      "pointer-events-auto absolute left-0 top-0 z-10 h-full w-2 -translate-x-1 cursor-col-resize border-0 bg-transparent p-0 hover:bg-purple-200/60 focus:outline-none focus:ring-1 focus:ring-purple-500";
    this.resizeHandle.setAttribute("aria-label", "Resize Jupyter side panel");
    this.resizeHandle.addEventListener("pointerdown", (event) =>
      this.startResize(event),
    );
    return this.resizeHandle;
  }

  /**
   * QURIコードの出力モードを切り替える小さなボタンを作る。
   */
  private createModeButton(
    mode: QuriCodeMode,
    label: string,
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "h-7 border-r border-gray-300 px-2 text-xs font-semibold last:border-r-0 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:ring-inset";
    button.textContent = label;
    button.addEventListener("click", () => {
      this.mode = mode;
      this.render(true);
      this.syncModeButtons();
    });
    this.modeButtons.set(mode, button);
    return button;
  }

  /**
   * WebGPUのaspect選択と同じく、現在の状態ベクトル形状をミニ図形で開く。
   */
  private createAspectTrigger(): HTMLButtonElement {
    this.aspectTrigger.type = "button";
    this.aspectTrigger.className =
      "qni-state-layout-trigger flex h-7 min-w-0 flex-1 items-center justify-center gap-2 rounded-sm border border-gray-300 bg-neutral-100 px-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-200 focus:outline-none focus:ring-1 focus:ring-purple-500";
    this.aspectTrigger.setAttribute("aria-haspopup", "menu");
    this.aspectTrigger.addEventListener("click", (event) => {
      event.stopPropagation();
      this.renderAspectOptions();
      this.aspectMenu.classList.toggle("hidden");
      this.aspectTrigger.setAttribute(
        "aria-expanded",
        this.aspectMenu.classList.contains("hidden") ? "false" : "true",
      );
    });
    this.aspectMenu.className =
      "pointer-events-auto absolute left-0 right-0 top-9 z-50 hidden rounded-md border border-gray-300 bg-white p-1 shadow-lg";
    this.aspectMenu.setAttribute("role", "menu");
    this.syncAspectControls();
    return this.aspectTrigger;
  }

  private renderAspectOptions(): void {
    const options = stateVectorAspectOptions(this.currentQubitCount());
    this.aspectButtons.clear();
    this.aspectMenu.replaceChildren(
      ...options.map((option) => this.createAspectOptionButton(option)),
    );
  }

  private createAspectOptionButton(
    option: StateVectorAspectOption,
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "flex h-9 w-full items-center gap-3 rounded-sm px-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-100 focus:outline-none focus:ring-1 focus:ring-purple-500";
    button.setAttribute("role", "menuitemradio");
    button.append(
      this.createAspectThumbnail(option.cols, option.rows),
      this.createAspectDimensions(option),
    );
    button.addEventListener("click", () => {
      this.stateVectorAspectIndex = option.aspectIndex;
      this.stateVectorAspectCustomized = true;
      this.app.setJupyterStateVectorAspectIndex(option.aspectIndex);
      this.aspectMenu.classList.add("hidden");
      this.syncAspectControls();
    });
    this.aspectButtons.set(option.aspectIndex, button);
    return button;
  }

  private createAspectThumbnail(cols: number, rows: number): HTMLElement {
    const slot = document.createElement("span");
    slot.className =
      "inline-flex h-4 w-12 shrink-0 items-center justify-center";
    const thumb = document.createElement("span");
    const scale = Math.min(48 / cols, 16 / rows);
    thumb.className = "block bg-neutral-500";
    thumb.style.width = `${Math.max(1, cols * scale)}px`;
    thumb.style.height = `${Math.max(1, rows * scale)}px`;
    slot.appendChild(thumb);
    return slot;
  }

  private createAspectDimensions(option: StateVectorAspectOption): HTMLElement {
    const text = document.createElement("span");
    text.className = "tabular-nums";
    text.textContent = `${option.cols} × ${option.rows}`;
    return text;
  }

  /**
   * 表示タブを切り替え、Pixi側の状態ベクトル表示も同期する。
   */
  private selectPane(pane: JupyterPane): void {
    this.activePane = pane;
    this.app.setJupyterRightPane(pane);
    this.syncPaneButtons();
    this.modeRow.classList.toggle(
      "hidden",
      pane !== "code" || this.viewMode === "state",
    );
    this.stateLayoutRow.classList.toggle(
      "hidden",
      pane !== "state-vector" && this.viewMode !== "state",
    );
    this.syncAspectControls();

    this.body.classList.toggle(
      "hidden",
      pane !== "code" || this.viewMode === "state",
    );
    this.root.classList.toggle("bg-white", pane === "code");
    this.root.classList.toggle("bg-transparent", pane !== "code");
    this.applyViewModeChrome();
  }

  /**
   * Pixiから通知された右ペイン寸法をDOMパネルへ反映する。
   */
  private applyLayout(detail: JupyterLayoutDetail): void {
    if (this.viewMode === "state") {
      this.root.style.top = "8px";
      this.root.style.right = "8px";
      this.root.style.width = "220px";
      this.root.style.height = "auto";
      return;
    }

    this.root.style.top = `${detail.top}px`;
    this.root.style.right = `${detail.right}px`;
    this.root.style.width = `${detail.width}px`;
    this.root.style.height = `${detail.contentTop + detail.contentHeight - detail.top}px`;
  }

  private applyViewModeChrome(): void {
    if (this.viewMode !== "state") {
      return;
    }

    this.resizeHandle.classList.add("hidden");
    this.tabRow.classList.add("hidden");
    this.body.classList.add("hidden");
    this.modeRow.classList.add("hidden");
    this.stateLayoutRow.classList.remove("hidden");
    this.root.classList.remove("bg-transparent", "pointer-events-none");
    this.root.classList.add("rounded-sm", "bg-white", "pointer-events-auto");
  }

  /**
   * 初回のPixiレイアウト通知を取り逃しても、右パネルが必ず画面内へ出るようにする。
   */
  private applyInitialLayout(): void {
    const width = Math.min(
      this.panelMaxWidth(),
      Math.max(panelMinWidth, panelDefaultWidth),
    );
    this.app.setJupyterSidePanelWidth(width);
  }

  /**
   * ポインター移動量から右ペイン幅を計算し、ドラッグ終了まで継続更新する。
   */
  private startResize(event: PointerEvent): void {
    event.preventDefault();
    this.resizeHandle.setPointerCapture(event.pointerId);

    const resize = (moveEvent: PointerEvent) => {
      const requestedWidth = window.innerWidth - moveEvent.clientX;
      const width = Math.min(
        this.panelMaxWidth(),
        Math.max(panelMinWidth, requestedWidth),
      );
      this.app.setJupyterSidePanelWidth(width);
    };

    const stopResize = () => {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    };

    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
  }

  private panelMaxWidth(): number {
    return Math.max(panelMinWidth, window.innerWidth - panelEdgeReserve);
  }

  /**
   * 現在の回路からQURIコードを再生成し、変更がある場合だけプレビューを更新する。
   */
  private render(force = false): void {
    const renderKey = JSON.stringify({
      steps: this.app.circuit.serialize(),
      qubitCount: this.app.circuit.highestOccupiedQubitNumber,
      stateVectorQubitCount: this.app.stateVector.qubitCount,
      mode: this.mode,
    });
    if (!force && renderKey === this.lastRenderKey) {
      return;
    }
    this.lastRenderKey = renderKey;

    const result = generateQuriCode(
      this.app.circuit.serialize(),
      this.app.circuit.highestOccupiedQubitNumber,
      { mode: this.mode },
    );
    this.codePreview.setCode(result.code, "python");
    this.renderWarnings(result.warnings);
    this.syncModeButtons();
    this.syncAspectControls();
  }

  /**
   * 生成コードの警告を、コード欄の下に短く表示する。
   */
  private renderWarnings(warnings: string[]): void {
    this.warningList.replaceChildren(
      ...warnings.map((warning) => {
        const item = document.createElement("li");
        item.textContent = warning;
        return item;
      }),
    );
    this.warningBox.classList.toggle("hidden", warnings.length === 0);
  }

  /**
   * 現在表示しているPythonコードをクリップボードへコピーする。
   */
  private async copyCode(): Promise<void> {
    const code = this.codePreview.getCode();
    if (await copyTextToClipboard(code)) {
      this.showCopiedFeedback(labels.copied);
      return;
    }

    this.codePreview.selectAll();
    this.showCopiedFeedback("Copy failed; selected Python Code");
  }

  /**
   * コピー対象だったコード欄を短く強調し、右上に結果の吹き出しを表示する。
   */
  private showCopiedFeedback(message: string): void {
    this.status.textContent = message;
    this.copyBubble.textContent = message;
    this.copyBubble.classList.remove("hidden");
    this.codePreview.element.classList.add("ring-2", "ring-emerald-400");

    window.setTimeout(() => {
      this.copyBubble.classList.add("hidden");
      this.codePreview.element.classList.remove("ring-2", "ring-emerald-400");
    }, 1800);
  }

  /**
   * 表示中ペインのタブボタンだけを選択状態にする。
   */
  private syncPaneButtons(): void {
    this.tabs.forEach((button, pane) => {
      this.setSelected(button, pane === this.activePane);
    });
  }

  /**
   * QURIコード出力モードのボタン表示を現在値に合わせる。
   */
  private syncModeButtons(): void {
    this.modeButtons.forEach((button, mode) => {
      this.setSelected(button, mode === this.mode);
    });
  }

  private syncAspectControls(): void {
    const option = this.currentAspectOption();
    this.aspectTrigger.replaceChildren(
      this.createAspectThumbnail(option.cols, option.rows),
      this.createAspectDimensions(option),
    );
    this.aspectTrigger.setAttribute(
      "aria-label",
      `State vector shape ${option.cols} by ${option.rows}`,
    );
    this.aspectTrigger.setAttribute("aria-expanded", "false");
    this.aspectButtons.forEach((button, aspectIndex) => {
      const selected = aspectIndex === this.stateVectorAspectIndex;
      button.classList.toggle("bg-purple-100", selected);
      button.classList.toggle("text-purple-900", selected);
      button.setAttribute("aria-checked", selected ? "true" : "false");
    });
  }

  private currentAspectOption(): StateVectorAspectOption {
    const qubitCount = this.currentQubitCount();
    if (!this.stateVectorAspectCustomized) {
      this.stateVectorAspectIndex = stateVectorDefaultAspectIndex(qubitCount);
    }
    this.stateVectorAspectIndex = Math.min(
      qubitCount,
      Math.max(0, Math.round(this.stateVectorAspectIndex)),
    );
    return {
      aspectIndex: this.stateVectorAspectIndex,
      cols: Math.pow(2, this.stateVectorAspectIndex),
      rows: Math.pow(2, qubitCount - this.stateVectorAspectIndex),
    };
  }

  private currentQubitCount(): number {
    return Math.max(1, Math.min(16, this.app.stateVector.qubitCount));
  }

  /**
   * コードテーマ切替ボタンの選択状態を現在のテーマへ合わせる。
   */
  private syncThemeButtons(): void {
    this.themeButtons.forEach((button, theme) => {
      this.setSelected(button, theme === this.codeTheme);
    });
  }

  /**
   * セグメントボタンの選択状態をTailwind classとARIAへ反映する。
   */
  private setSelected(button: HTMLButtonElement, selected: boolean): void {
    button.classList.toggle("bg-purple-100", selected);
    button.classList.toggle("text-purple-900", selected);
    button.classList.toggle("bg-neutral-100", !selected);
    button.classList.toggle("text-neutral-800", !selected);
    button.classList.toggle("hover:bg-neutral-200", !selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  }
}
