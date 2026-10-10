# Anthropic 工作流程模式：化繁為簡的工程哲學

> Schluntz 與 Zhang（Anthropic，2024 年 12 月）明確劃分了工作流程（預定義路徑）與 Agent（動態工具調用）的本質區別。五大工作流程模式足以覆蓋絕大多數真實業務場景。始終從直接的 API 呼叫出發；唯有在步驟完全無法預測時，才引入自主 Agent。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 指出 Anthropic 定義的五大工作流程模式：Prompt 鏈結（Prompt chaining）、意圖路由（Routing）、平行化（Parallelization）、協調者—工作者（Orchestrator-workers）與評估者—最佳化者（Evaluator-optimizer）。
- 深入闡明工作流程與自主 Agent 的本質差異，以及兩者各自的工程維運代價。
- 準確識別在何種場景下應當優先選擇工作流程而非 Agent（反之亦然）。
- 以純 Python 標準函式庫對照腳本化 LLM 完整實作這五大模式。

## The Problem｜問題

當前許多工程團隊在面對本質上只需單一函式呼叫的簡單問題時，往往盲目引入龐大的多 Agent 框架。其背後的代價極其高昂：上層框架引入了層層抽象，嚴重模糊了原始 Prompt、掩蓋了真實的控制流程，並過早引入了非必要的複雜性。Schluntz 與 Zhang 於 2024 年 12 月發布的文章是業界最具影響力的理性發聲：**始終從簡潔出發，唯有在複雜性確實能帶來超額回報時，才允許引入複雜架構。**

## The Concept｜核心概念

### 工作流程（Workflows）vs 自主 Agent（Agents）

- **工作流程（Workflow）**：透過預定義的程式碼路徑來編排 LLMs 與工具調用。**由軟體工程師全權掌控執行圖（The engineers own the graph）。**
- **自主 Agent（Agent）**：由 LLMs 自主動態決定調用何種工具並自主推進執行步驟。**由大模型全權掌控執行圖（The model owns the graph）。**

兩者皆有其獨特價值。工作流程成本更低、速度更快，且極易進行單元測試與除錯。自主 Agent 則能解鎖開放性的未知探索難題，但其失效模式極難進行形式化推理。

### 增強型大模型（The Augmented LLM）

所有五大模式的共同原子基石：單一 LLM 深度整合三大外圍能力——搜尋檢索（Retrieval）、工具呼叫（Actions）與記憶體（Persistence）。任何常規 API 呼叫皆能直接享用這些能力。

### 五大核心架構模式

1. **Prompt 鏈結（Prompt chaining）**：呼叫 1 的輸出直接作為呼叫 2 的輸入。適用於任務具備清晰線性分解的場景。支援在步驟之間插入程式化檢驗卡點。
2. **意圖路由（Routing）**：由分類器 LLM 判斷應當調用哪條下游鏈或特定工具。適用於不同類型的輸入需要截然不同的專業處置時（例如一線客服、退款申請、技術錯誤、銷售諮詢）。
3. **平行化（Parallelization）**：並發發起 N 個 LLM 呼叫，隨後聚合結果。包含兩種形態：**分段處理（Sectioning）**（分別處理不同區塊）與**投票表決（Voting）**（同一 Prompt 運行 N 次，取多數決或進行綜合提煉）。
4. **協調者—工作者（Orchestrator-workers）**：由協調者 LLM 動態決定啟動哪些專業工作者（Worker LLMs），並綜合彙整其輸出產物。雖然類似 Agent 迴圈，但協調者絕不進行無休止的漫無目的循環。
5. **評估者—最佳化者（Evaluator-optimizer）**：一個 LLM 產出方案初稿，另一個 LLM 進行獨立評估。交替迴圈直到評估者批准通過。這正是 Self-Refine（第 5 課）的通用化實踐。

### 工作流程優於 Agent 的場景

- **具備可預測性的確定性任務**：若你能窮舉所有操作步驟，你就應當將其寫死在程式碼中。
- **成本受嚴格約束的任務**：工作流程具備嚴格受限的步驟上限；而 Agent 迴圈極易失控螺旋上升。
- **合規審計嚴密的任務**：合規審計人員希望閱讀靜態清晰的程式碼流程圖，而非在海量動態軌跡中費力揣摩。

### Agent 優於工作流程的場景

