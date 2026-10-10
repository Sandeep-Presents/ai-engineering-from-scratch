# 監督者／編排者-工作者模式（Supervisor / Orchestrator-Worker Pattern）

> 一位主導 Agent 負責統籌規劃與任務委派；多位專注特定領域的工作者（Worker）在彼此平行的獨立上下文中並行執行並匯報成果。這正是 Anthropic 的 Research 研究系統（由 Claude Opus 4 充當主導者，Sonnet 4 充當子 agent）背後的核心架構模式，其在內部科研評測中相較於單一 Agent Opus 4 取得了高達 +90.2% 的驚人效能提升。Anthropic 發布的工程技術文章指出：在 BrowseComp 評測中，高達 80% 的效能變異數僅由「Token 消耗總量」即可完全解釋——多 Agent 架構之所以能大獲全勝，本質上是因為每位子 Agent 皆獲得了一個全新且純淨的獨立上下文視窗。本課將基於底層原語親手實現監督者模式，並全面解析源自真實正式環境部署的 2026 年最新工程教訓。

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`)
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~75 minutes

## Problem｜問題

深度調研任務是單一 Agent 系統幾乎必然遭遇慘痛失敗的原型場景。當你提出：「在 2023 年至 2026 年間，多 Agent 系統究竟發生了哪些核心演進？」單一 Agent 只能依序讀取五篇學術論文，將論文原文塞滿大半個上下文視窗，然後試圖在同一個視窗內對所有內容進行交叉推理。當它讀到第五篇論文時，早已忘記了第一篇的細節。而且，它完全無法平行加速。

監督者模式徹底解決了這個痛點：由一位主導 Agent 負責擬定搜尋規劃，將每個子問題精準委派給專門的工作者，最後進行成果綜述提煉。每位工作者皆享有專屬於該單一具體子問題的獨立 200k token 上下文視窗。主導 Agent 永遠不需要通讀原始論文全文——它僅需閱讀由工作者所產出的高度濃縮摘要。

Anthropic 的正式環境 Research 系統在內部科研評測中相較於單一 Opus 4 錄得了 +90.2% 的巨大增幅。其工程團隊在報告中特別指出：在 BrowseComp 上，80% 的效能變異數*僅由 Token 消耗量即可完全解釋*。為每個子 Agent 配備全新純淨的上下文，正是該模式制勝的最核心物理機制。

## Concept｜核心概念

### 核心模式架構

```
                 ┌──────────────┐
                 │   Lead       │  plans, decomposes,
                 │  (Opus 4)    │  synthesizes
                 └──┬────┬───┬──┘
                    │    │   │
            ┌───────┘    │   └───────┐
            ▼            ▼           ▼
      ┌─────────┐  ┌─────────┐  ┌─────────┐
      │ Worker1 │  │ Worker2 │  │ Worker3 │
      │(Sonnet) │  │(Sonnet) │  │(Sonnet) │
      └─────────┘  └─────────┘  └─────────┘
         fresh       fresh        fresh
         context     context      context
