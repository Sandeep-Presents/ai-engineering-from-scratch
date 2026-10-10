# Agent 的 Actor 模型：非同步訊息與強型別執行時期

> 將 Agent 視為 Actor（執行主體）：非同步訊息交換、事件驅動的處理常式、天然的故障隔離，以及原生的並發能力。AutoGen v0.4（微軟研究院，2025 年 1 月）圍繞此模型徹底重構了 Agent 編排體系；該框架目前處於維護模式，其生產繼任者為微軟 Agent 框架（Microsoft Agent Framework，2025 年 10 月公開預覽）。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 深入描述 Actor 模型：Agent 作為獨立 Actor、訊息作為唯一的行程間通訊（IPC）途徑、各 Actor 具備完全獨立的故障隔離邊界。
- 指出 AutoGen v0.4 的三大 API 架構層——Core（核心層）、AgentChat（聊天層）、Extensions（擴充層）及其各自職責。
- 闡明為何將「訊息投遞」與「訊息處理」解耦能帶來天然的高並發能力與卓越的系統容錯性。
- 以純 Python 標準函式庫實作極簡的 Actor 執行時期環境，並在其上運行一套雙 Agent 程式碼審查協同流程。

## The Problem｜問題

絕大多數現有的 Agent 框架皆是同步阻塞的：一個 Agent 生產資料，另一個 Agent 消費資料，全數綁定在同一條調用堆疊中。一旦某個環節崩潰，整條呼叫鏈瞬間全軍覆沒。並發處理只能作為事後硬湊的附加補丁；若要走向分散式叢集部署，往往需要重寫整套系統。

AutoGen v0.4 給出的架構解答：**擁抱經典的 Actor 模型。**每個 Agent 皆是一個擁有私有收件匣（Inbox）的獨立 Actor。訊息是彼此互動的唯一途徑。執行時期環境將訊息的「投遞」與「處理」徹底解耦。單一 Actor 的崩潰被嚴密隔離在自身內部。並發能力天生自帶。走向分散式部署僅需替換底層傳輸通道即可。

## The Concept｜核心概念

### Actors 核心特性

一個 Actor 具備以下特徵：

- **私有狀態（Private state）**：外部絕無法直接讀寫；
- **收件匣（Inbox）**：訊息排程佇列；
- **處理常式（Handler）**：`receive(message) -> effects`，其中副作用可以是「回覆」、「向其他 Actor 發送訊息」、「生成全新 Actor」、「更新自身狀態」或「終止自身」。

兩個 Actor 之間**絕不共享記憶體**。它們只能透過發送訊息進行互動。

### 三大 API 分層體系

AutoGen v0.4 將介面清晰劃分為三層：

1. **Core（核心層）**：底層 Actor 基礎設施。包含 `AgentRuntime`、`Agent`、`Message`、`Topic`。負責非同步訊息交換與事件驅動調度。
2. **AgentChat（聊天層）**：任務驅動的高階 API（取代 v0.2 的 ConversableAgent）。包含 `AssistantAgent`、`UserProxyAgent`、`RoundRobinGroupChat`、`SelectorGroupChat`。
3. **Extensions（擴充層）**：外部整合——OpenAI、Anthropic、Azure、工具集、記憶體系統。

### 為何解耦至關重要

在 v0.2 的舊模型中，調用 `agent_a.chat(agent_b)` 會同步阻塞 agent_a，直到 agent_b 執行完畢回傳。而在 v0.4 中，`send(agent_b, msg)` 僅將訊息放入 agent_b 的收件匣並立刻返回，由執行時期在背景非同步分派處理。這帶來了三大架構紅利：

- **故障隔離（Fault isolation）**：Agent B 崩潰完全不會拖垮 Agent A——執行時期會捕獲 B 的例外錯誤，並自主決定是重試、記錄日誌還是轉入死信佇列（Dead-letter Queue）。
- **天然高並發（Natural concurrency）**：線上允許多筆訊息同時在傳輸中；各 Actor 獨立並行消化自身的收件匣。
- **天然的分散式擴展性（Distribution-ready）**：無論 Actor 是位於同一行程內，還是部署在跨網路的另一台伺服器上，收件匣 + 傳輸層的抽象完全保持一致。

### 常見編排拓撲

- **RoundRobinGroupChat（輪詢群聊）**：多個 Agent 依固定順序輪流發言。
- **SelectorGroupChat（選擇器群聊）**：由專門的選擇器 Agent 依據上下文對話動態挑選下一個發言者。
- **Magentic-One**：微軟官方發布的旗艦多 Agent 團隊，專職處理網頁瀏覽、程式碼執行與檔案分析。完全建構於 AgentChat 之上。

