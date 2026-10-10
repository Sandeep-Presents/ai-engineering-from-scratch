# ReWOO 與 Plan-and-Execute：解耦規劃架構

> ReAct 在單一資料流中將思考與行動交替穿插；而 ReWOO 則將兩者徹底解耦：先在前置階段一次性生成完整規劃，隨後平行執行。此設計節省了 5 倍的 Token 消耗、在 HotpotQA 上提升了 4% 的準確率，並允許將規劃能力蒸餾至 7B 輕量模型中。Plan-and-Execute 將其通用化，而 Plan-and-Act 則將此模式擴展至複雜的長路徑網頁導航任務。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 深入闡明為何 ReWOO 的 Planner / Worker / Solver 三權分立架構，相較於 ReAct 的交替迴圈能顯著節省 Token 並大幅提升系統穩健度。
- 以純 Python 標準函式庫實作一套規劃有向無環圖（Plan DAG）、依相依性排序的拓撲執行器，以及負責綜合各工作者產物的求解器。
- 參照 Anthropic 於 2026 年提出的「五大工作流程模式」架構，準確決策任務應採用「先規劃後執行」還是「交替式 ReAct」。
- 識別在何種長路徑網頁或行動端任務中，必須採用 Plan-and-Act 的合成規劃資料方案。

## The Problem｜問題

ReAct 那種交替穿插「思考—行動—觀察」的動態迴圈固然直觀且具備彈性，但每一次工具呼叫皆必須背負先前累積的所有完整脈絡——包含過去每一次的思考歷程。隨著執行深度加深，Token 消耗量呈二次方急遽飆升。更致命的是：一旦某個工具在迴圈中途執行失敗，模型往往被迫在混亂的錯誤訊息中，從頭重新推導整套規劃。

ReWOO（Xu 等人，arXiv:2305.18323，2023 年 5 月）敏銳地洞察到了這點，並提出了一套全新架構賭注：在前置階段預先完成全域規劃、平行取得各項證據，最後在結尾階段綜合得出答案。單次 LLM 呼叫產出規劃、N 次工具呼叫收集證據（可高度平行發起）、單次 LLM 呼叫統籌求解。該架構以犧牲部分動態調整彈性（規劃在生成後保持靜態）為代價，換取了極高的 Token 利用效率與極度清晰的故障隔離邊界。

## The Concept｜核心概念

### 三大核心角色

```
Planner:  user_question -> [plan_dag]
Workers:  [plan_dag]     -> [evidence]        (tool calls, possibly parallel)
Solver:   user_question, plan_dag, evidence -> final_answer
```

Planner（規劃器）產出一張有向無環圖（DAG）。每個節點明確標註工具名稱、輸入參數，以及其所相依的先前節點輸出（例如 `#E1`、`#E2` 等參照）。Workers（工作者）依拓撲排序依序或平行執行各節點工具。Solver（求解器）負責將所有收集到的證據無縫拼裝為最終答案。

### 節省 5 倍 Token 的根本原因

ReAct 的 prompt 長度會隨著執行步驟呈線性遞增。到了第 10 步，prompt 內部塞滿了「思考 1 + 行動 1 + 觀察 1 + 思考 2 + 行動 2 + 觀察 2……」的龐大歷史，且每個中繼步驟皆在冗餘重複包含原始 prompt。

相對地，ReWOO 僅需支付：一次相對較大的規劃器 prompt、N 次輕量的獨立工作者工具呼叫（彼此完全無需承載先前的思維鏈），以及一次最終的求解器 prompt。在 HotpotQA 基準測試中，論文實測節省了約 5 倍的 Token 總消耗量，同時任務絕對準確率提升了 4 個百分點。

### 顯著提升的系統穩健度

在 ReAct 架構下，若第 3 個工具調用失敗，迴圈必須在即時對話串流中試圖自我糾錯。而在 ReWOO 架構下，Worker 3 僅需回傳一段錯誤字串；Solver 會在完整的原始規劃脈絡下通盤檢視該錯誤，並能從容進行優雅降級處置。故障被精確隔離於單一節點，而非污染整條對話歷史。

### 規劃器模型蒸餾（Planner Distillation）

該論文的第二大里程碑成果：由於規劃器在運作時完全不需要即時看到環境的實體觀察反饋，因此你可以使用 175B 旗艦教師模型產出的規劃日誌，將規劃能力有效蒸餾並 fine-tuning 至 7B 輕量模型中。由輕量模型專職負責產出結構化規劃，推論時完全無需動用昂貴的超大模型。這在 2026 年的正式環境中已成為標準架構實踐——許多生產級 agent 會採用小型模型規劃搭配大型模型執行，或反向組合。

### Plan-and-Execute 範式（2023）

LangChain 團隊於 2023 年 8 月將 ReWOO 的核心理念提煉並定名為 Plan-and-Execute 通用模式：前置規劃器輸出步驟清單，執行器依序運行各步驟，並可選配一個重規劃器（Replanner）在觀察到部分中繼結果後動態修正後續規劃。這在形態上比 ReWOO 更接近 ReAct（因為重規劃器將環境觀察重新引入了規劃流程中），但依然保留了顯著的 Token 節省優勢。

### Plan-and-Act 範式（Erdogan 等人，arXiv:2503.09572，ICML 2025）

Plan-and-Act 將該模式進一步推向長路徑的網頁與行動端 agent。其核心貢獻在於引入了合成規劃資料（Synthetic plan data）：利用標註軌跡產生器，主動產出帶有顯式規劃的訓練資料。這被廣泛用於調校各類規劃器模型，使其在類似 WebArena 等超過 30 至 50 步的超長任務中依然能保持思維內聚力，徹底解決了單一 ReAct 軌跡在長步驟下容易語意渙散迷航的難題。

