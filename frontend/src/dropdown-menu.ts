export class DropdownMenu {
  private menuButton: HTMLElement | null;
  private menuDropdown: HTMLElement | null;
  private menuContainer: HTMLElement | null;
  private activeClass = "bg-neutral-200";
  private algorithmsButton: HTMLElement | null;
  private algorithmDropdown: HTMLElement | null;

  constructor() {
    this.menuContainer = document.getElementById("menu-container");
    this.menuButton = document.getElementById("menu-button");
    this.menuDropdown = document.getElementById("menu-dropdown");
    this.algorithmsButton = document.getElementById(
      "quantum-algorithms"
    );
    this.algorithmDropdown = document.getElementById(
      "quantum-algorithms-dropdown"
    );

    if (this.menuButton) {
      this.menuButton.addEventListener(
        "click",
        this.toggleMenuDropdown.bind(this)
      );
    }
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

  private toggleMenuDropdown(): void {
    if (!this.menuDropdown || !this.menuButton) return;
    const isActive = this.menuDropdown.classList.toggle("hidden");
    if (!isActive) {
      this.menuButton.classList.add(this.activeClass);
      this.menuButton.setAttribute("aria-expanded", "true");
    } else {
      this.menuButton.classList.remove(this.activeClass);
      this.menuButton.setAttribute("aria-expanded", "false");
      this.hideAlgorithmDropdown();
    }
  }

  private maybeHideMenuDropdown(event: MouseEvent): void {
    const clickedEl = event.target as HTMLElement;
    if (
      this.menuContainer &&
      !this.menuContainer.contains(clickedEl) &&
      this.menuDropdown &&
      !this.menuDropdown.classList.contains("hidden")
    ) {
      this.menuDropdown.classList.add("hidden");
      if (this.menuButton) {
        this.menuButton.classList.remove(this.activeClass);
        this.menuButton.setAttribute("aria-expanded", "false");
      }
      this.hideAlgorithmDropdown();
    }

    if (
      this.algorithmDropdown &&
      !this.algorithmDropdown.classList.contains("hidden") &&
      !this.algorithmDropdown.contains(clickedEl) &&
      clickedEl !== this.algorithmsButton
    ) {
      this.hideAlgorithmDropdown();
    }
  }

  private toggleAlgorithmDropdown(): void {
    if (!this.algorithmDropdown || !this.algorithmsButton) return;
    const isHidden = this.algorithmDropdown.classList.toggle("hidden");
    if (!isHidden) {
      this.algorithmDropdown.style.display = "";
    } else {
      this.hideAlgorithmDropdown();
    }
  }

  private hideAlgorithmDropdown(): void {
    if (this.algorithmDropdown) {
      this.algorithmDropdown.classList.add("hidden");
      // Reset position
      this.algorithmDropdown.style.left = "";
      this.algorithmDropdown.style.top = "";
      this.algorithmDropdown.style.display = "none";
    }
  }
}
