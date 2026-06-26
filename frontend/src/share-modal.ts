import tippy from "tippy.js";
export class ShareModal {
  private modalElement: HTMLElement;

  private updateUrlDisplay(): void {
    const urlDiv = document.getElementById("circuit-url");
    if (!urlDiv) return;
    urlDiv.textContent = `${location.origin}${location.pathname}${location.hash}`;
  }

  private get shareOnXUrl(): string {
    const hashtagsParam = "hashtags=qni";
    const urlParam = `url=${encodeURIComponent(window.location.href)}`;
    const params = [hashtagsParam, urlParam];

    // location.hash から title を抽出
    let title = "";
    try {
      if (location.hash.startsWith("#circuit=")) {
        const json = JSON.parse(decodeURIComponent(location.hash.substring(9)));
        if (json.title) title = json.title;
      }
    } catch (e) {
      // 失敗しても何もしない
    }

    if (title) {
      const textParam = `text=${encodeURIComponent(title)}`;
      params.unshift(textParam);
    }

    return `https://x.com/intent/post?${params.join("&")}`;
  }

  constructor(modalId: string, closeButtonId: string) {
    const modal = document.getElementById(modalId);
    if (!modal) {
      throw new Error(`Modal element with ID '${modalId}' not found.`);
    }
    this.modalElement = modal;

    const closeButton = document.getElementById(closeButtonId);
    if (closeButton) {
      closeButton.addEventListener("click", this.close.bind(this));
    }

    const backgroundOverlay = this.modalElement.querySelector(
      '[data-action="click->share#closeModal"]'
    );
    if (backgroundOverlay) {
      backgroundOverlay.addEventListener("click", this.close.bind(this));
    }

    const titleInput = document.getElementById(
      "circuit-title-input"
    ) as HTMLInputElement | null;
    if (titleInput) {
      titleInput.addEventListener("input", () => {
        document.title = titleInput.value || "Qni GL";
        // URLも更新
        window.pixiApp?.updateUrlWithCircuit();
        this.updateUrlDisplay();
      });
    }

    const copyButton = document.getElementById("copy-button");
    const TOOLTIP_DURATION_MS = 1000
    const TIPPY_HIDE_ANIMATION_MS = 250

    if (copyButton) {
      // tippyインスタンスを作成
      const tip = tippy(copyButton, {
        content: "Copied to clipboard",
        trigger: "manual",
        placement: "bottom",
        duration: [0, TIPPY_HIDE_ANIMATION_MS],
      });
      
      copyButton.addEventListener("click", () => {
        navigator.clipboard.writeText(
          `${location.origin}${location.pathname}${location.hash}`
        );
        // 吹き出し表示
        tip.show();
        setTimeout(() => tip.hide(), TOOLTIP_DURATION_MS);
      });
    }

    const shareButton = document.getElementById("share-button");
    if (shareButton) {
      shareButton.addEventListener("click", () => {
        window.open(this.shareOnXUrl, "_blank");
      });
    }

    this.updateUrlDisplay();
  }

  open(): void {
    this.modalElement.classList.remove("hidden");
    const titleInput = document.getElementById(
      "circuit-title-input"
    ) as HTMLInputElement | null;
    if (titleInput) {
      titleInput.focus();
    }
    this.updateUrlDisplay();
  }

  close(): void {
    this.modalElement.classList.add("hidden");
  }
}
