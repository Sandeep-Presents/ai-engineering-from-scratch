# 投票、自我一致性與辯論拓撲結構（Voting, Self-Consistency, and Debate Topology）

> 最廉價的聚合手段莫過於：從 N 個獨立 Agent 中取樣並執行多數決投票。Wang 等人於 2022 年提出的自我一致性（Self-consistency）對單一模型取樣 N 次實現了這一點。多 Agent 體系則進一步引入**異質性（Heterogeneous）** Agent 以打破單一文化同質盲點——混成不同的基底模型、不同的 prompt、不同的溫度係數以及不同的上下文視窗。在單純的多數決之外，辯論的拓撲結構至關重要：MultiAgentBench（arXiv:2503.01935，ACL 2025）評估了星狀（Star）、鏈狀（Chain）、樹狀（Tree）與圖狀（Graph）四大協同拓撲，發現**圖狀拓撲在深度科研任務上表現最佳**，但一旦 Agent 數量突破約 4 位，便會面臨急遽攀升的「協同稅（coordination tax）」。AgentVerse（ICLR 2024）記錄了兩大自發湧現的行為模式——自願主動承擔與從眾順從——而從眾順從既是一項特性（促成快速共識），也是一項致命風險（引發群體盲從 Groupthink，詳見第 24 課）。本課將全面繪製拓撲設計空間、親手實作各類變體，並精準量化測量協同稅的影響。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 14 (Consensus and BFT)
**Time:** ~75 minutes

## Problem｜問題

辯論機制確實能夠大幅提升推理準確率（Du 等人，arXiv:2305.14325）。但它也隨時可能導致系統品質急遽惡化。辯論究竟是帶來實質助益還是引發災難性倒退，取決於四大結構性工程抉擇：

1. 誰與誰對話（拓撲結構）。
2. 交鋒進行多少輪次（Du 2023 年的研究證明：輪次與 Agent 數量各自具有獨立的實質貢獻）。
3. 各 Agent 是否具備足夠的異質性（混成不同的基底模型以打破單一文化的系統性偏見）。
4. 體系中是否存在明確的對抗性反方席位（真理愈辯愈明的鋼鐵論述 vs 毫無意義的稻草人論點）。

多數工程團隊若僅僅粗暴地拼裝「讓 5 個 Agent 跑一遍並投票」，其產出往往比單一 Agent 還要糟糕。這些失敗絕非隨機偶發，而是精準契合了拓撲結構與異質性設計的缺陷。本課即是解開這些謎團的拓撲全景地圖。

## Concept｜核心概念

### 自我一致性：單一模型基準線

Wang 等人於 2022 年發表了奠基之作《Self-Consistency Improves Chain of Thought Reasoning》：在溫度係數 temperature > 0 的條件下對同一個模型取樣 N 次，並對所有推理路徑的最終答案進行多數決投票。在 GSM8K 基準測試上，相較於單次貪婪解碼（greedy decode），N=40 的取樣換來了極為顯著的準確率躍升。自我一致性是多 Agent 投票在單一模型維度上的經典先驅。

極限瓶頸：自我一致性在物理上僅使用單一基底模型。其內在誤差在架構生成時便已高度相關。若該模型存在某種系統性固有偏見，全體 N 個樣本將毫無例外地集體繼承該偏見。

### 多 Agent 投票：異質擴展體系

將原本的 N 個同質樣本，替換為 N 個**截然不同**的異質 Agent。混成不同的基底模型（Claude、GPT、Llama）、不同的角色 prompt，以及不同的工具存取權限。其核心優勢：徹底打破誤差的統計相關性。其代價：不同模型之間的計費成本差異懸殊，且跨模型協同會引入額外的排程開銷。

2026 年業界針對異質辯論的標準術語稱為 **A-HMAD**——對抗性異質多 Agent 辯論（Adversarial Heterogeneous Multi-Agent Debate）。該術語已被廣泛用於描述「透過讓不同模型進行結構化辯論，以消解單一文化同質崩潰所帶來的系統性盲點」。

