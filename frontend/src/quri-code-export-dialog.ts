import {
  generateQuriCode,
  generateQuriNotebook,
  QuriCodeMode,
} from "./quri-code-generator";
import { copyTextToClipboard } from "./clipboard";
import { SerializedOperation } from "./types";
import tippy from "tippy.js";
import { CodePreview, CodePreviewLanguage } from "./code-preview";

export interface QuriCodeExportDialogOptions {
  buttonId: string;
  getSteps: () => SerializedOperation[][];
  getQubitCount: () => number;
  enableNotebookCell?: boolean;
}

type DialogState = {
  mode: QuriCodeMode;
};

type ResizeDirection = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";
type Locale = "en" | "ja";
type ButtonLabelMap<T extends string> = Record<T, string>;

const initialLocale: Locale = navigator.language.startsWith("ja") ? "ja" : "en";

const i18n = {
  en: {
    title: "QURI Code Export",
    close: "Close",
    mode: "Mode",
    circuit: "Circuit",
    run: "Run",
    analyze: "Analyze",
    warnings: "Warnings",
    copy: "Copy",
    copyCode: "Copy Code",
    copied: "Copied to clipboard",
    download: "Download",
    downloadNotebook: "Download .ipynb",
    downloadStarted: "Download started",
    addCell: "Output to Notebook",
    cellSent: "Sent to notebook",
    cellUnavailable: "Shown below the Qni cell and copied",
    resize: "Resize QURI export window",
    circuitMode: "Mode: Circuit only.",
    runMode: "Mode: Run with QURI VM sampling.",
    analyzeMode: "Mode: Analyze with QURI VM sampling and analysis.",
    notebookPreview:
      "Preview and Copy: code in the Notebook cell. Download: Jupyter Notebook (.ipynb).",
  },
  ja: {
    title: "QURIコード出力",
    close: "閉じる",
    mode: "モード",
    circuit: "回路",
    run: "実行",
    analyze: "解析",
    warnings: "注意",
    copy: "コピー",
    copyCode: "Codeをコピー",
    copied: "クリップボードにコピーしました",
    download: "ダウンロード",
    downloadNotebook: ".ipynbをダウンロード",
    downloadStarted: "ダウンロードを開始しました",
    addCell: "セルへ出力",
    cellSent: "Notebookへ送信しました",
    cellUnavailable: "Qniセル下へ出力し、コードをコピーしました",
    resize: "QURI出力ウィンドウのサイズ変更",
    circuitMode: "モード: 回路コードのみ。",
    runMode: "モード: QURI VMでサンプリング実行。",
    analyzeMode: "モード: QURI VMでサンプリングと解析を実行。",
    notebookPreview:
      "表示とコピー: Notebookセル内のコード。ダウンロード: Jupyter Notebook (.ipynb)。",
  },
} as const;

type Translation = (typeof i18n)[Locale];

/**
 * QURIコード出力ボタンに、コード確認・コピー・ダウンロード用ダイアログを接続する。
 */
export function setupQuriCodeExportDialog(
  options: QuriCodeExportDialogOptions,
): void {
  const button = document.getElementById(options.buttonId);
  if (!button) {
    throw new Error(`Could not find #${options.buttonId}`);
  }

  const dialog = new QuriCodeExportDialog(options);
  button.addEventListener("click", () => dialog.open());
}

class QuriCodeExportDialog {
  private static readonly TOOLTIP_DURATION_MS = 1000;
  private static readonly TIPPY_HIDE_ANIMATION_MS = 250;
  private static readonly LIVE_UPDATE_INTERVAL_MS = 250;
  private static readonly MIN_PANEL_WIDTH = 520;
  private static readonly MIN_PANEL_HEIGHT = 420;

  private readonly state: DialogState = { mode: "circuit" };
  private locale: Locale = initialLocale;
  private readonly root: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly localeToggle: HTMLButtonElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly codePreview: CodePreview;
  private readonly modeLabel: HTMLDivElement;
  private readonly warningTitle: HTMLDivElement;
  private readonly warningsList: HTMLUListElement;
  private readonly statusText: HTMLSpanElement;
  private readonly previewMetaText: HTMLDivElement;
  private readonly copyButton: HTMLButtonElement;
  private readonly downloadButton: HTMLButtonElement;
  private readonly addCellButton: HTMLButtonElement;
  private readonly modeButtons = new Map<QuriCodeMode, HTMLButtonElement>();
  private readonly resizeHandles: HTMLButtonElement[];
  private statusTimer: number | null = null;
  private liveUpdateTimer: number | null = null;
  private lastRenderKey = "";

