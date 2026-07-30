import { SerializedOperation } from "./types";

export interface QuriCodeGenerationResult {
  code: string;
  warnings: string[];
}

export type QuriCodeMode = "circuit" | "run" | "analyze";

export interface QuriCodeGenerationOptions {
  mode?: QuriCodeMode;
  shots?: number;
}

type OperationEmitter = (
  operation: SerializedOperation,
  warnings: string[],
) => string[];

const SINGLE_QUBIT_METHODS: Record<string, string> = {
  H: "add_H_gate",
  X: "add_X_gate",
  Y: "add_Y_gate",
  Z: "add_Z_gate",
  S: "add_S_gate",
  "S†": "add_Sdag_gate",
  T: "add_T_gate",
  "T†": "add_Tdag_gate",
  "X^½": "add_SqrtX_gate",
};

const MULTI_CONTROLLED_FACTORIES: Record<string, string> = {
  H: "MCH",
  X: "MCX",
  Y: "MCY",
  Z: "MCZ",
  S: "MCS",
  "S†": "MCSdag",
  T: "MCT",
  "T†": "MCTdag",
  "X^½": "MCSqrtX",
};

/**
 * QniGPUのステップ配列を、利用者がJupyterで実行できるQURI Partsコードへ変換する。
 */
export function generateQuriCode(
  steps: SerializedOperation[][],
  qubitCount: number,
  options: QuriCodeGenerationOptions = {},
): QuriCodeGenerationResult {
  const mode = options.mode ?? "circuit";
  const shots = options.shots ?? 1000;
  const warnings: string[] = [];
  const bodyLines = emitOperationLines(steps, warnings);
  const usesFactories = bodyLines.some((line) => line.includes("gates."));
  const hasMeasurement = steps.some((step) =>
    step.some((operation) => operation.type === "Measure"),
  );
  const imports = usesFactories
    ? "from quri_parts.circuit import QuantumCircuit, gates"
    : "from quri_parts.circuit import QuantumCircuit";
  const circuitConstructor = hasMeasurement
    ? `QuantumCircuit(${qubitCount}, cbit_count=${qubitCount})`
    : `QuantumCircuit(${qubitCount})`;

  const lines = [
    "# Generated from QniGPU.",
    dependencyCommentFor(mode),
    imports,
    ...runtimeImportsFor(mode),
    "",
    `circuit = ${circuitConstructor}`,
  ];

  if (bodyLines.length > 0) {
    lines.push(...bodyLines);
  }

  lines.push(...runtimeLinesFor(mode, shots));

  if (warnings.length > 0) {
    lines.push("", "# Warnings:");
    warnings.forEach((warning) => lines.push(`# - ${warning}`));
  }

  return {
    code: `${lines.join("\n")}\n`,
    warnings,
  };
}

/**
 * QURIコードをJupyter Notebook形式のJSON文字列へ変換する。
 */
export function generateQuriNotebook(
  steps: SerializedOperation[][],
  qubitCount: number,
  options: QuriCodeGenerationOptions = {},
): QuriCodeGenerationResult {
  const result = generateQuriCode(steps, qubitCount, options);
  const notebook = {
    cells: [
      {
        cell_type: "code",
        execution_count: null,
        metadata: {},
        outputs: [],
        source: toNotebookSource(result.code),
      },
    ],
    metadata: {
      kernelspec: {
        display_name: "Python 3",
        language: "python",
        name: "python3",
      },
      language_info: {
        name: "python",
        pycodemirror_mode: {
          name: "ipython",
          version: 3,
        },
      },
    },
    nbformat: 4,
    nbformat_minor: 5,
  };

  return {
    code: `${JSON.stringify(notebook, null, 2)}\n`,
    warnings: result.warnings,
  };
}

/**
 * Notebookのcode cellが期待する、改行を保持したsource配列を作る。
 */
function toNotebookSource(code: string): string[] {
  const lines = code.split("\n");
  return lines
    .map((line, index) => (index < lines.length - 1 ? `${line}\n` : line))
    .filter((line) => line.length > 0);
}

/**
 * 実行モードごとに利用者へ必要なpip依存を示すコメントを返す。
 */
function dependencyCommentFor(mode: QuriCodeMode): string {
  if (mode === "circuit") {
    return "# Install QURI Parts before running: pip install quri-parts";
  }

  return '# Install QURI SDK with Qulacs before running: pip install "quri-sdk[qulacs]"';
}

/**
 * サンプリングや解析に必要な追加importを返す。
 */
function runtimeImportsFor(mode: QuriCodeMode): string[] {
  if (mode === "circuit") {
    return [];
  }

  return ["from quri_vm.vm import VM"];
}

/**
 * 回路作成後に実行するサンプリング・解析コードを返す。
 */
function runtimeLinesFor(mode: QuriCodeMode, shots: number): string[] {
  if (mode === "circuit") {
    return [];
  }

  const lines = ["", "vm = VM()"];
  if (mode === "run") {
    lines.push(`samples = vm.sample(circuit, shots=${shots})`, "print(samples)");
    return lines;
  }

  lines.push(
    `samples = vm.sample(circuit, shots=${shots})`,
    "analysis = vm.analyze(circuit)",
    'print("samples =", samples)',
    'print("analysis =", analysis)',
  );
  return lines;
}