### 四大經典拓撲結構

```
star                chain               tree                graph

    ┌─A─┐           A─B─C─D         ┌──A──┐              A───B
    │   │                           │     │              │ × │
    B   C                           B     C              D───C
    │   │                          / \   / \
    D   E                         D   E F   G           (fully connected)
```

**星狀（Star）**：存在唯一的中心集線節點（Hub），其餘所有邊緣節點僅能與中心節點通訊。等價於缺乏旁路回饋通道的監督者-工作者架構。
**鏈狀（Chain）**：線性傳遞，每個 Agent 僅能看見前一位 Agent 的輸出。本質上屬於流水線管線模式。
**樹狀（Tree）**：階層式架構，廣泛應用於多層級 Agent 組織中（第 06 課）。
**圖狀（Graph）**：任意節點皆可與其他節點互聯（Any-to-any）。涵蓋全聯通團（Clique）以及任意複雜的有向無環圖（DAG）。

### 協同稅（Coordination Tax，MultiAgentBench）

MultiAgentBench（MARBLE，ACL 2025，arXiv:2503.01935）在涵蓋深度科研、程式碼編寫與戰略規劃的多樣化任務集上，對星狀、鏈狀、樹狀與圖狀四大拓撲進行了全方位量化對抗評測。核心實測結論：

- **圖狀拓撲（Graph）** 在深度科研調研任務上斬獲第一。資訊在任意節點之間自由流動；各 Agent 能夠對彼此的論點進行全方位交叉質詢。
- **星狀拓撲（Star）** 在需要極速檢索明確事實的任務上表現最佳。由中心 Hub 負責快速過濾與彙整。
- **鏈狀拓撲（Chain）** 在分階段漸進精煉的步驟式任務上表現最為穩定。
- 在圖狀拓撲中，一旦 Agent 數量突破約 4 位，**協同稅（Coordination tax）** 就會顯著浮現。實際耗時與 token 成本的增長速度，將遠遠超過任務品質的邊際提升。

4 位 Agent 的天花板是實證總結而非物理定論。它客觀反映了 2026 年當前 LLM 的上下文承載極限：每個 Agent 的上下文迅速被同儕的大量發言所填滿，一旦所有人都能看見所有人的全部廢話，追加第 N+1 個 Agent 所帶來的邊際價值就會斷崖式下跌。

### 多 Agent 辯論策略的深層審視（《Should we be going MAD?》）

論文 arXiv:2311.17371 是 2023 年針對各類多 Agent 辯論（MAD）策略的權威綜述。其被後續無數研究復現的核心結論指出：在**相同算力與財務預算**的前提下，那些在結構上高度類似自我一致性（僅做獨立取樣後粗暴聚合）的平庸辯論變體，其最終準確率往往顯著劣於最單純的自我一致性。唯有當各 Agent 具備實質異質性、且辯論具備明確的對抗性反方結構時，辯論機制的真正價值才能全面爆發。

### AgentVerse 揭示的兩大湧現行為模式