  private get text() {
    return i18n[this.locale];
  }

  /**
   * ダイアログDOMを一度だけ作り、以後は現在の回路からコードを再生成して表示する。
   */
  constructor(private readonly options: QuriCodeExportDialogOptions) {
    this.root = document.createElement("div");
    this.root.className =
      "fixed z-[45] flex flex-col overflow-hidden rounded-lg border border-gray-300 bg-white text-left";
    this.root.style.display = "none";
    this.root.style.top = "72px";
    this.root.style.right = "32px";
    this.root.style.width = "760px";
    this.root.style.height = "620px";
    this.root.style.minWidth = `${QuriCodeExportDialog.MIN_PANEL_WIDTH}px`;
    this.root.style.minHeight = `${QuriCodeExportDialog.MIN_PANEL_HEIGHT}px`;
    this.root.setAttribute("role", "region");
    this.root.setAttribute("aria-labelledby", "quri-export-dialog-title");

    const header = this.createHeader();
    const controls = this.createControls();
    const body = this.createBody();
    const footer = this.createFooter();
    const resizeHandles = this.createResizeHandles();

    this.root.append(header, controls, body, footer, ...resizeHandles);
    document.body.appendChild(this.root);

    this.title = header.querySelector(
      "#quri-export-dialog-title",
    ) as HTMLHeadingElement;
    this.localeToggle = header.querySelector(
      "[data-quri-locale-toggle]",
    ) as HTMLButtonElement;
    this.closeButton = header.querySelector(
      "[data-quri-close]",
    ) as HTMLButtonElement;
    this.codePreview = this.createCodePreview();
    body.prepend(this.codePreview.element);
    this.modeLabel = controls.querySelector(
      "[data-quri-label='mode']",
    ) as HTMLDivElement;
    this.previewMetaText = body.querySelector(
      "[data-quri-preview-meta]",
    ) as HTMLDivElement;
    this.warningTitle = body.querySelector(
      "[data-quri-warning-title]",
    ) as HTMLDivElement;
    this.warningsList = body.querySelector("ul") as HTMLUListElement;
    this.statusText = footer.querySelector(
      "[data-quri-export-status]",
    ) as HTMLSpanElement;
    this.copyButton = footer.querySelector(
      "[data-quri-copy]",
    ) as HTMLButtonElement;
    this.downloadButton = footer.querySelector(
      "[data-quri-download]",
    ) as HTMLButtonElement;
    this.addCellButton = footer.querySelector(
      "[data-quri-add-cell]",
    ) as HTMLButtonElement;
    this.resizeHandles = resizeHandles;
    this.updateLocaleText();
  }

  /**
   * 最新の回路からコードを生成し、ダイアログを表示する。
   */
  open(): void {
    this.render(true);
    this.root.style.display = "flex";
    this.startLiveUpdate();
    this.codePreview.element.focus();
  }

  /**
   * ダイアログを閉じる。
   */
  private close(): void {
    this.root.style.display = "none";
    this.stopLiveUpdate();
  }

  /**
   * ヘッダー領域を作る。
   */
  private createHeader(): HTMLElement {
    const header = document.createElement("div");
    header.className =
      "flex shrink-0 cursor-move select-none items-center justify-between bg-white px-4 py-3";
    header.addEventListener("pointerdown", (event) => this.startDrag(event));

    const title = document.createElement("h2");
    title.id = "quri-export-dialog-title";
    title.className = "text-lg font-medium text-gray-900";
    title.textContent = this.text.title;

    const closeButtonContainer = document.createElement("div");
    closeButtonContainer.className = "flex items-center gap-2";

    const localeToggle = this.createLocaleToggle();

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className =
      "rounded-md bg-white text-gray-400 hover:text-gray-900 active:text-purple-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:ring-offset-1";
    closeButton.setAttribute("data-quri-close", "true");
    closeButton.setAttribute("aria-label", this.text.close);
    closeButton.innerHTML = `
      <span class="sr-only">${this.text.close}</span>
      <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    `;
    closeButton.addEventListener("pointerdown", (event) =>
      event.stopPropagation(),
    );
    closeButton.addEventListener("click", () => this.close());

    closeButtonContainer.append(localeToggle, closeButton);
    header.append(title, closeButtonContainer);
    return header;
  }

