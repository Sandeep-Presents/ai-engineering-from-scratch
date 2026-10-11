# 長時間背景執行 Agent：持久化執行（Durable Execution）

> 正式環境中的長時程 agent 絕不會跑在簡單的 `while True` 迴圈中。每一次 LLM 呼叫都會被封裝為一個具備檢查點（checkpoint）、重試機制與重播能力（replay）的活動（activity）。Temporal 與 OpenAI Agents SDK 的官方整合於 2026 年 3 月正式進入 GA 階段。Anthropic 推出的 Claude Code Routines 能夠在無需維持本地常駐行程的情況下，排程執行 Claude Code 呼叫。系統會在等待人類輸入時優雅暫停、安然度過服務重新部署，並從以 `thread_id` 為鍵的最新檢查點恢復執行。在這套嶄新工程體驗的背後，實質上是一套成熟悠久的經典架構——工作流程編排（workflow orchestration）——外加一項全新特性：將 LLM 呼叫視為具備非確定性、但可在系統復原時依據歷史日誌確定性重播的活動。

**Type:** Learn
**Languages:** Python (stdlib, minimal durable-execution state machine)
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 01 (Long-horizon agents)
**Time:** ~60 minutes

## The Problem｜問題

設想一個需要連續執行四小時的 agent。它依序呼叫了三個工具、向使用者提出了兩次確認詢問，並發起了四十次 LLM 呼叫。運作到一半時，其所在的主機突然重新開機。此時會發生什麼事？

- 在單純的 `while True` 迴圈中：一切狀態瞬間歸零。整個執行流程必須從頭重跑。那三個帶有實質外部副作用的工具呼叫會被重複執行。使用者會被迫重新確認他們早已核准過的事項。而那四十次昂貴的 LLM 呼叫也將被重新計費。
- 在持久化執行架構中：執行流程會精確從最近一次的檢查點自動恢復。早已順利完成的各項活動絕不會重複執行；它們的產出結果會直接從持久化日誌中快速重播。使用者無需重複審核已核准事項，且已完成的 LLM 呼叫絕不會產生重複帳單。

這正是工作流程引擎（如 Temporal、Cadence、Uber Cherami）在過去十年間被廣泛驗證的成熟模式。當前的全新突破在於：LLM 呼叫本質上正是一種標準的活動——具備非確定性、耗費高昂成本且伴隨外部副作用——因而能與此架構模式完美契合。

貫穿本課的核心主題：長時程的可靠度會隨時間嚴重衰減（METR 觀察到顯著的「35 分鐘效能衰退」現象——成功率會隨時程拉長呈近似二次方的速度急遽暴跌）。持久化執行讓系統具備了超越其原生可靠度極限的持續運作能力；這意味著如果架構設計得當，它能讓系統在安全邊界內優雅失效，但若設計失誤，則會引發更加嚴重的災難性後果。

## The Concept｜核心概念

### 活動（Activity）、工作流程（Workflow）與重播機制（Replay）

- **工作流程（Workflow）**：確定性的編排協同程式碼。負責定義各項活動的執行順序、條件分流路徑與等待事件。其邏輯必須具備嚴格的確定性，以便能精準依據事件日誌進行無歧義的狀態重播。
- **活動（Activity）**：具備非確定性且隨時可能遭遇失敗的最小工作單元。例如 LLM 呼叫、工具呼叫、檔案寫入或發起 HTTP 請求。每個活動在啟動時會記錄其輸入參數，完成時則記錄其輸出結果。
- **事件日誌（Event log）**：持久化的底層儲存庫。完整記錄每項活動的啟動、成功、失敗、重試，以及工作流程所做出的每一次決策轉折。
- **重播機制（Replay）**：當系統從崩潰中復原時，工作流程程式碼會從最開頭重新執行；所有在歷史日誌中已標記完成的活動，會直接回傳記錄好的快取結果而無需重新執行。唯有尚未完成的活動才會真正被發送執行。

這與 React 依賴虛擬 DOM（Virtual DOM）進行高效重新渲染，或 Git 依據 commit 歷史還原工作目錄有著異曲同工之妙。正是協同編排器的確定性，讓高可靠的持久化變得極其廉價。

### 為什麼 LLM 呼叫完全契合此模式

LLM 呼叫具備以下典型特質：
- 高度非確定性（temperature > 0；即便設為 0，不同模型版本之間依然存在輸出漂移）。
- 成本高昂（消耗真實美元與顯著的網路延遲）。
- 隨時可能失敗（觸發 API 速率限制、網路逾時等）。
- 伴隨外部副作用（若模型決定呼叫實體工具）。

這與分散式系統中的「活動」特徵完全吻合。將每一次 LLM 呼叫封裝為獨立活動，系統便能免費獲得指數型退避重試、跨當機自動建立檢查點，以及用於除錯的可重播完整軌跡。

### 以 `thread_id` 為鍵的檢查點機制

LangGraph、微軟 Agent Framework、Cloudflare Durable Objects 與 Claude Code Routines 不約而同地收斂至相同的 API 設計：使用 `thread_id`（或等效鍵值）標識特定 session；每一次狀態躍遷都會被持久化儲存至後端儲存庫（正式環境預設採用 PostgreSQL，本機開發採用 SQLite，快取層採用 Redis）；系統重啟時則依鍵載入最新的檢查點。

後端儲存庫的架構選型至關重要：

