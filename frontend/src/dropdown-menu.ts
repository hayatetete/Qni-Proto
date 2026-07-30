export class DropdownMenu {
  private activeClass = "bg-neutral-200";
  private algorithmsButton: HTMLElement | null;
  private algorithmDropdown: HTMLElement | null;

  constructor() {
    this.algorithmsButton = document.getElementById(
      "quantum-algorithms"
    );
    this.algorithmDropdown = document.getElementById(
      "quantum-algorithms-dropdown"
    );

    document.addEventListener("click", this.maybeHideMenuDropdown.bind(this));

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

  private maybeHideMenuDropdown(event: MouseEvent): void {
    const clickedEl = event.target as HTMLElement;
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
