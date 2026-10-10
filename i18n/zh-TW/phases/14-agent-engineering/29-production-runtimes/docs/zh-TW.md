# 生產級執行時期：佇列、事件與排程

> 正式環境的生產級 Agent 運行於六大典型執行時期形態之上：請求—回應、即時串流、持久化執行、基於佇列的背景任務、事件驅動與定時排程。在挑選任何具體框架之前，務必先確定執行時期形態。全鏈路可觀測性在每種形態下皆屬於不可妥協的生命線。

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 13 (LangGraph), Phase 14 · 22 (Voice)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 指出六大生產級執行時期形態，並將每種形態對映至相應的框架與架構模式。
- 深入解釋為何持久化執行（如 LangGraph）對超長路徑任務具備決定性意義。
- 描述事件驅動執行時期的架構特徵，以及 Claude Managed Agents 在何時最為適用。
- 闡述為何對於多步驟 Agent 而言，可觀測性屬於不可或缺的核心支柱。

## The Problem｜問題

生產級 Agent 往往在 Jupyter Notebook 永遠無法察覺的盲區發生崩潰：在第 37 步遭遇網路逾時中斷、使用者在語音通話中途掛斷、排程工作因實體伺服器重開機而意外陣亡、背景工作行程因記憶體耗盡而被 OOM 擊殺。底層的執行時期形態，直接決定了這些嚴重故障究竟能否被安全復原。

## The Concept｜核心概念

### 1. 請求—回應模式（Request-response）

- 同步 HTTP 阻塞呼叫。使用者端必須在線上等待直到全流程執行完畢。
- 僅適用於短時程任務（<30 秒）。
- 代表技術堆疊：Agno（Python + FastAPI）、Mastra（TypeScript + Express/Hono/Fastify/Koa）。
- 可觀測性：標準 HTTP 存取日誌 + OTel Spans。

### 2. 即時串流模式（Streaming）

- 採用 SSE 或 WebSocket 進行漸進式增量內容輸出。
- LiveKit 將此擴展至語音與視訊通訊的 WebRTC 領域（第 22 課）。
- 代表技術堆疊：任何支援串流的現代框架 + 具備處理 SSE/WS 能力的前端。
- 可觀測性：逐訊框時間戳記、首字延遲（TTFT）、長尾延遲。

### 3. 持久化執行模式（Durable execution）

- 狀態在每個步驟執行後自動保存檢查點；遭遇崩潰時自動自斷點平滑復原。
- AutoGen v0.4 的 Actor 模型將故障嚴密隔離在單一 Agent 內部（第 14 課）。
- LangGraph 最核心的王牌差異化特徵（第 13 課）。
- 當任務步驟總數未知、且重頭再來的代價極其高昂時為強制必備。

### 4. 基於佇列的背景任務模式（Queue-based / background）

- 任務進入訊息佇列，工作者行程集體競爭認領，結果透過 Webhook 或發布訂閱通道非同步回傳。
- 對於超長路徑 Agent 屬於強制必備（依據 Anthropic 發布 Computer Use 時的統計，單次任務耗費數十至數百個步驟屬於常態）。
- 代表技術堆疊：Celery（Python）、BullMQ（Node）、SQS + Lambda（AWS）、自建佇列。
- 可觀測性：佇列積壓深度、逐任務延遲分佈、死信佇列（DLQ）容量。

### 5. 事件驅動模式（Event-driven）

- Agent 監聽特定事件觸發：收到新郵件、PR 被建立、定時器觸發。
- Claude Managed Agents 開箱即用支援此模式（第 17 課）。
- CrewAI Flows（第 15 課）結構化編排事件驅動的確定性工作流程。
- 可觀測性：觸發來源出處、事件抵達到啟動執行的延遲、Agent 內部實質耗時。

### 6. 定時排程模式（Scheduled / Cron）

- 類似 Cron 的定時巡檢 Agent，按固定週期排程運行。
- 必須與持久化執行相結合，確保夜間失敗的批次任務在下一個週期能自斷點接續執行。
- 代表技術堆疊：Kubernetes CronJob + 具態框架；全託管平台（Render Cron、Vercel Cron）。

### 2026 年主流部署模式收斂

- **CrewAI Flows**：正式環境事件驅動工作流程的首選。
- **Agno**：適用於 Python 微服務的無狀態 FastAPI 後端。
- **Mastra**：伺服器適配器（Express、Hono、Fastify、Koa）用於直接整合進現有架構中。
- **Pipecat Cloud / LiveKit Cloud**：全託管即時語音後端（第 22 課）。
- **Claude Managed Agents**：雲端全託管的超長時段非同步運算。

