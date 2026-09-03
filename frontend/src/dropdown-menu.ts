export class DropdownMenu {
  private activeClass = "bg-neutral-200";
  private menuButton: HTMLElement | null;
  private menuDropdown: HTMLElement | null;
  private algorithmsButton: HTMLElement | null;
  private algorithmDropdown: HTMLElement | null;

  constructor() {
    this.menuButton = document.getElementById("menu-button");
    this.menuDropdown = document.getElementById("menu-dropdown");
    this.algorithmsButton = document.getElementById(
      "quantum-algorithms"
    );
    this.algorithmDropdown = document.getElementById(
      "quantum-algorithms-dropdown"
    );

    this.menuButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toggleMenuDropdown();
    });
    this.menuDropdown?.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    document.addEventListener("click", this.maybeHideDropdowns.bind(this));

    if (this.algorithmsButton && this.algorithmDropdown) {
      this.algorithmsButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleAlgorithmDropdown();
      });
      // Close submenu when clicking inside it
      this.algorithmDropdown.addEventListener("click", (e) => {
        e.stopPropagation();
        this.hideAlgorithmDropdown();
      });
    }
  }

  private maybeHideDropdowns(event: MouseEvent): void {
    const clickedEl = event.target as HTMLElement;
    if (
      this.menuDropdown &&
      !this.menuDropdown.classList.contains("hidden") &&
      !this.menuDropdown.contains(clickedEl) &&
      !this.menuButton?.contains(clickedEl)
    ) {
      this.hideMenuDropdown();
    }
    if (
      this.algorithmDropdown &&
      !this.algorithmDropdown.classList.contains("hidden") &&
      !this.algorithmDropdown.contains(clickedEl) &&
      this.algorithmsButton &&
      !this.algorithmsButton.contains(clickedEl)
    ) {
      this.hideAlgorithmDropdown();
    }
  }

  private toggleMenuDropdown(): void {
    if (!this.menuDropdown || !this.menuButton) return;
    const opening = this.menuDropdown.classList.contains("hidden");
    if (opening) {
      this.menuDropdown.classList.remove("hidden");
      this.menuButton.classList.add(this.activeClass);
      this.menuButton.setAttribute("aria-expanded", "true");
      return;
    }
    this.hideMenuDropdown();
  }

  private hideMenuDropdown(): void {
    this.menuDropdown?.classList.add("hidden");
    this.menuButton?.classList.remove(this.activeClass);
    this.menuButton?.setAttribute("aria-expanded", "false");
    this.hideAlgorithmDropdown();
  }

  private toggleAlgorithmDropdown(): void {
    if (!this.algorithmDropdown || !this.algorithmsButton) return;
    const isHidden = this.algorithmDropdown.classList.toggle("hidden");
    if (!isHidden) {
      this.algorithmDropdown.style.display = "";
      this.algorithmsButton.classList.add(this.activeClass);
      this.algorithmsButton.setAttribute("aria-expanded", "true");
    } else {
      this.hideAlgorithmDropdown();
    }
  }

  private hideAlgorithmDropdown(): void {
    if (this.algorithmDropdown) {
      this.algorithmDropdown.classList.add("hidden");
      this.algorithmDropdown.style.display = "none";
    }
    if (this.algorithmsButton) {
      this.algorithmsButton.classList.remove(this.activeClass);
      this.algorithmsButton.setAttribute("aria-expanded", "false");
    }
  }
}