AgentVerse (ICLR 2024, https://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf) 記錄了在未經任何顯式程式設計的前提下，多 Agent 辯論自發湧現的兩大經典行為特質：

- **自願承擔行為（Volunteer behavior）。** 某個 Agent 在未經明確指示的情況下主動提議提供協助（「我擅長這部分，我可以負責下一步」）。這是一項極具價值的正面湧現：它能自發將子任務導向最擅長攻克它的實體。
- **從眾順從行為（Conformity behavior）。** 某個 Agent 主動調整自身立場以迎合批判者，即便批判者在客觀事實上是徹底錯誤的。這正是辯論環境下的諂媚盲從現象（第 14 課）。

從眾順從現象正是為何「持續辯論直到達成共識為止」的設計會獎勵霸凌者的根本原因。透過限制輪次並引入獨立裁判，是唯一的破解之道。

### 異質性（Heterogeneity）：真正拉動準確率的實質旋鈕

2024 至 2026 年實踐文獻中的統一黃金規律：將你現有的 N 個同質 Agent 中的其中一個，替換為完全不同的異質基底模型，其為系統帶來的準確率提升，遠遠大於將同質 Agent 數量粗暴增加 1 個。其背後的直覺正是打破單一文化同質盲點——引入一個全新且獨立的誤差來源，其價值遠超增加另一個帶有完全相同系統性偏見的相關性複製品。

在極限條件下，異質性完勝純數量堆砌。在絕大多數具備真實標籤的任務中，三個不同模型家族的聯手表現，能輕易碾壓同一個模型的五個複製品。

### 審議團機制（Jury Methods）

Sibyl 框架（在心智社會文獻中被頻繁引述）將「審議團（Jury）」形式化落地——由一組專門分工的異質 Agent 透過在各階段進行投票來逐步精煉答案。不同於簡單的多數決，審議團具備明確的角色定義：一位 Agent 專職詰問盤查、一位專門補充客觀背景脈絡、一位專注評估方案可行性。審議團機制巧妙坐落於「廉價但易陷盲點的簡單投票」與「昂貴且易生從眾的全面漫談」之間的黃金分割點。

### 何時「帶有辯論的投票」佔據絕對主導

- 問題具備客觀唯一的真實標籤（事實檢驗、數學推導、程式碼執行行為）。此時共識的收斂具備客觀物理意義。
- 各 Agent 能夠存取不同的外部資料來源或工具鏈（具備實質異質性基礎）。
- 嚴格限制交鋒輪次（通常為 2-3 輪），且配備獨立的客觀裁判或驗證者。
- 運算預算允許配置 3-5 位 Agent。在圖狀拓撲中，一旦超過 5-7 位，協同稅將徹底吞噬所有收益。

### 何時「帶有辯論的投票」反受其害

- 問題屬於主觀審美或價值觀範疇。各 Agent 只會迅速向語氣看似最自信的那個答案妥協，而非客觀正確。
- 所有 Agent 共享完全相同的基底模型。單一文化同質盲點會讓全場共識毫無參考價值。
- 交鋒輪次無界限。從眾妥協偏見必定在每一次循環中呈指數級放大。
- 任務本身極度簡單直觀。單一 Agent 搭配 N=5 的自我一致性在成本上顯著便宜得多，且準確率毫不遜色。

```figure
sw-debate-topology
```

## Build It｜動手實作

`code/main.py` 完整實作了以下模組：

- `run_star(agents, hub, question)`——中心 Hub 輪詢每位工作者並進行聚合。
- `run_chain(agents, question)`——線性循序漸進精煉。
- `run_tree(root, children, question)`——具備深度 2 層聚合的階層式架構。
- `run_graph(agents, question, rounds)`——全聯通對等網路辯論，支援輪次硬性約束。
- 一個腳本化的異質性調節旋鈕：每位 Agent 皆被賦予特定的 `error_bias` 以模擬其系統性盲點。
- 一套基準測試套件：分別在 N=3、5、7 的規模下運作各拓撲，並即時回報 (accuracy, total_tokens, wallclock_simulated)。

執行指令：

```
python3 code/main.py
```

預期終端輸出：一張橫向對照的 拓撲結構 × N 規模 → (準確率, Token消耗, 延遲) 矩陣表格。在科研風格任務上，圖狀拓撲在 N=3-5 時奪冠；在快速事實任務上星狀拓撲最為敏捷；而當圖狀拓撲推進至 N=7 時，協同稅現象清晰可見（延遲與成本暴增的速度遠超準確率的微幅提升）。

## Use It｜實際應用

`outputs/skill-topology-picker.md` 是一項專業 skill，能通讀業務任務描述並精準輸出最佳設計建議：推薦最適拓撲（星狀／鏈狀／樹狀／圖狀）、最佳 Agent 數量 N、異質模型配比方案，以及嚴格的交鋒輪次上限。

## Ship It｜交付成果

任何多 Agent 整合系統推向正式環境前的架構鐵律：

- **始終以「單一強模型搭配 N=5 自我一致性」作為最初基準線。** 這是最廉價且強悍的底線。
- 若業務對準確率要求極高，**升級至 N=3 的異質模型投票**。精確量化測量其準確率增幅。
- 唯有當任務具備複雜的深層結構（深度科研、多步驟推理）且有條件嚴格限制輪次時，**才考慮導入全辯論拓撲**。
- **始終完整落盤記錄少數派群集。** 當少數派多次在事後被證明正確時，這正是系統捕捉到寶貴多樣性訊號的鐵證。
- **在評估準確率的同時，必須將端到端耗時與 Token 成本作為同等重要的衡量維度。** 「以 10 倍的成本換取微不足道的 1% 精度提升」本質上是一項嚴肅的商業決策，而非純技術炫技。

## Exercises｜練習

1. 執行 `code/main.py`。針對圖狀拓撲繪製協同稅曲線：以 N 為橫軸，分別繪製準確率與 Token 消耗。觀察曲線在 N 等於多少時發生了邊際效益拐點？
2. 實現 A-HMAD 機制：配置三個帶有刻意不同偏見的異質 Agent。對照第 14 課中的同質單一文化攻擊，評估 A-HMAD 相較於全同質基準線展現出了何種強悍的防禦優勢？
3. 在圖狀拓撲中引入一位不參與投票、專注為最終共識打分的獨立「裁判（Judge）」角色。這能否實質遏止自發湧現的從眾順從現象？
4. 閱讀 AgentVerse 論文（ICLR 2024）。分析你當前的實作中最容易湧現哪一種自發行為特質？能否僅透過調整系統 prompt 來誘發出相反的行為？
5. 閱讀 MultiAgentBench（arXiv:2503.01935）第 4 節（拓撲實驗）。挑選論文中的一項具體任務，利用本課的測試套件嘗試復現出「圖狀拓撲在科研任務上奪冠」的實測結論。

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Self-consistency | "Sample N times, vote" | Wang 2022. Single model, N temperature>0 samples, majority vote on reasoning paths. |
| Heterogeneity | "Different models" | Ensemble of different base models or prompt families. Breaks monoculture. |
| MAD | "Multi-agent debate" | Generic term for agents exchanging critiques over rounds. See Du 2023. |
| A-HMAD | "Adversarial Heterogeneous MAD" | MAD variant emphasizing different models + adversarial structure. |
| Topology | "Who talks to whom" | Star, chain, tree, graph. Determines information flow. |
| Coordination tax | "Diminishing returns" | Above ~4 agents on graph, cost grows faster than quality. |
| Volunteer behavior | "Unprompted help" | AgentVerse emergent pattern: an agent offers to take a step. |
| Conformity behavior | "Agreement under pressure" | AgentVerse emergent pattern: an agent aligns with a critic. |
| Jury | "Small specialized panel" | Sibyl-style ensemble with roles (examiner, context, scorer). |

## Further Reading｜延伸閱讀

- [Wang et al. — Self-Consistency Improves Chain of Thought Reasoning](https://arxiv.org/abs/2203.11171) — 單一模型自我一致性奠基之作。
- [Du et al. — Improving Factuality and Reasoning via Multiagent Debate](https://arxiv.org/abs/2305.14325) — 證明 Agent 數量與輪次各自具備獨立貢獻的權威論文。
- [MultiAgentBench / MARBLE](https://arxiv.org/abs/2503.01935) — 證明圖狀拓撲在科研上奪冠、鏈狀在管線上最優的拓撲基準測試。
- [Should we be going MAD?](https://arxiv.org/abs/2311.17371) — 揭示在相同預算下辯論往往劣於單純自我一致性的經典綜述。
- [AgentVerse (ICLR 2024)](https://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf) — 揭示自願承擔與從眾順從兩大自發湧現行為的經典文獻。
- [MARBLE repo](https://github.com/ulab-uiuc/MARBLE) — 官方基準測試參考實作儲存庫。