- **PostgreSQL**：具備強持久化、支援富查詢、能安然承受服務重新部署。為 LangGraph 的預設選擇。
- **SQLite**：僅適用於本機開發環境；無法在分散式多主機架構下保留資料。
- **Redis**：讀寫極為飛快，但除非明確配置 AOF 或定期快照，否則本質上屬於暫態儲存。
- **Cloudflare Durable Objects**：天然的分散式架構；依據唯一鍵值進行範圍約束；可穩定維持數小時乃至數週的持久狀態。

### 將「人類輸入」視為一等公民狀態

先提議後確認寫入（第 15 課）模式高度依賴一個具備持久化特性的「等待人類確認」狀態。工作流程在此刻優雅休眠，外部佇列妥善保存待審核請求，一旦人工確認到達，系統便能從該斷點精準喚醒並接續運作。若缺乏持久化架構，這項能力僅能仰賴聽天由命的最佳努力（best-effort）；而配備了持久化執行後，即便核准指令在深夜到達，工作流程也能在隔天清晨完美接棒。

### 35 分鐘效能退化規律

METR 的實測研究表明：在受測的所有 agent 類別中，一旦連續自主運作超過約 35 分鐘，其整體可靠度就會呈現斷崖式衰退。任務時程每延長一倍，系統失敗率就會呈近似四倍的態勢暴增。持久化執行無法從本質上消除這項衰退規律；它所做的是讓系統得以運作超出其原生可靠度所能支撐的時間長度。標準的安全實踐，是將持久化執行與「在重新喚醒時強制要求人類重新審查（HITL）」以及「不管實際耗時多久皆嚴格限制總算力上限的預算斷路器（第 13 課）」相結合。

### 何時持久化執行反而是錯誤的過度設計

- 僅需執行數分鐘且毫無人類互動環節的短任務。此時持久化架構的額外開銷遠大於收益。
- 嚴格受限於唯讀操作的純資訊檢索任務。
- 正確性強烈依賴在單一上下文視窗內一氣呵成完成的任務（特定複雜推理或單次生成任務）。

```figure
memory-consolidation
```

## Use It｜實際應用

`code/main.py` 透過 Python 標準函式庫實現了一個最小可行持久化執行引擎。它支援：

- 一個 `@activity` 裝飾器，負責將輸入與輸出即時記錄至 JSON 事件日誌中。
- 一個負責將各項活動依序串聯的工作流程函式。
- 一個 `run_or_replay(workflow, event_log)` 函式，能精準重播已完成活動而無需重複執行。

驅動程式會模擬一個包含三項活動的工作流程，在執行到一半時模擬當機崩潰，並生動對比：(a) 單純粗暴重試會重複執行所有動作，相對於 (b) 重播機制僅會精準補跑那項尚未執行的遺漏活動。

## Ship It｜交付成果

`outputs/skill-durable-execution-review.md` 能針對所提議的長時程 agent 部署方案進行全面架構審查：評估活動劃分粒度、編排確定性、檢查點後端選型、人類輸入狀態管理，以及重新喚醒時的 HITL 審查政策。

## Exercises｜練習

1. 執行 `code/main.py`。仔細比對粗暴重試與智慧重播在「活動執行次數」上的具體差異。調整崩潰發生的時機點，觀察重播計數如何隨之精準變化。

2. 改寫該玩具引擎，使其明確支援以 `thread_id` 進行隔離。模擬兩個共享同一個引擎核心的並行 session，驗證其事件日誌絕不會發生碰撞交織。

3. 從玩具引擎中挑選一項活動。在工作流程決策中引入一個非確定性因素（例如讀取系統的即時時間戳記）。展示這會在重播時引發何種狀態分歧。說明真實的工業級引擎是如何防禦此問題的（透過註冊外部副作用、提供 `Workflow.now()` API 等）。

4. 閱讀 LangChain 發布的《Runtime Behind Production Deep Agents》技術專案。列出該執行環境所持久化的每一項狀態，並具體指出各項狀態分別涵蓋了哪一類失效模式。

5. 為一個長達 6 小時的自主程式碼編寫任務設計檢查點策略。你會在何處建立檢查點？崩潰後的喚醒復原流程長什麼樣？哪些關鍵步驟必須強制重新取得人類確認？

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|---|---|---|
| Workflow | "Agent's script" | Deterministic orchestration code; replayable from event log |
| Activity | "A step" | Non-deterministic unit (LLM call, tool call); logged before and after |
| Event log | "The backing store" | Durable record of every state transition |
| Replay | "Resume" | Re-run workflow; completed activities return logged results without re-execution |
| Checkpoint | "Save point" | Persisted state keyed by thread_id; latest-wins on resume |
| thread_id | "Session key" | Identifier that scopes durable state |
| 35-minute degradation | "Reliability decay" | METR: success rate drops ~quadratically with horizon |
| Non-determinism | "Drift on replay" | Wall clock, random, LLM output; must be registered as side effect |

## Further Reading｜延伸閱讀

- [Anthropic — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) — 預算控制、對話輪次與喚醒語意。
- [Microsoft — Agent Framework: human-in-the-loop and checkpointing](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — RequestInfoEvent 狀態結構設計。
- [LangChain — The Runtime Behind Production Deep Agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) — 正式環境執行環境的具體需求清單。
- [OpenAI Agents SDK + Temporal integration (Trigger.dev announcement)](https://trigger.dev) — 將 LLM 呼叫視為標準活動的工程典範。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 針對 35 分鐘效能衰退規律的權威分析。