  /**
   * モードと出力形式の切り替えボタンを作る。
   */
  private createControls(): HTMLElement {
    const controls = document.createElement("div");
    controls.className =
      "grid shrink-0 gap-3 border-b border-neutral-200 bg-white px-4 py-3";

    const modeGroup = this.createButtonGroup<QuriCodeMode>(
      "mode",
      this.text.mode,
      [
        ["circuit", this.text.circuit],
        ["run", this.text.run],
        ["analyze", this.text.analyze],
      ],
      this.modeButtons,
      (mode) => {
        this.state.mode = mode;
        this.render();
      },
    );

    controls.append(modeGroup);
    return controls;
  }

  /**
   * コード表示欄と警告欄を作る。
   */
  private createBody(): HTMLElement {
    const body = document.createElement("div");
    body.className =
      "flex min-h-0 flex-1 flex-col gap-3 overflow-hidden bg-neutral-50 px-4 py-3";

    const previewMeta = document.createElement("div");
    previewMeta.className =
      "shrink-0 rounded-sm border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700";
    previewMeta.setAttribute("data-quri-preview-meta", "true");

    const warningBox = document.createElement("div");
    warningBox.className =
      "hidden max-h-28 shrink-0 overflow-auto rounded-md border border-amber-300 bg-amber-50 py-2 px-3 text-sm text-amber-900";
    warningBox.setAttribute("data-quri-warning-box", "true");

    const warningTitle = document.createElement("div");
    warningTitle.className = "mb-1 font-semibold";
    warningTitle.setAttribute("data-quri-warning-title", "true");
    warningTitle.textContent = this.text.warnings;

    const warningList = document.createElement("ul");
    warningList.className = "list-disc space-y-1 pl-5";

    warningBox.append(warningTitle, warningList);
    body.append(previewMeta, warningBox);
    return body;
  }

  /**
   * コードのスクロールと色分けを担当する共通プレビュー部品を作る。
   */
  private createCodePreview(): CodePreview {
    return new CodePreview({
      language: this.currentPreviewLanguage(),
      className:
        "min-h-0 flex-1 w-full overflow-auto rounded-sm border border-gray-300 bg-slate-50 py-2 px-3 font-mono text-sm leading-5 text-gray-950 focus:border-purple-500 focus:ring-1 focus:ring-purple-500",
    });
  }

  /**
   * コピーとダウンロード操作を置くフッターを作る。
   */
  private createFooter(): HTMLElement {
    const footer = document.createElement("div");
    footer.className =
      "flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-neutral-300 bg-white px-4 py-3";

    const status = document.createElement("span");
    status.className = "mr-auto text-sm text-neutral-500";
    status.setAttribute("data-quri-export-status", "true");
    status.setAttribute("aria-live", "polite");
    status.textContent = "";

    const copyButton = this.createActionButton(this.text.copy, () =>
      this.copyCode(),
    );
    copyButton.setAttribute("data-quri-copy", "true");
    const copyTip = tippy(copyButton, {
      content: this.text.copied,
      trigger: "manual",
      placement: "bottom",
      duration: [0, QuriCodeExportDialog.TIPPY_HIDE_ANIMATION_MS],
    });
    copyButton.addEventListener("click", () => {
      copyTip.setContent(this.text.copied);
      copyTip.show();
      setTimeout(
        () => copyTip.hide(),
        QuriCodeExportDialog.TOOLTIP_DURATION_MS,
      );
    });

    const downloadButton = this.createActionButton(this.text.download, () =>
      this.downloadCurrentCode(),
    );
    downloadButton.setAttribute("data-quri-download", "true");
    const downloadTip = tippy(downloadButton, {
      content: this.text.downloadStarted,
      trigger: "manual",
      placement: "bottom",
      duration: [0, QuriCodeExportDialog.TIPPY_HIDE_ANIMATION_MS],
    });
    downloadButton.addEventListener("click", () => {
      downloadTip.setContent(this.text.downloadStarted);
      downloadTip.show();
      setTimeout(
        () => downloadTip.hide(),
        QuriCodeExportDialog.TOOLTIP_DURATION_MS,
      );
    });

    const addCellButton = this.createActionButton(this.text.addCell, () =>
      this.addNotebookCell(),
    );
    addCellButton.setAttribute("data-quri-add-cell", "true");
    addCellButton.classList.toggle("hidden", !this.options.enableNotebookCell);

    footer.append(status, copyButton, downloadButton, addCellButton);
    return footer;
  }

