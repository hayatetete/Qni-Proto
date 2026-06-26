export type AlgorithmKey = keyof typeof ALGORITHM_CIRCUIT_HASHES;

const CHSH_QUBIT_COUNT = 2;
const GHZ_QUBIT_COUNT = 9;
const GROVER_QUBIT_COUNT = 3;

// Predefined quantum algorithm circuit hashes
export const ALGORITHM_CIRCUIT_HASHES = {
  chsh:
    "#circuit=" +
    JSON.stringify({
      cols: [
        Array(CHSH_QUBIT_COUNT).fill("|0>"),
        ["H", 1],
        ["•", "X"],
        Array(CHSH_QUBIT_COUNT).fill("Measure"),
      ],
      title: "Bell state generation",
    }),
  ghz:
    "#circuit=" +
    JSON.stringify({
      cols: [
        Array(GHZ_QUBIT_COUNT).fill("|0>"),
        ["H", ...Array(GHZ_QUBIT_COUNT - 1).fill(1)],
        ...Array.from({ length: GHZ_QUBIT_COUNT - 1 }, (_, i) => [
          ...Array(i).fill(1),
          "•",
          "X",
          ...Array(GHZ_QUBIT_COUNT - 2 - i).fill(1),
        ]),
        Array(GHZ_QUBIT_COUNT).fill("Measure"),
      ],
      title: `GHZ state generation (${GHZ_QUBIT_COUNT} qubits)`,
    }),
  grover:
    "#circuit=" +
    JSON.stringify({
      cols: [
        ["|0>", "|0>", "|0>", "|1>"],
        ["H", "H", "H", 1],
        [1, 1, 1, "X"],
        [1, 1, 1, "H"],
        ["•", "•", "•", "X"],
        [1, 1, 1, "H"],
        [1, 1, 1, "X"],
        ["H", "H", "H", 1],
        ["X", "X", "X", 1],
        [1, 1, "H", 1],
        ["•", "•", "X", 1],
        [1, 1, "H", 1],
        ["X", "X", "X", 1],
        ["H", "H", "H", 1],
        ["Measure", "Measure", "Measure", 1],
      ],
      title: `Grover's algorithm (${GROVER_QUBIT_COUNT} qubits, |111⟩ search)`,
    }),
} as const;

export function setupAlgorithms(
  onSelect: (algorithm: AlgorithmKey, hash: string, title: string) => void
) {
  const dropdown = document.getElementById("quantum-algorithms-dropdown");
  if (!dropdown) return;

  const buttons = dropdown.querySelectorAll<HTMLButtonElement>("button[data-algo]");
  buttons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      // Get selected algorithm key (used to identify which algorithm was chosen)
      const algorithm = button.getAttribute("data-algo") as AlgorithmKey | null;
      if (!algorithm) return;

      const hash = ALGORITHM_CIRCUIT_HASHES[algorithm];
      let circuitData;
      try {
        circuitData = JSON.parse(
          decodeURIComponent(hash.replace(/^#circuit=/, ""))
        );
      } catch (error) {
        console.error("Failed to load circuit data: The circuit hash is malformed.", error);
        return;
      }

      dropdown.classList.add("hidden");
      dropdown.style.left = "";
      dropdown.style.top = "";

      const menuDropdown = document.getElementById("menu-dropdown");
      if (menuDropdown) {
        menuDropdown.classList.add("hidden");
      }

      onSelect(algorithm, hash, circuitData.title);
    });
  });
}