```

主導 Agent 絕不直接閱讀原始資料。各工作者在主導 Agent 進行最終綜述之前，也絕不會看到彼此的中間過程。圖中的每一個箭頭，皆代表著一次傳遞精簡工件的結構化交接（handoff）。

### 為什麼該模式能取得壓倒性勝利

三大致勝物理機制：

1. **每位子 Agent 享有獨立純淨的上下文。** 負責深入調研「FIPA-ACL 歷史傳承」的工作者，完全不需要背負主導 Agent 在規劃階段所消耗的 40k token 雜訊。它享有完整的 200k 視窗，全心全意專注於解答這一個問題。
2. **透過 Prompt 實現極致專業化分工。** 主導 Agent 的系統 prompt 聚焦於「拆解與綜述」，而非「調研細節」。每位工作者的 prompt 則高度精簡：「找出 X 領域的具體變化」。聚焦的 prompt 自然產出聚焦的高品質成果。
3. **極致的平行加速。** 所有工作者並行運作。整體的端到端耗時近似於 `max(worker_times) + plan + synthesis`，而非各工作者耗時的無奈加總 `sum(worker_times)`。

### 來自正式環境的工程教訓（Anthropic 2025）

Anthropic 的技術文章總結了多項至今依然是 2026 年黃金標準的正式環境實戰教訓：

- **動態適配算力投入與查詢複雜度。** 面對簡單查詢：單一 agent 搭配 3-10 次工具呼叫足矣。面對複雜難題：動態喚醒 10 位以上 agent。主導 Agent 必須具備動態評估難度的能力，而非將複雜度估算踢給外層使用者。
- **由寬至窄逐步推進（Broad then narrow）。** 首先將大問題拆解為宏觀的寬泛子問題，隨後若特定子領域的初步答案展現出深度價值，再針對該子領域動態衍生更多工作者進行縱深挖掘。
- **彩虹部署架構（Rainbow deployments）。** Agent 屬於長時間執行且具備深層狀態的系統。傳統的藍綠部署（Blue-green）完全無法適用。Anthropic 採用彩虹部署：逐步滾動引入新版本，同時平滑等待舊版本自然排空終止。
- **Token 消耗具備主導地位。** 多 Agent 系統所消耗的 token 往往高達單一 Agent 的 15 倍。唯有當任務帶來的實質商業價值足以覆蓋此等高昂成本時，才應當啟用該模式。

### 圖原生架構的演進轉向

LangGraph 最初曾釋出名為 `langgraph-supervisor` 的高階輔助函式庫，封裝了 `create_supervisor` 等現成邏輯。到了 2025 年，LangChain 官方全面轉向推薦直接透過工具呼叫（tool-calling）來實現監督者模式，原因在於直接工具呼叫能賦予開發者更強大的控制權，能夠精準掌控*監督者究竟能看見哪些資訊*（上下文工程）。舊函式庫依然可用，但現代架構強烈建議採用原生工具呼叫形態。

### 典型的系統失效模式

- **主導者產生了荒謬的幻覺規劃。** 若主導 Agent 生成的子問題根本無法有效拆解原始問題的核心，工作者即使在各自領域進行了無比精確的調研，也只不過是在錯誤的目標上徒勞無功。
- **工作者過度發散探尋。** 若缺乏極其明確的邊界約束，工作者往往會偏離其被指派的子問題，引入大量無關雜訊，嚴重污染最終的綜述環節。
- **綜述衝突（Synthesis conflicts）。** 兩位工作者回傳了彼此矛盾的客觀事實。主導 Agent 此時必須要麼主動追加一輪提問進行交叉求證，要麼在最終報告中明確標註該分歧。無聲無息地私自挑選其中一方是危害最深重的致命失效：使用者將永遠無法獲知系統內部存在嚴重事實分歧。

### 何時監督者模式反而不適用

- **嚴格的循序相依任務。** 若第 2 步在物理上完全依賴第 1 步的輸出結果，平行運作將毫無用武之地。此時應果斷採用管線模式（例如 CrewAI Sequential、LangGraph 線性圖）。
- **單純直觀的簡單查詢。** 單一 Agent 處理得更快、成本顯著更便宜。在喚醒任何工作者之前，務必先執行主導者的「算力難度評估」。
- **需要嚴格確定性的場景。** 監督者模式高度依賴 LLM 的動態決策。當系統的可稽核性與確定性重播高於環境自適應時，靜態確定性執行圖無疑是更穩健的選擇。

```figure
supervisor-hierarchy
```

## Build It｜動手實作

`code/main.py` 透過 Python 標準函式庫的 `threading` 模組實現了一個協同三個平行工作者的監督者系統。主導 Agent 將使用者查詢拆解為多個子問題，各工作者並行執行各自的子任務，最後由主導 Agent 進行綜述。完全不依賴外部真實 LLM——工作者採用固定的腳本邏輯模擬資料抓取與摘要提煉。

核心結構解析：

- `Lead.plan(query)` 將大查詢精準拆解為 3 個子問題。
- `Worker.run(sub_q)` 回傳模擬的摘要結果（在正式環境中可對應任何具備工具呼叫能力的 agent）。
- `Lead.run(query)` 在獨立執行緒中非同步啟動各工作者，等待全部完成後進行最終綜述。

執行指令：

```
python3 code/main.py
```

輸出將完整展現任務規劃過程、帶有開始與結束時間戳記的平行工作者執行軌跡，以及最終綜述成果。你能直觀見證平行運作帶來的巨大時間節省：三個各自耗時 0.3 秒的工作者在約 0.35 秒內即全部並行完工，而非串聯耗損的 0.9 秒。

## Use It｜實際應用

`outputs/skill-supervisor-designer.md` 能接收使用者查詢並自動產出完備的監督者模式架構設計：包含主導系統 prompt、各工作者角色定義、子問題拆解邏輯準則，以及最終綜述樣板。在打造任何全新科研風格的 agent 系統之前，務必先使用該工具進行架構規劃。

## Ship It｜交付成果

在將監督者模式推向正式環境之前的自檢清單：

- **模型高低配對（Model pairing）。** 主導 Agent 必須採用具備頂尖推理能力的旗艦模型（例如 Opus 級別、`o3` 級別）。工作者則應採用速度更快、成本更低廉的模型（例如 Sonnet、`o4-mini`）。
- **工作者逾時熔斷（Worker timeout）。** 任何執行時間超過中位數 2 倍的工作者必須被果斷強殺；主導 Agent 要麼以更窄的範圍重新派生工作者，要麼直接基於現有成果繼續前進。
- **單一工作者 Token 配額上限。** 設置硬性上限（例如限制最多為預期綜述輸入的 10 倍），防止失控的無窮迴圈工作者燒乾團隊預算。
- **全鏈路可觀測性。** 完整追蹤主導者的規劃、每位工作者的工具呼叫，以及最終的綜述鏈條。這是展開任何事後稽核與除錯的唯一依據。
- **彩虹滾動部署。** 具備深層長時程狀態的 agent 必須採用漸進式的版本排空與替換，堅決杜絕粗暴的熱切換。

## Exercises｜練習

1. 執行 `code/main.py`，接著修改主導 Agent 邏輯使其衍生 5 位工作者而非 3 位。觀察端到端實際耗時的變化。在此展示中，當工作者數量增加至多少時，派生執行緒的系統開銷將會超過平行運作所帶來的時間紅利？
2. 實現工作者逾時機制：強殺任何執行時間超過 0.5 秒的工作者，並讓主導 Agent 僅依據剩餘成果完成綜述。你需要記錄何種可觀測性指標才能讓維運者明確獲知某位工作者已被強制切斷？
3. 為主導者的綜述步驟加入衝突偵測機制：若兩位工作者回傳了相互矛盾的答案，主導者應當主動在最終報告中凸顯該分歧，而非隨意挑選一方。在不呼叫額外 LLM 的前提下，你該如何實作矛盾偵測演算法？
4. 閱讀 Anthropic 的 Research 系統工程技術文章。列出三項本玩具展示若要真正推向正式環境運作所必須補齊的工程實踐。
5. 比較 LangGraph 舊版 `create_supervisor` 與當前官方推薦的原生工具呼叫架構。哪一種方案能賦予你對「監督者究竟能看到什麼」更強大的精準控制力？為什麼 Anthropic 明確規定僅將工作者的「子答案」傳入最終綜述，而堅決禁止將工作者原始的上下文細節全盤丟入？

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Supervisor | "Lead agent" | An orchestrator agent that plans, delegates, and synthesizes. Does not do the work itself. |
| Worker | "Subagent" | A focused agent invoked by the supervisor with narrow scope and its own context window. |
| Orchestrator-worker | "Supervisor pattern" | Same thing, different name. The 2026 literature uses both. |
| Fresh context | "Clean window" | A worker's context starts from its system prompt and assigned question, not the lead's history. |
| Rainbow deployment | "Gradual rollout" | Long-running stateful agents need versioned drain-and-replace, not blue-green. |
| Token dominance | "Context is the variable" | 80% of research-eval variance comes from total tokens used, not model choice, per Anthropic. |
| Scale effort | "Match agent count to complexity" | Lead estimates query difficulty, spawns 1 vs 10+ workers accordingly. |
| Synthesis conflict | "Workers disagree" | Two workers return contradictory facts; the lead must surface disagreement, not silently pick one. |

## Further Reading｜延伸閱讀

- [Anthropic engineering — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — 監督者模式在工業級正式環境落地運作的最權威參考文獻。
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — 工具呼叫型監督者模式當前已成為官方唯一首選推薦形態。
- [LangGraph supervisor reference](https://reference.langchain.com/python/langgraph-supervisor) — 傳統的高階輔助函式庫，在 2026 年既有系統中依然被廣泛維護。
- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) — 基於交接機制的監督者模式實作變體。