### 架構選型決策標準

| 架構模式 | 最適用場景 |
|---|---|
| ReAct | 短路徑任務、未知探索環境、高度需要即時響應式例外處置 |
| ReWOO | 結構化任務、工具集合已知、對 Token 成本極度敏感、證據可高度平行抓取 |
| Plan-and-Execute | 類似 ReWOO，但在執行部分步驟後需要動態重新評估修正規劃 |
| Plan-and-Act | 超長路徑任務（>30 步）、網頁／行動端／Computer-Use |
| Tree of Thoughts | 值得付出高昂搜尋成本的複雜決策（詳見第 4 課） |

Anthropic 於 2024 年 12 月提出的黃金指導原則：始終從最簡單的方案出發。若任務本質僅是一次工具呼叫外加一段摘要，切勿過度設計採用 ReWOO；若任務是一項長達 40 步的深度研究課題，切勿僅靠單一 ReAct 迴圈硬撐。

```figure
rewoo-plan
```

## Build It｜動手實作

`code/main.py` 以純 Python 標準函式庫實作了一套極簡 ReWOO 系統：

- `Planner`：基於規則的規劃器，能依據 prompt 產出規劃 DAG。
- `Worker`：透過工具註冊表分派執行各節點的具體工具呼叫。
- `Solver`：負責讀取收集到的證據並綜合成最終答案的求解器。
- 相依性解析（Dependency Resolution）：將 `#E1` 等參照替換為先前 Worker 的實體輸出結果。

演示程式解決了問題：「法國首都的人口是多少（四捨五入至百萬）？」，採用兩步規劃：(1) 查詢首都名稱，(2) 查詢該城市人口，隨後交由求解器結算。

運行實驗：

```
python3 code/main.py
```

輸出會先完整呈現全域規劃，隨後展示 Worker 的執行結果，最後由 Solver 完成整合。對比其 Token 消耗量（程式會印出粗略的字元統計）與 ReAct 風格的交替運行——在此類結構化任務中，ReWOO 展現出壓倒性的效率優勢。

## Use It｜實際應用

LangGraph 將 Plan-and-Execute 作為標準配方提供（`create_react_agent` 用於 ReAct，自訂圖用於 plan-execute）。CrewAI 的 Flows 架構直接內建了此模式：你預先定義好各項任務，由 Flow DAG 自動按拓撲排程執行。Plan-and-Act 的合成資料方法目前主要見於學術前沿；而顯式規劃 DAG 的執行時期模式則已透過 LangGraph 與 CrewAI Flows 在正式環境廣泛落地。

## Ship It｜交付成果

`outputs/skill-rewoo-planner.md` 能在給定工具目錄的前提下，依據使用者請求自動生成合規的 ReWOO 規劃 DAG。在將工作移交給執行器之前，它會預先完整校驗該規劃（確保無環、所有參照皆能正確解析、引用的所有工具皆真實存在）。

## Exercises｜練習

1. 為互不相依的獨立規劃節點實作並行 Worker 執行。在一個包含 2 個平行群組的 6 節點 DAG 中，這能帶來多少時間延遲優勢？
2. 新增一個重規劃節點（Replanner）：當任何 Worker 回傳錯誤時自動觸發。要進行何種最小改動，才能將 ReWOO 無縫轉化為 Plan-and-Execute？
3. 將 `Planner` 替換為 7B 級別的輕量模型，同時讓 `Solver` 維持在頂級旗艦模型上。對比端到端的最終產物質量——這種架構切分在何種情況下會最先失效？
4. 研讀 ReWOO 論文第 4 節關於規劃器蒸餾的內容。在觀念上推演如何復現 175B -> 7B 的成果：需要建構何種訓練資料庫？該如何量化評估規劃品質？
5. 將此教學玩具移植為 Plan-and-Act 的軌跡形態：將規劃表示為循序序列而非有向無環圖。兩者之間的工程權衡產生了何種轉變？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| ReWOO | 「無觀察推論」 | 先規劃、平行收集證據、最後統籌求解——規劃 prompt 中完全不包含環境觀察 |
| Plan-and-Execute | 「LangChain 規劃執行範式」 | 在 ReWOO 基礎上，於各步執行後可選配重規劃節點的增強模式 |
| Plan-and-Act | 「規模化規劃執行」 | 引入合成規劃資料訓練專屬規劃器，專門處理長路徑任務的進階模式 |
| Evidence reference | 「#E1, #E2, ...」 | 規劃節點內部的佔位符號，於執行分派時動態替換為先前 Worker 的實體輸出 |
| Planner distillation | 「輕量規劃器 + 旗艦執行器」 | 利用大型教師模型產出的規劃軌跡，將規劃能力蒸餾至輕量模型中 |
| Token efficiency | 「更少往返消耗」 | 在 HotpotQA 基準測試中，ReWOO 相較於 ReAct 實現了 5 倍的 Token 節省 |
| DAG executor | 「拓撲調度器」 | 依相依關係嚴格依拓撲順序執行規劃節點，在同層級自動實施平行調度 |

## Further Reading｜延伸閱讀

- [Xu et al., ReWOO: Decoupling Reasoning from Observations (arXiv:2305.18323)](https://arxiv.org/abs/2305.18323) ——ReWOO 奠基權威論文
- [Erdogan et al., Plan-and-Act (arXiv:2503.09572)](https://arxiv.org/abs/2503.09572) ——引入合成規劃的大規模長路徑規劃執行論文
- [LangGraph Plan-and-Execute tutorial](https://docs.langchain.com/oss/python/langgraph/overview) ——主流框架官方實戰教學
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) ——如何挑選最簡單有效的架構模式