/**
 * 各ステップに含まれる操作を、QURI Partsのゲート追加コードへ変換する。
 */
function emitOperationLines(
  steps: SerializedOperation[][],
  warnings: string[],
): string[] {
  return steps.flatMap((step) =>
    step.flatMap((operation) => emitOperation(operation, warnings)),
  );
}

/**
 * 単一のQniGPU操作を、1行以上のQURI Partsコードへ変換する。
 */
function emitOperation(
  operation: SerializedOperation,
  warnings: string[],
): string[] {
  const emitter = OPERATION_EMITTERS[operation.type];
  if (!emitter) {
    warnings.push(`Unsupported gate "${operation.type}" was skipped.`);
    return [];
  }

  return emitter(operation, warnings);
}

const OPERATION_EMITTERS: Record<string, OperationEmitter> = {
  H: emitSingleOrControlledOperation,
  X: emitSingleOrControlledOperation,
  Y: emitSingleOrControlledOperation,
  Z: emitSingleOrControlledOperation,
  S: emitSingleOrControlledOperation,
  "S†": emitSingleOrControlledOperation,
  T: emitSingleOrControlledOperation,
  "T†": emitSingleOrControlledOperation,
  "X^½": emitSingleOrControlledOperation,
  Swap: emitSwapOperation,
  Measure: emitMeasurementOperation,
  "•": emitControlMarkerOperation,
  "|0>": emitWriteGateWarning,
  "|1>": emitWriteGateWarning,
};

/**
 * 通常ゲートと制御付きゲートを、QURI Partsの対応するAPI呼び出しへ変換する。
 */
function emitSingleOrControlledOperation(
  operation: SerializedOperation,
  warnings: string[],
): string[] {
  if (operation.controls && operation.controls.length > 0) {
    return emitControlledOperation(operation, warnings);
  }

  const method = SINGLE_QUBIT_METHODS[operation.type];
  return operation.targets.map((target) => `circuit.${method}(${target})`);
}

/**
 * 制御付きゲートを、CNOT/CZの専用APIまたはmulti-controlled factoryへ変換する。
 */
function emitControlledOperation(
  operation: SerializedOperation,
  warnings: string[],
): string[] {
  const controls = operation.controls ?? [];
  if (controls.length === 1 && operation.type === "X") {
    return operation.targets.map(
      (target) => `circuit.add_CNOT_gate(${controls[0]}, ${target})`,
    );
  }
  if (controls.length === 1 && operation.type === "Z") {
    return operation.targets.map(
      (target) => `circuit.add_CZ_gate(${controls[0]}, ${target})`,
    );
  }

  const factory = MULTI_CONTROLLED_FACTORIES[operation.type];
  if (!factory) {
    warnings.push(
      `Controlled gate "${operation.type}" is not supported and was skipped.`,
    );
    return [];
  }

  return operation.targets.map(
    (target) =>
      `circuit.add_gate(gates.${factory}(${target}, control_indices=${formatNumberList(
        controls,
      )}))`,
  );
}

/**
 * 2点SWAPだけをQURI PartsのSWAPゲートへ変換し、不完全なSWAPは警告する。
 */
function emitSwapOperation(
  operation: SerializedOperation,
  warnings: string[],
): string[] {
  if (operation.targets.length !== 2) {
    warnings.push("Incomplete Swap gate was skipped.");
    return [];
  }

  return [
    `circuit.add_SWAP_gate(${operation.targets[0]}, ${operation.targets[1]})`,
  ];
}

/**
 * 測定ゲートを、同じ番号の古典ビットへ測定するコードへ変換する。
 */
function emitMeasurementOperation(operation: SerializedOperation): string[] {
  return [
    `circuit.measure(${formatNumberList(operation.targets)}, ${formatNumberList(
      operation.targets,
    )})`,
  ];
}

/**
 * 単独の制御点はQURI Partsの回路操作ではないため、警告してスキップする。
 */
function emitControlMarkerOperation(
  operation: SerializedOperation,
  warnings: string[],
): string[] {
  warnings.push(
    `Control marker on qubit(s) ${formatNumberList(
      operation.targets,
    )} was skipped because it has no target gate.`,
  );
  return [];
}

/**
 * QniGPUのwrite gateはreset相当を含むため、誤変換を避けて警告する。
 */
function emitWriteGateWarning(
  operation: SerializedOperation,
  warnings: string[],
): string[] {
  warnings.push(
    `Write gate "${operation.type}" on qubit(s) ${formatNumberList(
      operation.targets,
    )} was skipped. QURI Parts code needs explicit initial-state handling.`,
  );
  return [];
}

/**
 * Pythonコード内で使う数値リスト表現を作る。
 */
function formatNumberList(values: number[]): string {
  return `[${values.join(", ")}]`;
}
