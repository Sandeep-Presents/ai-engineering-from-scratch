# 投票、自我一致性與辯論拓撲結構（Voting, Self-Consistency, and Debate Topology）

> 最便宜的聚合方式：取樣 N 個獨立 Agent，進行多數決投票。Wang 等人於 2022 年提出的自我一致性（Self-consistency）對單一模型取樣 N 次，做的就是這件事。多 Agent 體系則進一步引入**異質性（Heterogeneous）** Agent，以打破單一文化的同質盲點——使用不同的基底模型、不同的 prompt、不同的溫度係數以及不同的上下文。除了多數決之外，辯論拓撲也很重要：MultiAgentBench（arXiv:2503.01935，ACL 2025）評估了星狀（Star）、鏈狀（Chain）、樹狀（Tree）與圖狀（Graph）的協同方式，發現**圖狀拓撲在研究任務上表現最佳**，但 Agent 超過約 4 個後，會出現「協同稅（coordination tax）」。AgentVerse（ICLR 2024）記錄了兩種自發湧現的行為模式——自願承擔與從眾順從——而從眾順從既能促成共識，也會帶來群體盲從（groupthink）的風險（見 Phase 16 · 24）。本課將描繪拓撲設計空間、實作各種變體，並衡量協同稅。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 14 (Consensus and BFT)
**Time:** ~75 minutes

## Problem｜問題

辯論可以提升推理準確率（accuracy）（Du 等人，arXiv:2305.14325）。但它也可能讓準確率下降。辯論是否有幫助，取決於四項結構性選擇：

1. 誰與誰對話（拓撲結構）。
2. 進行幾輪（Du 2023：輪次與 Agent 數量各自獨立有貢獻）。
3. Agent 是否異質（不同的基底模型能打破單一文化的系統性偏見）。
4. 是否存在對抗性的反方（盡可能有力地呈現對方論點 vs 稻草人論證）。

許多團隊若直接加上「讓 5 個 Agent 跑一遍並投票」，結果往往比單一 Agent 還差。這些失敗並非隨機，而是與拓撲結構和異質性設計直接相關。本課就是這張拓撲地圖。

## Concept｜核心概念

### 自我一致性：單一模型比較基準

Wang 等人於 2022 年發表《Self-Consistency Improves Chain of Thought Reasoning》：在 temperature > 0 的條件下對同一個模型取樣 N 次，並對所有推理路徑的最終答案做多數決投票。在 GSM8K 上，相較於單次貪婪解碼（greedy decode），N=40 的取樣帶來了可觀的提升。自我一致性是多 Agent 投票的單 Agent 前身。

限制：自我一致性只用單一基底模型，因此誤差天生相關。若模型有系統性偏差（bias），所有 N 個樣本都會共享該偏差。

### 多 Agent 投票：異質擴展體系

將 N 個同質樣本替換為 N 個**不同**的 Agent：使用不同的基底模型（Claude、GPT、Llama）、不同的角色 prompt，以及不同的工具存取權限。好處是誤差不相關。代價是各模型的成本不同，而且協調它們會增加額外開銷。

2026 年異質辯論的常用名稱為 **A-HMAD**——對抗性異質多 Agent 辯論（Adversarial Heterogeneous Multi-Agent Debate）。此名稱尚未普遍採用，但部分論文用它描述「不同模型彼此辯論，以減少單一文化崩潰造成的相關誤差」。

### 四種拓撲結構

```
star                chain               tree                graph

    ┌─A─┐           A─B─C─D         ┌──A──┐              A───B
    │   │                           │     │              │ × │
    B   C                           B     C              D───C
    │   │                          / \   / \
    D   E                         D   E F   G           (fully connected)
```

**星狀（Star）**：一個中心節點（Hub），其餘 Agent 只與中心節點通訊。等同於沒有旁路回饋通道的監督者-工作者架構。
**鏈狀（Chain）**：線性傳遞，每個 Agent 只看得到前一個 Agent 的輸出。類似管線（pipeline）。
**樹狀（Tree）**：階層式結構，用於階層式 Agent 系統（Phase 16 · 06）。
**圖狀（Graph）**：任意到任意（any-to-any）。包含全連通的完全子圖（clique），以及任意的有向無環圖（DAG）。

### 協同稅（Coordination Tax，MultiAgentBench）

MultiAgentBench（MARBLE，ACL 2025，arXiv:2503.01935）在包含研究、程式撰寫與規劃的任務集上，比較了星狀、鏈狀、樹狀與圖狀拓撲。主要實測結果：