  /**
   * セグメント風のボタングループを作る。
   */
  private createButtonGroup<T extends string>(
    labelKey: string,
    labelText: string,
    entries: Array<[T, string]>,
    registry: Map<T, HTMLButtonElement>,
    onSelect: (value: T) => void,
  ): HTMLElement {
    const field = document.createElement("div");

    const label = document.createElement("div");
    label.className = "mb-1 block text-sm font-semibold text-neutral-700";
    label.setAttribute("data-quri-label", labelKey);
    label.textContent = labelText;

    const group = document.createElement("div");
    group.className =
      "inline-flex w-full overflow-hidden rounded-sm border border-gray-300 bg-neutral-100";

    for (const [value, buttonLabel] of entries) {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "flex-1 border-r border-gray-300 bg-neutral-100 py-2 px-3 text-sm font-semibold text-neutral-800 last:border-r-0 active:bg-purple-500 active:text-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:ring-inset";
      button.textContent = buttonLabel;
      button.addEventListener("click", () => onSelect(value));
      registry.set(value, button);
      group.appendChild(button);
    }

    field.append(label, group);
    return field;
  }

  /**
   * フッターで使う操作ボタンを作る。
   */
  private createActionButton(
    label: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "inline-flex h-8 items-center justify-center rounded-sm border border-gray-300 bg-neutral-100 px-3 text-sm font-semibold text-neutral-800 hover:border-purple-500 hover:bg-neutral-200 active:border-purple-700 active:bg-purple-500 active:text-white focus:outline-none focus:ring-1 focus:ring-purple-500";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  /**
   * 表示言語をその場で切り替えるボタンを作る。
   */
  private createLocaleToggle(): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("data-quri-locale-toggle", "true");
    button.className =
      "inline-flex h-7 items-center justify-center rounded-sm border border-gray-300 bg-white px-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 active:bg-purple-500 active:text-white focus:outline-none focus:ring-1 focus:ring-purple-500";
    button.addEventListener("pointerdown", (event) =>
      event.stopPropagation(),
    );
    button.addEventListener("click", () => {
      this.locale = this.locale === "ja" ? "en" : "ja";
      this.updateLocaleText();
    });
    return button;
  }

  /**
   * 選択中モードに応じたコードと警告を再描画する。
   */
  private render(force = false): void {
    const renderKey = this.currentRenderKey();
    if (!force && renderKey === this.lastRenderKey) {
      return;
    }
    this.lastRenderKey = renderKey;

    const result = this.currentPreviewResult();
    this.codePreview.setCode(result.code, this.currentPreviewLanguage());
    this.clearStatus();
    this.updatePreviewMeta();
    this.renderWarnings(result.warnings);
    this.syncButtonStates();
    this.syncActionLabels();
  }

  /**
   * 画面表示とコピー用には、Notebook選択時も人が読むPythonコードを生成する。
   */
  private currentPreviewResult() {
    const steps = this.options.getSteps();
    const qubitCount = this.options.getQubitCount();
    const generationOptions = { mode: this.state.mode, shots: 1000 };

    return generateQuriCode(steps, qubitCount, generationOptions);
  }

  /**
   * ダウンロード用のNotebook JSONを生成する。
   */
  private currentNotebookResult() {
    const steps = this.options.getSteps();
    const qubitCount = this.options.getQubitCount();
    const generationOptions = { mode: this.state.mode, shots: 1000 };

    return generateQuriNotebook(steps, qubitCount, generationOptions);
  }

  /**
   * 現在の回路・出力モードを表す差分検出用キーを作る。
   */
  private currentRenderKey(): string {
    return JSON.stringify({
      steps: this.options.getSteps(),
      qubitCount: this.options.getQubitCount(),
      mode: this.state.mode,
    });
  }

  /**
   * 現在の出力形式に合うハイライト言語を返す。
   */
  private currentPreviewLanguage(): CodePreviewLanguage {
    return "python";
  }