### 可觀測性是不可妥協的生命線

若缺乏 OpenTelemetry GenAI Spans（第 23 課）搭配 Langfuse/Phoenix/Opik 後端（第 24 課），你根本無法排查在第 40 步崩潰的多步驟 Agent。這在正式環境中是不可妥協的紅線。它決定了你的團隊究竟是能「在數分鐘內精準定位修復」，還是只能「盲目加入更多 print 日誌並從頭碰運氣重跑」。

### 典型架構失效模式

- **挑選錯誤的執行時期形態**：為一個長達 5 分鐘的複雜任務挑選了同步的請求—回應模式。使用者頻繁逾時斷線、背景工作者嚴重塞車、前端重試雪崩堆疊。
- **缺乏死信佇列（DLQ）**：佇列工作者崩潰時缺乏死信轉存機制，失敗的任務在系統中憑空蒸發消失。
- **缺乏追蹤的黑箱背景運算**：背景 Agent 執行時完全未匯出 Trace 日誌；直到使用者憤怒客訴前，維運團隊對線上的大面積崩潰一無所知。
- **盲目略過持久化狀態**：任何執行時長超過 30 秒、且在業務上承受不起「從頭再來」代價的任務，若未採用持久化執行，皆屬於嚴重的架構失職。

```figure
wb-runtime-shapes
```

## Build It｜動手實作

`code/main.py` 以純 Python 標準函式庫演示了多種執行時期形態：

- 同步請求—回應端點（純函式）；
- 串流輸出處理常式（生成器 Generator）；
- 具備死信佇列（DLQ）的佇列工作者；
- 事件觸發註冊表；
- 定時排程器。

運行實驗：

```bash
python3 code/main.py
```

輸出會呈現五種形態在處理相同任務時的具體行為軌跡。完全相同的 Agent 業務邏輯，套上截然不同的外圍外殼。持久化執行模式（第六種形態）已在第 13 課透過 LangGraph 檢查點進行了深度實作。

## Use It｜實際應用

- **請求—回應**：適用於傳統即時問答交談。
- **即時串流**：適用於追求即時打字機視覺體驗的流暢互動。
- **持久化執行**：適用於步驟繁複的超長路徑任務。
- **佇列背景運算**：適用於批次處理、非同步調度、耗時超長的運算。
- **事件驅動**：適用於對外部刺激即時響應的反應型 Agent。
- **定時排程**：適用於系統內務維護（記憶體整理、離線評測、成本日誌報表）。

## Ship It｜交付成果

`outputs/skill-runtime-shape.md` 能為特定業務任務精準選定最合適的執行時期形態，並自動配置必備的可觀測性追蹤鷹架。

## Exercises｜練習

1. 將第 01 課的 ReAct 迴圈移植為你所熟悉的這六種執行時期形態。思考每種形態分別對應你產品中的哪項具體業務功能？
2. 為佇列演示程式新增實體死信佇列（DLQ）。人為模擬 10% 的任務隨機失敗；在終端印出 DLQ 的即時積壓數量。
3. 撰寫一個定時排程的評測 Agent：每晚定時啟動，自動評測當天線上採集到的前 20 條代表性 Trace。
4. 實作帶有背壓機制的串流處理：若用戶端消費緩慢，主動暫停 Agent 產出。該機制如何與回合預算上限相互協同？
5. 研讀 Claude Managed Agents 官方文件。在何種具體業務條件下，你願意將原本自建的長路徑 Agent 遷移至雲端全託管方案？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| Request-response | 「同步呼叫」 | 使用者端線上等待；嚴格僅適用於短時程任務 |
| Streaming | 「SSE / WS」 | 漸進式增量內容輸出；卓越體驗；逐訊框可度量延遲 |
| Durable execution | 「斷點續傳」 | 具備檢查點的狀態機；遭遇故障時精準自最後成功步驟復原 |
| Queue-based | 「背景排程任務」 | 生產者 / 工作者連線池 / 死信佇列架構 |
| Event-driven | 「事件觸發驅動」 | Agent 監聽並主動響應外部非同步事件 |
| DLQ | 「死信佇列」 | 專門暫存連續失敗任務供人工審計排查的專用隔離區 |
| Claude Managed Agents | 「雲端託管控端」 | Anthropic 官方託管、內建快取與自動壓縮的長時段非同步運算服務 |

## Further Reading｜延伸閱讀

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) ——持久化執行實踐手冊
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) ——雲端託管長任務指南
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) ——「單次任務數十至數百個步驟」之架構啟示
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) ——Actor 模型故障隔離解析
