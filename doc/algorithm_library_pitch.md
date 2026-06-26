# 量子アルゴリズムライブラリの概要

QniGPUのドロップダウンメニューから「Algorythms」を選択すると、Grover探索アルゴリズムなど定番の量子アルゴリズムがリスト表示される。目的の回路をクリックすれば、その量子回路をすぐにGUI表示・実行・カスタムできる。

---

# 課題の背景

Qniでは量子アルゴリズムの設計・実装に手動で1つずつゲート操作が必要。
中・大規模の量子アルゴリズムでは、大量の量子ビットやゲートを配置する作業は非効率で、ユーザーの負担が大きい。

---

# 提案する機能の詳細

「量子アルゴリズムライブラリ」は、リストからアルゴリズムを選んでクリックするだけで対応する量子回路をロードできる機能。
すぐにシミュレーションやOpenQASM出力も可能。

### 特徴

- **直感的なインターフェース**  
  アルゴリズムをリスト表示。アルゴリズムの目的もホバーで解説。

- **クイックロード機能**  
  選んだアルゴリズムに合わせて、必要なゲートや量子ビットがテンプレート回路として自動ロード。

---

# ユースケース

- 学習者・研究者は量子回路をすぐロードでき、学習・作業効率アップ。
- 産業応用では量子アルゴリズムのプロトタイプを素早く作成し、研究開発を加速。

---

# リスク

ほかのツールにて量子アルゴリズムが実装済み：
（例）
- Grover探索
- Shor周期探索
- CHSHベル不等式テスト
- 量子テレポーテーション
- 超密度符号化
- Delayed Choice Eraser
- Symmetry Breaking
- Quantum Fourier Transform
- Reversible Addition
- Magic State Distillation
など
---

# 新規性

幅広く量子アルゴリズムやカスタム機能をカバーし、
Qniチュートリアルとの連携も行う。

- VQE（分子基底状態エネルギー計算）
- QAOA（組合せ最適化）
- Amplitude Amplification（Grover一般化）
- Quantum Machine Learning（QSVM, QNN）
- Hamiltonian Simulation
- Quantum Phase Estimation
- Quantum Annealing
- Quantum Walks
- Quantum Key Distribution
- Quantum Error Correction
- Quantum Gibbs Sampling
- Quantum Principal Component Analysis
- Quantum State Tomography
- Quantum Random Number Generation
- Quantum Cryptography
- Quantum Simulation of Many-Body Systems
- Quantum Tensor Networks
- Quantum Game Theory
- Quantum Zeno Effect
- Topological Quantum Computing

# 実装計画

1. 要件定義と設計
   - UIモックアップ作成
   - QniのURLエンコード機能をQniGPUに実装
   - アルゴリズム回路テンプレートをURLでエンコードする仕組み設計

2. プロトタイプ開発
   - URLエンコード機能を移植・再実装
   - 小規模回路でクイックロード機能を実装
   - UI初期バージョン開発

3. テストとフィードバック
   - 共同研究先やレビュアーからフィードバック収集
   - パフォーマンス・使いやすさ検証

4. 正式リリース
   - フィードバック反映版をリリース
   - ドキュメント・チュートリアルも対応
