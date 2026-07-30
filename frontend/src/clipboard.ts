/**
 * ブラウザやNotebook iframeの制限に合わせて、文字列を実クリップボードへ書き込む。
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (await copyWithClipboardApi(text)) {
    return true;
  }

  return copyWithTemporaryTextArea(text);
}

/**
 * 標準Clipboard APIでコピーし、権限やiframe制限で失敗した場合はfalseを返す。
 */
async function copyWithClipboardApi(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) {
      return false;
    }

    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clipboard APIが使えない環境向けに、選択済みtextarea経由でコピーする。
 */
function copyWithTemporaryTextArea(text: string): boolean {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "fixed";
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.width = "1px";
  textArea.style.height = "1px";
  textArea.style.padding = "0";
  textArea.style.border = "0";
  textArea.style.opacity = "0";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, textArea.value.length);

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
}
