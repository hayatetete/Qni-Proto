export type CodePreviewLanguage = "python" | "json" | "text";
export type CodePreviewTheme = "light" | "dark";

export interface CodePreviewOptions {
  language: CodePreviewLanguage;
  className?: string;
  theme?: CodePreviewTheme;
}

const PYTHON_KEYWORDS = new Set([
  "as",
  "class",
  "def",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "None",
  "pass",
  "print",
  "return",
  "try",
  "with",
]);

/**
 * コード表示・スクロール・ハイライトをまとめた再利用用プレビュー部品。
 */
export class CodePreview {
  readonly element: HTMLDivElement;
  private readonly codeElement: HTMLElement;
  private code = "";
  private language: CodePreviewLanguage;
  private theme: CodePreviewTheme;

  constructor(options: CodePreviewOptions) {
    this.language = options.language;
    this.theme = options.theme ?? "light";
    this.element = document.createElement("div");
    this.element.className =
      options.className ??
      "h-96 w-full overflow-auto rounded-md shadow-sm border border-gray-400 bg-slate-50 py-2 px-3 font-mono text-sm leading-5 text-gray-950 focus-within:border-2 focus-within:border-purple-500 focus-within:ring-purple-500";
    this.element.style.scrollbarColor = "#6B7280 #E5E7EB";
    this.element.style.scrollbarWidth = "thin";
    this.element.tabIndex = 0;
    this.element.addEventListener("wheel", (event) => event.stopPropagation(), {
      passive: true,
    });
    this.element.addEventListener(
      "touchmove",
      (event) => event.stopPropagation(),
      { passive: true },
    );
    this.syncThemeClasses();

    const pre = document.createElement("pre");
    pre.className = "min-w-max whitespace-pre text-left";

    this.codeElement = document.createElement("code");
    pre.appendChild(this.codeElement);
    this.element.appendChild(pre);
  }

  /**
   * 表示するコードとハイライト言語を更新する。
   */
  setCode(code: string, language: CodePreviewLanguage = this.language): void {
    this.code = code;
    this.language = language;
    this.codeElement.innerHTML = highlightCodeToHtml(code, language, this.theme);
    this.element.scrollTop = 0;
    this.element.scrollLeft = 0;
  }

  /**
   * 背景色とシンタックスカラーを切り替え、表示中のコードも再描画する。
   */
  setTheme(theme: CodePreviewTheme): void {
    if (this.theme === theme) {
      return;
    }

    this.theme = theme;
    this.syncThemeClasses();
    this.codeElement.innerHTML = highlightCodeToHtml(
      this.code,
      this.language,
      this.theme,
    );
  }

  /**
   * 現在表示しているコード文字列を返す。
   */
  getCode(): string {
    return this.code;
  }

  /**
   * コピー失敗時に、利用者が手でコピーできるようコード全文を選択する。
   */
  selectAll(): void {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(this.codeElement);
    selection?.removeAllRanges();
    selection?.addRange(range);
    this.element.focus();
  }

  /**
   * Tailwind classとスクロールバー色を、現在のコードテーマへ同期する。
   */
  private syncThemeClasses(): void {
    const lightClasses = ["bg-slate-50", "text-gray-950"];
    const darkClasses = ["bg-slate-950", "text-slate-100"];
    this.element.classList.remove(...lightClasses, ...darkClasses);
    this.element.classList.add(
      ...(this.theme === "dark" ? darkClasses : lightClasses),
    );
    this.element.style.scrollbarColor =
      this.theme === "dark" ? "#64748B #020617" : "#6B7280 #E5E7EB";
  }
}

/**
 * 指定言語のコードを、表示用のHTMLへ変換する。
 */
export function highlightCodeToHtml(
  code: string,
  language: CodePreviewLanguage,
  theme: CodePreviewTheme = "light",
): string {
  if (language === "python") {
    return highlightPython(code, theme);
  }
  if (language === "json") {
    return highlightJson(code, theme);
  }

  return escapeHtml(code);
}

/**
 * Pythonコードを簡易的に色分けする。
 */
function highlightPython(code: string, theme: CodePreviewTheme): string {
  const tokenPattern =
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#.*|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b)/g;
  const classes = tokenClasses(theme);

  return escapeHtml(code).replace(tokenPattern, (token) => {
    if (token.startsWith("#")) {
      return wrapToken(token, classes.comment);
    }
    if (token.startsWith('"') || token.startsWith("'")) {
      return wrapToken(token, classes.string);
    }
    if (/^\d/.test(token)) {
      return wrapToken(token, classes.number);
    }
    if (PYTHON_KEYWORDS.has(token)) {
      return wrapToken(token, classes.keyword);
    }
    return token;
  });
}

/**
 * Notebook JSONなどを簡易的に色分けする。
 */
function highlightJson(code: string, theme: CodePreviewTheme): string {
  const classes = tokenClasses(theme);
  return escapeHtml(code).replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\b\d+(?:\.\d+)?\b/g,
    (match, stringToken: string | undefined, colon: string | undefined) => {
      if (stringToken) {
        const className = colon ? classes.jsonKey : classes.string;
        return `${wrapToken(stringToken, className)}${colon ?? ""}`;
      }
      if (/^-?\d/.test(match)) {
        return wrapToken(match, classes.number);
      }
      return wrapToken(match, classes.literal);
    },
  );
}

/**
 * 明背景・暗背景それぞれで読みやすいシンタックスカラーを返す。
 */
function tokenClasses(theme: CodePreviewTheme): Record<string, string> {
  if (theme === "dark") {
    return {
      comment: "text-emerald-300",
      string: "text-amber-300",
      number: "text-cyan-300",
      keyword: "text-sky-300 font-semibold",
      jsonKey: "text-sky-300",
      literal: "text-fuchsia-300",
    };
  }

  return {
    comment: "text-emerald-700",
    string: "text-amber-700",
    number: "text-cyan-700",
    keyword: "text-blue-700 font-semibold",
    jsonKey: "text-blue-700",
    literal: "text-purple-700",
  };
}

function wrapToken(token: string, className: string): string {
  return `<span class="${className}">${token}</span>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