- **開放性深度研究**：下一步該做什麼，完全取決於上一步實體回傳了何種資訊。
- **執行時長高度可變的任務**：任務可能耗費數分鐘至數小時，具體步驟數事先完全未知。
- **探索全新業務領域**：當前尚不清楚最佳工作流程為何——先由 Agent 進行自由探索，日後再沉澱固化為工作流程。

### 伴隨的脈絡工程學（Context Engineering）

Anthropic 於 2025 年發布的《Effective context engineering for AI agents》正式規範了其孿生學科：200k 視窗是一筆有限的預算，而非無底洞垃圾桶。清楚界定該納入什麼、何時實施壓縮、何時允許脈絡自然增長。

```figure
workflow-chain
```

## Build It｜動手實作

`code/main.py` 對照腳本化模型 `ScriptedLLM` 實作了全部五大工作流程模式：

- `prompt_chain(input, steps)`：循序鏈結調用。
- `route(input, classifier, handlers)`：分類判斷與動態分派。
- `parallel_vote(prompt, n, aggregator)`：N 次並發呼叫並聚合結果。
- `orchestrator_workers(task, workers)`：由協調者靈活挑選工作者。
- `evaluator_optimizer(task, proposer, evaluator, max_iter)`：迭代修正直到評估者通過。

運行實驗：

```
python3 code/main.py
```

每個模式皆會印出其乾淨清晰的執行軌跡。每個模式的核心程式碼僅約 10 至 15 行；而引入笨重第三方框架的程式碼量往往高達數千行。

## Use It｜實際應用

- 對於絕大多數日常工程任務，直接使用原生 API 呼叫。
- 唯有在工作流程確實需要持久化狀態機（LangGraph）、Actor 模式並發通訊（AutoGen v0.4）或高度角色模板化（CrewAI）時，方可考慮引入上層框架。
- 當你需要 Claude Code 那種標準工程控端架構而不想從零手寫時，可直接採用 Claude Agent SDK。

## Ship It｜交付成果

`outputs/skill-workflow-picker.md` 是一項實用技能。給定特定任務描述，它能自動推薦最佳的工作流程模式，提供清晰的決策論證，並指出當工作流程面臨瓶頸時通往自主 Agent 的平滑重構路徑。

## Exercises｜練習

1. 為路由模式實作置信度閾值控制：低於閾值時自動升級交由人工客服處理。在一線客戶服務情境中，該閾值應當設定在何處？
2. 為 `parallel_vote` 新增逾時控制機制。當其中一次呼叫掛起卡死時，系統應當如何應對？在部分投票缺漏的情況下該如何優雅聚合？
3. 將 `evaluator_optimizer` 改造為多臂老虎機（Bandit）架構：跨迭代保留 Top-2 最優產物，防止後期劣質結果意外覆寫了前期的優秀輸出。
4. 結合 Prompt 鏈結與意圖路由：由路由器自三條獨立鏈中挑選一條。對比其 Token 總開銷與單一龐大 Prompt 的成本差異。
5. 檢視你目前團隊中的一項生產級功能。繪製其工作流程圖。統計步驟數。捫心自問：此處若換成自主 Agent，系統真的會變得更好嗎？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| Workflow | 「預定義工作流程」 | 由軟體工程師全權掌控的 LLM 與工具呼叫有向圖 |
| Agent | 「自主 AI」 | 由大模型全權掌控的動態呼叫圖；自主決定工具調用 |
| Augmented LLM | 「帶工具的 LLM」 | 單一 LLM + 搜尋 + 工具 + 記憶體；系統最基礎的原子單元 |
| Prompt chaining | 「循序鏈結呼叫」 | 第 N 次呼叫的輸出直接作為第 N+1 次呼叫的輸入 |
| Routing | 「分類器意圖分派」 | 依據輸入分類動態挑選最適當的下游鏈或模型處理 |
| Parallelization | 「並發分流」 | 同時發起 N 次並行呼叫；透過分段（Sectioning）或投票（Voting）聚合 |
| Orchestrator-workers | 「調度者—工作者」 | 協調者 LLM 動態指揮多個專業專家 LLM 協同工作 |
| Evaluator-optimizer | 「提案者 + 審核者」 | 提案者與評估者交替循環直到驗收通過；Self-Refine 的通用化模式 |

## Further Reading｜延伸閱讀

- [Anthropic, Building Effective Agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) ——五大工作流程模式權威指南
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) ——脈絡工程孿生學科
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) ——何時狀態圖架構真正物有所值
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) ——協調者—工作者模式的產品化實踐