  /**
   * 生成コードに含まれる警告を表示する。
   */
  private renderWarnings(warnings: string[]): void {
    const warningBox = this.warningsList.parentElement;
    if (!warningBox) {
      return;
    }

    this.warningsList.replaceChildren(
      ...warnings.map((warning) => {
        const item = document.createElement("li");
        item.textContent = warning;
        return item;
      }),
    );

    warningBox.classList.toggle("hidden", warnings.length === 0);
  }

  /**
   * モードボタンの選択状態を同期する。
   */
  private syncButtonStates(): void {
    this.modeButtons.forEach((button, mode) => {
      this.setSelectedButton(button, mode === this.state.mode);
    });
  }

  /**
   * 選択中ボタンの見た目を切り替える。
   */
  private setSelectedButton(button: HTMLButtonElement, selected: boolean): void {
    button.classList.toggle("bg-purple-100", selected);
    button.classList.toggle("text-purple-900", selected);
    button.classList.toggle("hover:bg-purple-200", selected);
    button.classList.toggle("ring-1", selected);
    button.classList.toggle("ring-inset", selected);
    button.classList.toggle("ring-purple-400", selected);
    button.classList.toggle("bg-neutral-100", !selected);
    button.classList.toggle("text-neutral-800", !selected);
    button.classList.toggle("hover:bg-neutral-200", !selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  }

  /**
   * 操作ボタンの表示文言を現在の言語に合わせる。
   */
  private syncActionLabels(): void {
    this.copyButton.textContent = this.text.copyCode;
    this.downloadButton.textContent = this.text.downloadNotebook;
    this.addCellButton.textContent = this.text.addCell;
  }

  /**
   * 現在の言語に合わせて、既存DOMの表示文言を更新する。
   */
  private updateLocaleText(): void {
    this.title.textContent = this.text.title;
    this.localeToggle.textContent = this.locale === "ja" ? "EN" : "日本語";
    this.localeToggle.setAttribute(
      "aria-label",
      this.locale === "ja" ? "Switch to English" : "日本語に切り替え",
    );
    this.closeButton.setAttribute("aria-label", this.text.close);
    const closeText = this.closeButton.querySelector(".sr-only");
    if (closeText) {
      closeText.textContent = this.text.close;
    }
    this.modeLabel.textContent = this.text.mode;
    this.warningTitle.textContent = this.text.warnings;
    this.updateButtonLabels(this.modeButtons, {
      circuit: this.text.circuit,
      run: this.text.run,
      analyze: this.text.analyze,
    });
    this.resizeHandles.forEach((handle) => {
      const direction = handle.dataset.resizeDirection;
      handle.setAttribute("aria-label", `${this.text.resize} ${direction}`);
    });
    this.syncActionLabels();
    this.updatePreviewMeta();
    this.clearStatus();
  }

  /**
   * セグメントボタンの表示名をまとめて更新する。
   */
  private updateButtonLabels<T extends string>(
    buttons: Map<T, HTMLButtonElement>,
    labels: ButtonLabelMap<T>,
  ): void {
    buttons.forEach((button, key) => {
      button.textContent = labels[key];
    });
  }

  /**
   * 画面表示と保存形式の違いを、利用者が見失わないよう短く表示する。
   */
  private updatePreviewMeta(): void {
    const modeText = modeDescription(this.state.mode, this.text);
    const formatText = this.text.notebookPreview;

    this.previewMetaText.textContent = `${modeText} ${formatText}`;
  }

  /**
   * 現在表示しているコードをクリップボードへコピーする。
   */
  private async copyCode(): Promise<void> {
    if (await copyTextToClipboard(this.codePreview.getCode())) {
      this.setStatus(`${this.text.copied}.`, true);
      return;
    }

    this.codePreview.selectAll();
    this.setStatus("Copy failed; selected code.", false);
  }

  /**
   * 現在表示しているコードをファイルとして保存する。
   */
  private downloadCurrentCode(): void {
    const filename = `qni_circuit_quri_${this.state.mode}.ipynb`;
    downloadTextFile(
      filename,
      this.currentNotebookResult().code,
      "application/x-ipynb+json",
    );
    this.setStatus(`${this.text.downloadStarted}: ${filename}`, true);
  }

  /**
   * Jupyter表示時に、親Notebookへ現在のQURIコードをセルとして追加するよう依頼する。
   */
  private async addNotebookCell(): Promise<void> {
    const code = this.codePreview.getCode();
    const requestId = crypto.randomUUID();

    const acknowledged = new Promise<boolean>((resolve) => {
      const timeoutId = window.setTimeout(() => {
        window.removeEventListener("message", onMessage);
        resolve(false);
      }, 800);

      const onMessage = (event: MessageEvent) => {
        if (
          event.data?.source !== "qni-jupyter" ||
          event.data?.type !== "qni:quri-cell-added" ||
          event.data?.requestId !== requestId
        ) {
          return;
        }

        window.clearTimeout(timeoutId);
        window.removeEventListener("message", onMessage);
        resolve(event.data.ok === true);
      };

      window.addEventListener("message", onMessage);
    });

    window.parent.postMessage(
      {
        source: "qni-gl",
        type: "qni:add-quri-cell",
        requestId,
        mode: this.state.mode,
        code,
      },
      "*",
    );

    if (await acknowledged) {
      this.setStatus(`${this.text.cellSent}.`, true);
      return;
    }

    await this.copyCode();
    this.setStatus(`${this.text.cellUnavailable}.`, true);
  }

  /**
   * 操作結果や補足文をフッターに表示する。
   */
  private setStatus(message: string, temporary: boolean): void {
    if (this.statusTimer !== null) {
      window.clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }

    this.statusText.textContent = message;

    if (temporary) {
      this.statusTimer = window.setTimeout(() => {
        this.statusText.textContent = "";
        this.statusTimer = null;
      }, QuriCodeExportDialog.TOOLTIP_DURATION_MS);
    }
  }

  /**
   * 回路編集による再描画では、操作結果メッセージを残さない。
   */
  private clearStatus(): void {
    if (this.statusTimer !== null) {
      window.clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
    this.statusText.textContent = "";
  }

  /**
   * 開いている間だけ、回路編集に追従してコードを更新する。
   */
  private startLiveUpdate(): void {
    if (this.liveUpdateTimer !== null) {
      return;
    }

    this.liveUpdateTimer = window.setInterval(() => {
      if (this.root.style.display !== "none") {
        this.render();
      }
    }, QuriCodeExportDialog.LIVE_UPDATE_INTERVAL_MS);
  }

  /**
   * 非表示中は差分監視を止める。
   */
  private stopLiveUpdate(): void {
    if (this.liveUpdateTimer !== null) {
      window.clearInterval(this.liveUpdateTimer);
      this.liveUpdateTimer = null;
    }
  }

  /**
   * パネルのドラッグ移動を開始する。
   */
  private startDrag(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    const rect = this.root.getBoundingClientRect();
    const dragTarget = event.currentTarget as HTMLElement;
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const pointerId = event.pointerId;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const x = clamp(
        moveEvent.clientX - offsetX,
        0,
        window.innerWidth - this.root.offsetWidth,
      );
      const y = clamp(
        moveEvent.clientY - offsetY,
        0,
        window.innerHeight - this.root.offsetHeight,
      );
      this.root.style.left = `${x}px`;
      this.root.style.top = `${y}px`;
      this.root.style.right = "auto";
    };

    const onPointerUp = () => {
      dragTarget.releasePointerCapture(pointerId);
      dragTarget.removeEventListener("pointermove", onPointerMove);
      dragTarget.removeEventListener("pointerup", onPointerUp);
      dragTarget.removeEventListener("pointercancel", onPointerUp);
    };

    dragTarget.setPointerCapture(pointerId);
    dragTarget.addEventListener("pointermove", onPointerMove);
    dragTarget.addEventListener("pointerup", onPointerUp);
    dragTarget.addEventListener("pointercancel", onPointerUp);
  }

  /**
   * パネルのリサイズを開始する。
   */
  private startResize(event: PointerEvent, direction: ResizeDirection): void {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = this.root.offsetWidth;
    const startHeight = this.root.offsetHeight;
    const startRect = this.root.getBoundingClientRect();
    const startLeft = startRect.left;
    const startTop = startRect.top;
    const pointerId = event.pointerId;
    const resizeTarget = event.currentTarget as HTMLElement;

    const onPointerMove = (moveEvent: PointerEvent) => {
      this.applyResize(
        moveEvent,
        startX,
        startY,
        startLeft,
        startTop,
        startWidth,
        startHeight,
        direction,
      );
    };

    const onPointerUp = () => {
      resizeTarget.releasePointerCapture(pointerId);
      resizeTarget.removeEventListener("pointermove", onPointerMove);
      resizeTarget.removeEventListener("pointerup", onPointerUp);
      resizeTarget.removeEventListener("pointercancel", onPointerUp);
    };

    resizeTarget.setPointerCapture(pointerId);
    resizeTarget.addEventListener("pointermove", onPointerMove);
    resizeTarget.addEventListener("pointerup", onPointerUp);
    resizeTarget.addEventListener("pointercancel", onPointerUp);
  }

  /**
   * 四辺と四隅からリサイズできる透明ハンドルを作る。
   */
  private createResizeHandles(): HTMLButtonElement[] {
    const configs: Array<[ResizeDirection, string, string]> = [
      ["n", "top-0 left-3 right-3 h-2 cursor-ns-resize", ""],
      ["e", "right-0 top-3 bottom-3 w-2 cursor-ew-resize", ""],
      ["s", "bottom-0 left-3 right-3 h-2 cursor-ns-resize", ""],
      ["w", "left-0 top-3 bottom-3 w-2 cursor-ew-resize", ""],
      ["ne", "right-0 top-0 h-4 w-4 cursor-nesw-resize", ""],
      ["nw", "left-0 top-0 h-4 w-4 cursor-nwse-resize", ""],
      ["sw", "left-0 bottom-0 h-4 w-4 cursor-nesw-resize", ""],
      [
        "se",
        "right-0 bottom-0 h-4 w-4 cursor-nwse-resize focus:outline-none focus:ring-1 focus:ring-purple-500",
        "",
      ],
    ];

    return configs.map(([direction, className, icon]) => {
      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = `absolute ${className}`;
      handle.dataset.resizeDirection = direction;
      handle.setAttribute(
        "aria-label",
        `${this.text.resize} ${direction}`,
      );
      handle.innerHTML = icon;
      handle.addEventListener("pointerdown", (event) =>
        this.startResize(event, direction),
      );
      return handle;
    });
  }

  /**
   * リサイズ方向に応じて、位置とサイズを同時に更新する。
   */
  private applyResize(
    moveEvent: PointerEvent,
    startX: number,
    startY: number,
    startLeft: number,
    startTop: number,
    startWidth: number,
    startHeight: number,
    direction: ResizeDirection,
  ): void {
    const deltaX = moveEvent.clientX - startX;
    const deltaY = moveEvent.clientY - startY;
    let nextLeft = startLeft;
    let nextTop = startTop;
    let nextWidth = startWidth;
    let nextHeight = startHeight;

    if (direction.includes("e")) {
      nextWidth = clamp(
        startWidth + deltaX,
        QuriCodeExportDialog.MIN_PANEL_WIDTH,
        window.innerWidth - startLeft,
      );
    }
    if (direction.includes("s")) {
      nextHeight = clamp(
        startHeight + deltaY,
        QuriCodeExportDialog.MIN_PANEL_HEIGHT,
        window.innerHeight - startTop,
      );
    }
    if (direction.includes("w")) {
      nextWidth = clamp(
        startWidth - deltaX,
        QuriCodeExportDialog.MIN_PANEL_WIDTH,
        startWidth + startLeft,
      );
      nextLeft = startLeft + startWidth - nextWidth;
    }
    if (direction.includes("n")) {
      nextHeight = clamp(
        startHeight - deltaY,
        QuriCodeExportDialog.MIN_PANEL_HEIGHT,
        startHeight + startTop,
      );
      nextTop = startTop + startHeight - nextHeight;
    }

    this.root.style.left = `${nextLeft}px`;
    this.root.style.top = `${nextTop}px`;
    this.root.style.right = "auto";
    this.root.style.width = `${nextWidth}px`;
    this.root.style.height = `${nextHeight}px`;
  }
}

/**
 * 生成したテキストをブラウザのダウンロードとして保存する。
 */
function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string,
): void {
  const url = createObjectUrl(content, mimeType);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function createObjectUrl(content: string, mimeType: string): string {
  const blob = new Blob([content], { type: mimeType });
  return URL.createObjectURL(blob);
}

function modeDescription(
  mode: QuriCodeMode,
  text: Translation,
): string {
  if (mode === "circuit") {
    return text.circuitMode;
  }
  if (mode === "run") {
    return text.runMode;
  }

  return text.analyzeMode;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
