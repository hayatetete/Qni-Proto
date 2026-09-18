# QniNotebookの利用仮説を根拠から見直す

調査日：2026年9月8日

## 確認できた事実

### 量子開発者は可視化とシミュレータをデバッグに使っている

2025年の実務者調査は、学術・産業の量子ソフトウェア開発者26名を対象にしている。全員がテストを行い、量子固有のテストツールを使う回答者は31%だった。デバッグではprint、回路可視化、シミュレータなどの手作業が使われ、規模が大きくなると十分でないという回答も報告された。

- [Challenges and Practices in Quantum Software Testing and Debugging](https://arxiv.org/abs/2506.17306)

Google Cirqの公式ドキュメントは、中間状態を返す`simulate_moment_steps`をデバッグ用途として説明している。PennyLaneの公式ドキュメントにも、回路途中の状態を取得する`Snapshot`と、実行中に対話する`breakpoint`がある。

- [Cirq: StateVector simulation](https://quantumai.google/cirq/simulate/simulation)
- [PennyLane: Quantum debugging](https://docs.pennylane.ai/en/stable/code/qp_debugging.html)

2025年のCircInspectは、Python/PennyLaneコードのbreakpoint、関数単位の回路表示、実行途中の出力確認を提案している。2026年には、回路をゲートごとに進め、全振幅を見る別のブラウザ実装も公開された。

- [CircInspect](https://arxiv.org/abs/2509.25199)
- [Ket debuggerの公開投稿](https://www.reddit.com/r/QuantumComputing/comments/1tth95p/i_built_a_quantum_circuit_debugger_that_runs_in/)

### AI生成量子コードには実行可能でも意味的に誤る例がある

QuanBenchは44課題で複数のLLMを評価し、全体精度40%未満、古いAPI、回路構築、アルゴリズム論理の誤りを報告した。QuanBench+はQiskit、PennyLane、Cirqで揃えた42課題を評価し、実行時エラーやwrong answerを返して修正させても完全にはならず、残存失敗は意味上の誤りへ集中すると報告した。

- [QuanBench](https://arxiv.org/abs/2510.16779)
- [QuanBench+](https://arxiv.org/abs/2604.08570)

QCircuitBenchはNeurIPS 2025で公開された量子回路コード生成ベンチマークで、検証関数と実行結果を含む。公開リポジトリには2026年1月2日のGPT-5.2/Codex実行が保存されている。Simon oracleの1件はQASM構文評価1.0、意味評価0.0であり、生成コード、モデル名、日時、実行ログ、参照回路を確認できる。

- [QCircuitBench論文](https://proceedings.neurips.cc/paper_files/paper/2025/hash/3e343c7fa87656d7e88e9a83cb2a5d10-Abstract-Datasets_and_Benchmarks_Track.html)
- [QCircuitBenchリポジトリ](https://github.com/EstelYang/QCircuitBench)
- [採用したSimon oracle実行結果](https://github.com/EstelYang/QCircuitBench/tree/main/qcircuitbench_results/harbor_parity/result_harbor_trial1/simon_oracle-n4__CiqR29q)

2026年のAPI drift研究は、17モデル、50課題、モデル当たり1,350実行で、指定SDK版への適合失敗を測定している。これもAI生成量子コードを実行検証する必要性の根拠になるが、状態ベクトルを使った原因調査の根拠ではない。

- [Benchmarking API Drift in LLM-Generated Quantum Code](https://arxiv.org/abs/2607.04072)

### 実在する量子回路不具合でも状態比較が使われている

Qiskit issue #13079では、transpiler passの前後で状態ベクトルを比較して、回路意味が変わる不具合を報告している。Qiskit issue #5839では、transpile後の途中statevector snapshotがqubit permutationの影響を受ける問題を、複数地点のsnapshotで調べている。Bugs4QはGitHub、Stack Overflow、Quantum Computing Stack Exchangeから実在バグを収集した公開ベンチマークである。

- [Qiskit #13079](https://github.com/Qiskit/qiskit/issues/13079)
- [Qiskit #5839](https://github.com/Qiskit/qiskit/issues/5839)
- [Bugs4Q](https://github.com/Z-928/Bugs4Q)

## 確認できなかったこと

- 量子アルゴリズム研究者が、論文を生成AIへ渡して回路コードを作る方法を一般的な作業として採用している、という2024〜2026年の利用者調査は確認できなかった。
- QURI Parts利用者がVQE最適化前に、手入力した中間状態チェックポイントで回路を確認する、という実務報告は確認できなかった。
- スピン軌道名をqubit表示名として常用する、というQURI Partsの公式手順または利用者報告は確認できなかった。
- X/Twitterも検索したが、上の利用実態を裏付け、原文と文脈を安定して確認できる公開投稿は得られなかった。見つからなかった情報を根拠にはしない。

したがって、これらを製品の前提やデモの物語として扱わない。

## デモ候補の比較

| 候補 | 実在性 | Qniで忠実に扱えるか | 採否 |
|---|---|---|---|
| QCircuitBenchのSimon oracle | 2026年の生成物・評価ログ・参照回路を公開 | 8 qubit、X/CNOTだけで再現可能 | 採用 |
| QCircuitBenchの8-qubit Grover | 2026年の生成物と評価ログを公開 | 長いが、失敗に測定後の文字列処理が混ざる | 主デモには不採用 |
| Qiskit #13079 HoareOptimizer | 実Issueでstatevector比較を使用 | 3 qubit、4 gateで再現可能 | 短く、Qni操作の評価には弱い |
| Bugs4QのGrover ancilla reset | 実コミュニティ投稿と修正コードを公開 | 非unitaryな`reset`を含み、QURI Parts回路へ忠実に移せない | 不採用 |
| QSCI/H₄の軌道対応ミス | 回路構造の資料はある | 「AIが対応を逆にした」生成物・ログがない | 撤回 |

## `qni_demo.ipynb`の方針

デモはQCircuitBenchのSimon oracle失敗例を使う。公開ログにある入力`0111`、期待出力`0110`、生成回路の出力`1111`を出発点にする。生成回路の誤りの位置は先に書かず、次の順で調べる。

1. 公開verifierと同じ式から期待出力を得る。
2. 公開された生成ゲート列をQURI Partsで構築する。
3. 最終状態を確認し、出力レジスタが期待と異なることを確認する。
4. Stepを戻り、各出力qubitがどのゲートで変化したかを追う。
5. 調査後に公開参照回路を実行して比較する。

デモではチェックポイントを渡さない。期待する最終出力は外部verifierから得られるが、中間状態を利用者が事前に列挙する必要はない。チェックポイントAPI自体は、利用者が既に不変条件を持つ場合の回帰テスト機能として残す。

## QniNotebookが事実に基づいて担当できる範囲

- QURI Parts回路をNotebook内で表示する。
- ゲート適用前を含む回路境界を選び、状態を戻って調べる。
- bitstring、確率、振幅、位相を数値で読む。
- qubitへ入力・出力などコード上の役割名を付ける。
- 構文は通るが出力が異なる回路について、どの操作が状態を変えたかを追う。

現在のQniは、仕様から正解回路を生成せず、2回路の意味的等価性も自動判定しない。「最初の誤りを自動説明する」製品だとは表現しない。

## 次に利用者へ確認すること

実務上の価値は文献だけでは確定しない。QURI Parts利用者へ、実際の回路不具合を持ち込んでもらい、次を観察する。

- 最終結果の不一致から、普段どの情報を見て切り分けるか。
- 全状態ベクトル、選択振幅、周辺確率、期待値のどれが必要か。
- ゲート境界、関数境界、transpiler前後のどこで比較したいか。
- Qniの表示で原因候補を絞れるか、別の情報が必要か。
- 8 qubitの完全状態表示が研究対象に対して十分か。