- **圖狀拓撲（Graph）** 在研究任務上表現最佳。資訊可任意到任意地流動；Agent 能互相批判。
- **星狀拓撲（Star）** 在快速回答事實題的任務上表現最佳。中心 Hub 負責過濾與彙整。
- **鏈狀拓撲（Chain）** 在分階段逐步精煉（管線式）的任務上表現最佳。
- 在圖狀拓撲中，Agent 超過約 4 個後會出現**協同稅（Coordination tax）**。掛鐘時間與 token 成本的增長，會快於品質的提升。

約 4 個 Agent 的上限是實證觀察，而非根本限制。它反映了 2026 年 LLM 的上下文容量：每個 Agent 的上下文會被同儕的輸出填滿。一旦每個人都能看到所有其他人，加入第 N+1 個 Agent 的邊際價值就會下降。

### 多 Agent 辯論策略（《Should we be going MAD?》）

論文 arXiv:2311.17371 是 2023 年對 MAD 策略的綜述。其他研究也復現了一項發現：結構上與自我一致性相似（獨立取樣加聚合）的 MAD 變體，在相同預算下往往不如自我一致性。當 Agent 真正異質、且辯論具有對抗結構（有一個 Agent 持反方立場）時，MAD 的效益最大。

### AgentVerse 揭示的兩大湧現行為模式