### 可觀測性（Observability）

原生內建 OpenTelemetry 支援。每則訊息皆會發射追蹤 Span；工具呼叫完全遵循 2026 年 OTel GenAI 語意約定攜帶 `gen_ai.*` 屬性（第 23 課）。

### 當前維運狀態：維護模式

截至 2026 年初：AutoGen v0.7.x 維持穩定維護，適合研究與原型概念驗證。微軟的活躍開發重心已全面轉向其正式生產繼任者——**Microsoft Agent Framework**（2025 年 10 月 1 日公開預覽，預計 2026 年第一季末正式 GA）。AutoGen 的各項核心模式可無縫平滑遷移——因為 Actor 模型的本質精神歷久彌新。

```figure
actor-mailbox
```

## Build It｜動手實作

`code/main.py` 以純 Python 標準函式庫實作了一套極簡 Actor 執行時期：

- `Message`：強型別資料酬載，包含 `sender`、`recipient`、`topic` 與 `body`。
- `Actor`：抽象基礎類別，定義 `receive(message, runtime)` 介面。
- `Runtime`：事件迴圈，負責共享佇列排程、訊息投遞與故障隔離。
- 雙 Actor 協同演練：`ReviewerAgent` 審查程式碼，`ChecklistAgent` 核對檢查清單；兩者透過持續交換訊息達成共識。

運行實驗：

```
python3 code/main.py
```

日誌會清晰展示：訊息投遞流程、其中一個 Actor 人為觸發的模擬故障完全未影響另一個 Actor 運作，以及雙方最終順利收斂至一致裁決。

## Use It｜實際應用

- **AutoGen v0.4 / v0.7（維護模式）**：極度適合學術研究、原型驗證與多 Agent 模式探索。
- **Microsoft Agent Framework**：正式環境的生產級繼任者（2025 年 10 月預覽）；在全新 API 介面下貫徹完全相同的 Actor 模型思想。
- **LangGraph Swarm 拓撲**（第 13 課）：透過共享工具控制權交接實現的類似對等架構。
- **自建 Actor 執行時期**：適合需要對特定訊息中介層（如 NATS、RabbitMQ、gRPC）實施極致精細控管的團隊。

## Ship It｜交付成果

`outputs/skill-actor-runtime.md` 能為任何多 Agent 任務產出極簡的 Actor 執行時期鷹架與團隊模板（支援 RoundRobin 輪詢或 Selector 選擇器拓撲）。

## Exercises｜練習

1. 為系統新增死信佇列（Dead-letter Queue，DLQ）：當處理常式拋出例外時，將故障訊息暫存供人工排查。在此教學模型中，DLQ 被觸發的頻率如何？
2. 實作 `SelectorGroupChat`：由專門的選擇器 Actor 依據對話狀態動態決定由誰處理下一則訊息。
3. 實作分散式傳輸層：將記憶體內部的佇列替換為基於 HTTP 的 JSON 通訊伺服器，使各 Actor 能跨不同實體行程運行。
4. 為每則訊息綁定 OTel Span。遵循第 23 課標準發射 `gen_ai.agent.name` 與 `gen_ai.operation.name` 屬性。
5. 研讀 AutoGen v0.4 官方架構設計文章。將本課的教學實作移植為使用真實的 `autogen_core` API。思考在正式環境中你省略了哪些關鍵細節？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| Actor | 「智慧個體」 | 私有狀態 + 收件匣 + 處理常式；彼此完全不共享記憶體 |
| Message | 「通訊事件」 | 強型別酬載；Actor 之間互動協同的唯一法定途徑 |
| Inbox | 「郵箱佇列」 | 每個 Actor 專屬的待處理訊息佇列 |
| Runtime | 「Agent 宿主」 | 負責路由轉發訊息並隔離各類異常的事件迴圈 |
| Topic | 「發布訂閱主題」 | Actor 之間具備名稱的發布—訂閱廣播路由通道 |
| Fault isolation | 「任其崩潰」 | 單一 Actor 發生崩潰徹底被限制在內部，絕不影響其他 Actor |
| RoundRobinGroupChat | 「固定輪詢團隊」 | 多個 Agent 依嚴格固定順序輪流推進對話 |
| SelectorGroupChat | 「動態決策團隊」 | 由專責選擇器 Agent 依據上下文即時挑選下一個發言者 |
| Magentic-One | 「微軟基準多 Agent 隊伍」 | 官方整合網頁、程式碼與檔案操作的旗艦級多 Agent 參考架構 |

## Further Reading｜延伸閱讀

- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) ——微軟研究院官方重構架構解析
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) ——圖狀編排的對照參考架構
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) ——AutoGen 預設發射的 OTel 語意標準
