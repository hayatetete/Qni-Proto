"""Build the Japanese QniNotebook feature-verification demo."""

from pathlib import Path

import nbformat


ROOT = Path(__file__).resolve().parents[1]


def markdown(source: str):
    return nbformat.v4.new_markdown_cell(source.strip())


def code(source: str):
    return nbformat.v4.new_code_cell(source.strip())


cells = [
    markdown(
        r"""
# QniNotebook 機能確認デモ

このNotebookでは、QniNotebookが対応する表示と検査機能を順番に確認します。

1. 対応ゲート一覧
2. 上限の8量子ビット表示
3. 横に長いQAOA Max-Cut回路
4. すべてPASSするチェックポイント
5. すべてFAILするチェックポイント

各出力は読み取り専用です。Step 0はゲート適用前、Step NはN列目まで適用した状態です。
基底状態は左から`q(n-1)…q0`の順で表示され、`q0`が右端です。
"""
    ),
    code(
        """
from math import pi

from qni_jupyter import qni
from quri_parts.circuit import QuantumCircuit
"""
    ),
    markdown(
        r"""
## 1. 対応ゲート一覧

| 分類 | このデモで確認するゲート |
|---|---|
| 1量子ビット | H、X、Y、Z、S、S†、T、T†、√X |
| 回転・位相 | RX、RY、RZ、U1（数値で角度が確定したもの） |
| 複数量子ビット | CNOT、CZ、Toffoli、SWAP |
| 測定 | Measurement |

未束縛のパラメータ式、アンチコントロール、保持できないclassical bit mappingは対象外です。
"""
    ),
    code(
        """
gate_catalog = QuantumCircuit(8, cbit_count=8)
gate_catalog.add_H_gate(0)
gate_catalog.add_X_gate(1)
gate_catalog.add_Y_gate(2)
gate_catalog.add_Z_gate(3)
gate_catalog.add_S_gate(4)
gate_catalog.add_Sdag_gate(5)
gate_catalog.add_T_gate(6)
gate_catalog.add_Tdag_gate(7)
gate_catalog.add_SqrtX_gate(0)
gate_catalog.add_RX_gate(1, pi / 3)
gate_catalog.add_RY_gate(2, pi / 4)
gate_catalog.add_RZ_gate(3, pi / 5)
gate_catalog.add_U1_gate(4, pi / 6)
gate_catalog.add_CNOT_gate(0, 1)
gate_catalog.add_CZ_gate(2, 3)
gate_catalog.add_TOFFOLI_gate(0, 1, 2)
gate_catalog.add_SWAP_gate(6, 7)
gate_catalog.measure(range(8), range(8))

qni.show_circuit(gate_catalog)
"""
    ),
    markdown(
        r"""
## 2. 上限の8量子ビットを縦に表示する

8量子ビットGHZ状態を作ります。最終状態の主要な基底状態は`|00000000⟩`と`|11111111⟩`で、確率はそれぞれ50%です。

検査アイコンを開き、Dominant states、二進ket、十進表記、確率、振幅、位相、qubit名を確認してください。パネルを閉じると、256個すべての状態円を個別にホバーできます。
"""
    ),
    code(
        """
ghz8_circuit = QuantumCircuit(8)
ghz8_circuit.add_H_gate(0)
for target in range(1, 8):
    ghz8_circuit.add_CNOT_gate(0, target)

qni.show_circuit_and_state(
    ghz8_circuit,
    step="last",
    qubit_names=[f"GHZ q{i}" for i in range(8)],
)
"""
    ),
    markdown(
        r"""
## 3. 横に長いQAOA Max-Cut回路

8頂点リンググラフのMax-Cutを対象に、3層のQAOA ansatzを組みます。各コスト層は辺ごとの`CNOT–RZ–CNOT`、ミキサー層は各量子ビットの`RX`です。

これはQAOAで用いられる標準的な回路構成です。このセルでは、3層の回路と各境界の状態ベクトルを確認します。

参考: [A Quantum Approximate Optimization Algorithm](https://arxiv.org/abs/1411.4028)
"""
    ),
    code(
        """
ring_edges = [(i, (i + 1) % 8) for i in range(8)]
gammas = [0.31, 0.57, 0.83]
betas = [0.22, 0.41, 0.64]

qaoa_circuit = QuantumCircuit(8)
for qubit in range(8):
    qaoa_circuit.add_H_gate(qubit)

for gamma, beta in zip(gammas, betas):
    for control, target in ring_edges:
        qaoa_circuit.add_CNOT_gate(control, target)
        qaoa_circuit.add_RZ_gate(target, 2 * gamma)
        qaoa_circuit.add_CNOT_gate(control, target)
    for qubit in range(8):
        qaoa_circuit.add_RX_gate(qubit, 2 * beta)

qni.show_circuit_and_state(
    qaoa_circuit,
    step="last",
    qubit_names=[f"vertex {i}" for i in range(8)],
)
"""
    ),
    markdown(
        r"""
## 4. すべてPASSするチェックポイント

3量子ビットGHZ回路について、各境界で必ず成立する確率を登録します。検査パネルでは4項目すべてが緑のPASSになり、`All checkpoints passed`と表示されます。
"""
    ),
    code(
        """
ghz3_circuit = QuantumCircuit(3)
ghz3_circuit.add_H_gate(0)
ghz3_circuit.add_CNOT_gate(0, 1)
ghz3_circuit.add_CNOT_gate(0, 2)

all_green_checkpoints = [
    qni.QniCheckpoint("Initial state", 0, {"000": 1.0}),
    qni.QniCheckpoint("Superposition", 1, {"000": 0.5, "001": 0.5}),
    qni.QniCheckpoint("Two qubits entangled", 2, {"000": 0.5, "011": 0.5}),
    qni.QniCheckpoint("GHZ state", "last", {"000": 0.5, "111": 0.5}),
]

qni.show_circuit_and_state(
    ghz3_circuit,
    step="last",
    checkpoints=all_green_checkpoints,
    qubit_names=["control", "target 1", "target 2"],
)
"""
    ),
    markdown(
        r"""
## 5. すべてFAILするチェックポイント

同じ回路へ、成立しない期待値を意図的に指定します。これはアルゴリズムの不具合例ではなく、FAIL表示、最初に失敗した境界、Expected・Actual・Differenceを確認するためのUI確認用データです。
"""
    ),
    code(
        """
all_red_checkpoints = [
    qni.QniCheckpoint("Wrong initial state", 0, {"111": 1.0}),
    qni.QniCheckpoint("Wrong superposition", 1, {"000": 1.0}),
    qni.QniCheckpoint("Wrong entangled state", 2, {"111": 1.0}),
    qni.QniCheckpoint("Wrong final state", "last", {"001": 1.0}),
]

qni.show_circuit_and_state(
    ghz3_circuit,
    step="last",
    checkpoints=all_red_checkpoints,
    qubit_names=["control", "target 1", "target 2"],
)
"""
    ),
    markdown(
        r"""
## 最終確認

- Step 0でゲート適用前の`|000…0⟩`を選べる
- スライダー、Step番号入力、左右キー、ホイールで境界を移動できる
- 8量子ビット表示で重要な状態がDominant statesに表示される
- 状態円からbitstring、確率、振幅、位相を確認できる
- QAOA回路を横方向に移動し、すべての回路列を確認できる
- 全PASS例が緑、全FAIL例が赤で表示される
- 全FAIL例で最初に失敗した境界と期待値との差を確認できる
- 初回表示で誤った1量子ビット要求やHTTP 500が発生しない

確認後は新しいセルで`qni.close()`を実行します。
"""
    ),
]

notebook = nbformat.v4.new_notebook(
    cells=cells,
    metadata={
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python", "version": "3"},
    },
)
nbformat.write(notebook, ROOT / "qni_demo.ipynb")