AgentVerse (ICLR 2024, https://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf) 記錄了多 Agent 辯論中，即使沒有明確設計也會出現的兩種行為：

- **自願承擔行為（Volunteer behavior）。** 某個 Agent 未經提示便主動提供協助（「我可以負責下一步」）。這很有用：它會把子任務分配給最有能力的 Agent。
- **從眾順從行為（Conformity behavior）。** 某個 Agent 調整自己的立場以符合批判者，即使批判者是錯的。這是辯論中的諂媚現象（Phase 16 · 14）。

從眾是「辯論到達成一致為止」會獎勵霸凌者的原因。限制輪次並引入獨立裁判，有助於緩解此問題。

### 異質性（Heterogeneity）：真正影響準確率的旋鈕

2024 至 2026 年的實務文獻中有一個模式：把 N 個 Agent 之一換成完全不同的異質基底模型，帶來的準確率提升，比把同質 Agent 數量增加 1 個更大。其背後的直覺是打破單一文化的同質盲點：每一個新的獨立誤差來源，都比一個帶有相同系統性偏差的相關複製品更有價值。

在極端情況下，異質性勝過數量。在大多數具有明確真實標籤（ground truth）的任務上，三個不同模型勝過同一模型的五個複製品。

### 審議團機制（Jury Methods）

Sibyl 框架（在 Minsky-LLM 相關文獻中常被引用）將「審議團（Jury）」形式化：一組專門分工的異質 Agent 在各階段以投票逐步精煉答案。不同於簡單的多數決，審議團有明確的角色：一位負責交叉質詢、一位提供背景脈絡、一位評估方案的合理性（plausibility）。審議團介於「廉價但易受單一文化影響的簡單投票」與「昂貴且易生從眾的完整 MAD（多 Agent 辯論）」之間。

### 何時帶辯論的投票佔優勢

- 問題有真實標籤（事實查核、數學推導、程式碼執行行為）。此時投票收斂才有意義。
- Agent 能存取不同的外部資料來源或工具（異質性可用）。
- 輪次有限（通常 2–3 輪），且有獨立的裁判或驗證者。
- 預算允許 3–5 個 Agent。在圖狀拓撲中超過 5–7 個時，協同稅會佔主導。

### 何時帶辯論的投票會有害

- 問題屬於意見型。Agent 會向看起來最有信心的答案靠攏，而非最正確的答案。
- 所有 Agent 共享同一基底模型。單一文化會讓共識失去意義。
- 輪次無上限。從眾每一次都會佔上風。
- 任務很簡單。單一 Agent 搭配 N=5 的自我一致性，成本更低，準確率相同。

```figure
sw-debate-topology
```

## Build It｜動手實作

`code/main.py` 實作了以下模組：

- `run_star(agents, hub, question)`——中心 Hub 逐一詢問每位工作者並彙整結果。
- `run_chain(agents, question)`——線性循序漸進精煉。
- `run_tree(root, children, question)`——具備深度 2 層聚合的階層式架構。
- `run_graph(agents, question, rounds)`——全連通的對等網路辯論，支援輪次上限。
- 一個腳本化的異質性旋鈕：每個 Agent 都有 `error_bias`，表示其系統性錯誤。
- 一套測量框架：在 N=3、5、7 下執行各拓撲，回報 (accuracy, total_tokens, wallclock_simulated)。

執行指令：

```
python3 code/main.py
```

預期輸出：一張拓撲 × N → (準確率, token 數, 延遲) 的表格。在研究型任務上，圖狀拓撲於 N=3–5 時表現最好；在快速事實任務上，星狀拓撲表現最好；圖狀拓撲在 N=7 時會出現協同稅（延遲的增長快於準確率）。

## Use It｜實際應用

`outputs/skill-topology-picker.md` 是一個 skill，讀取任務描述後，推薦拓撲（星狀／鏈狀／樹狀／圖狀）、Agent 數量 N、異質性設定（要使用的基底模型），以及輪次上限。

## Ship It｜交付成果

任何多 Agent 整合系統的建議：

- 先用一個強的基底模型，以 **N=5 的自我一致性**作為起點。這是低成本的比較基準。
- 若準確率很重要，**升級為 N=3 的異質模型投票**，並量測其增幅。
- 只有在任務具有結構（研究、多步驟）且能限制輪次時，才升級為**辯論拓撲**。
- **一律記錄少數派群集。** 若少數派持續正確，就代表有多樣性訊號。
- **評估準確率時，也要同時量測掛鐘時間與 token。**「以 10 倍成本換取更高準確率」是商業決策。

## Exercises｜練習

1. 執行 `code/main.py`。針對圖狀拓撲繪製協同稅曲線：準確率對 N、token 對 N。曲線在哪個 N 出現轉折？
2. 實作 A-HMAD：三個刻意帶有不同偏見的異質 Agent。在 Phase 16 · 14 的 monoculture 攻擊下，全員偏差相同的基準組與 A-HMAD 相比如何？
3. 在圖狀拓撲中加入一個「裁判（Judge）」角色：它不投票，只為最終共識打分。這會改變自發的從眾順從行為嗎？
4. 閱讀 AgentVerse 論文（ICLR 2024）。判斷你的實作最明顯出現哪一種湧現行為？能否透過修改 prompt 引發相反的行為？
5. 閱讀 MultiAgentBench（arXiv:2503.01935）第 4 節（拓撲實驗）。選一個論文中的任務，用本課的測量框架重現「圖狀拓撲在研究任務上最佳」的結果。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| 自我一致性 | 取樣 N 次再投票 | Wang 2022。單一模型以 temperature > 0 取樣 N 次，對推理路徑的答案做多數決。 |
| 異質性 | 不同的模型 | 由不同基底模型或 prompt 系列組成的群體。能打破單一文化。 |
| MAD | 多 Agent 辯論 | 泛指 Agent 在多輪中交換批判的做法。見 Du 2023。 |
| A-HMAD | 對抗性異質 MAD | 強調不同模型與對抗結構的 MAD 變體。 |
| 拓撲 | 誰與誰對話 | 星狀、鏈狀、樹狀、圖狀。決定資訊如何流動。 |
| 協同稅 | 報酬遞減 | 圖狀拓撲中超過約 4 個 Agent 後，成本的增長快於品質。 |
| 自願承擔行為 | 未經提示的協助 | AgentVerse 的湧現模式：Agent 主動提出承擔一個步驟。 |
| 從眾順從行為 | 壓力下的附和 | AgentVerse 的湧現模式：Agent 向批判者靠攏。 |
| 審議團 | 小型專業評審團 | Sibyl 式的角色化群體（詰問者、背景提供者、評分者）。 |

## Further Reading｜延伸閱讀

- [Wang et al. — Self-Consistency Improves Chain of Thought Reasoning](https://arxiv.org/abs/2203.11171) — 單一模型比較基準
- [Du et al. — Improving Factuality and Reasoning via Multiagent Debate](https://arxiv.org/abs/2305.14325) — Agent 數量與回合數各自都有影響
- [MultiAgentBench / MARBLE](https://arxiv.org/abs/2503.01935) — 拓撲基準測試，顯示 graph 最適合研究、chain 最適合管線
- [Should we be going MAD?](https://arxiv.org/abs/2311.17371) — MAD 策略綜述；指出相同預算下 MAD 往往不如自我一致性
- [AgentVerse (ICLR 2024)](https://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf) — 湧現的志願與從眾模式
- [MARBLE repo](https://github.com/ulab-uiuc/MARBLE) — 基準測試參考實作
