# A2A — Agent-to-Agent 協定

> MCP 是「Agent 到工具」（Agent-to-tool）；A2A（Agent2Agent）則是「Agent 到 Agent」（Agent-to-agent）——一項讓建構於不同框架上的不透明（opaque）agent 能夠相互協作的開放協定。由 Google 於 2025 年 4 月發布、2025 年 6 月捐贈給 Linux 基金會，並於 2026 年 4 月邁向 v1.0，獲得包含 AWS、Cisco、Microsoft、Salesforce、SAP 與 ServiceNow 等 150 多家機構支援。它整併了 IBM 的 ACP，並新增了 AP2 支付擴充功能。本課將透過 A2A 1.0.1 線路傳輸名稱，完整走過 Agent Card、Task 生命週期與三大協定綁定模式。

**Type:** Build
**Languages:** Python (stdlib, Agent Card + Task harness)
**Prerequisites:** Phase 13 · 06 (MCP fundamentals), Phase 13 · 08 (MCP client)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 嚴格區分「Agent 到工具」（MCP）與「Agent 到 Agent」（A2A）的適用場景。
- 於 `/.well-known/agent-card.json` 發布包含 skills 與 `supportedInterfaces` 後設資料的 Agent Card。
- 完整走過 Task 生命週期：`TASK_STATE_SUBMITTED`、`TASK_STATE_WORKING`、`TASK_STATE_INPUT_REQUIRED`，以及終態 `TASK_STATE_COMPLETED`、`TASK_STATE_FAILED`、`TASK_STATE_CANCELED`、`TASK_STATE_REJECTED`。
- 掌握 Part 分別封裝 `text`、`raw`、`url` 或 `data` 之一的 Messages 訊息結構，並以 Artifacts 作為最終輸出產物。

## The Problem｜問題

假設有一個客服 agent 需要將撰寫報告的工作委派給專門的寫作 agent。在 A2A 出現之前的既有選項：

- 自訂 REST API：雖然可行，但每對 agent 之間的整合都是一次性的特化工作。
- 共享程式碼庫：強制兩個 agent 必須運行於完全相同的底層框架之上。
- MCP：定位不符：MCP 是為呼叫外部工具而設計，並非讓兩個各自保留不透明內部推論過程的 agent 進行對等協作。

A2A 填補了這項架構鴻溝。它將互動抽象為：一個 agent 向另一個 agent 發送帶有生命週期、訊息串與產物的 Task（任務）。被呼叫的 agent 內部狀態始終保持不透明——呼叫端只能觀察到任務狀態的轉移與最終產出的產物。

A2A 正是「讓跨框架的各類 agent 彼此交談」的通用通訊協定。它並非用來取代 MCP；兩者在架構上高度互補。

## The Concept｜核心概念

### Agent Card

每個符合 A2A 規範的 agent 皆會在根目錄的 `/.well-known/agent-card.json` 發布一張專屬名片：

```json
{
  "name": "research-agent",
  "description": "Summarizes academic papers and drafts citations.",
  "version": "1.2.0",
  "supportedInterfaces": [
    {
      "url": "https://research.example.com/a2a",
      "protocolBinding": "JSONRPC",
      "protocolVersion": "1.0"
    }
  ],
  "capabilities": {"streaming": true, "pushNotifications": true},
  "securitySchemes": {
    "bearer": {"httpAuthSecurityScheme": {"scheme": "Bearer"}}
  },
  "securityRequirements": [{"schemes": {"bearer": {"list": []}}}],
  "defaultInputModes": ["text/plain"],
  "defaultOutputModes": ["text/markdown"],
  "skills": [
    {
      "id": "summarize_paper",
      "name": "Summarize a paper",
      "description": "Read a paper PDF and produce a 3-paragraph summary.",
      "tags": ["research", "summarization"],
      "inputModes": ["text/plain", "application/pdf"],
      "outputModes": ["text/markdown"]
    }
  ]
}
```

服務發現基於標準 URL：先拉取該名片，在 `supportedInterfaces` 清單中選取第一個你的用戶端所支援的 `protocolBinding` 介面，隨後列舉其具備的 skills。輸入與輸出模式皆採用標準 MIME 媒體類型（Media Types）。

### Signed Agent Cards

一張 Agent Card 可攜帶 `signatures` 陣列。清單中的每個項目皆是依據 RFC 8785 標準將排除 `signatures` 欄位後的名片本體進行規範化 JSON 運算後產出的 JWS（RFC 7515）數位簽章。消費者端以相同演算法進行規範化並校驗簽名。此機制能徹底防止 agent 冒名頂替。

### Task 生命週期

```text
TASK_STATE_SUBMITTED
  -> TASK_STATE_WORKING
  -> TASK_STATE_COMPLETED | TASK_STATE_FAILED | TASK_STATE_CANCELED | TASK_STATE_REJECTED

TASK_STATE_WORKING
  -> TASK_STATE_INPUT_REQUIRED
  -> TASK_STATE_WORKING (the client sends a message with the same taskId)
```

用戶端發起 `SendMessage` 呼叫，伺服器隨之建立 Task。被呼叫的 agent 隨後在不同狀態間轉移；用戶端可透過 `GetTask` 定期輪詢，亦可透過 `SendStreamingMessage` 與 `SubscribeToTask` 建立 SSE 串流連線接收即時推播。串流會攜帶 `statusUpdate` 與 `artifactUpdate` 事件，並在任務抵達終止狀態時自動關閉連線。協定中不存在多餘的 `final` 旗標。

### Messages 與 Parts

一則訊息包含一個 `messageId`、一個 `role`（`ROLE_USER` 或 `ROLE_AGENT`），以及一個或多個 Parts。每個 Part 嚴格只封裝單一內容欄位，而該欄位名稱本身即代表其資料型別。資料結構中不存在額外的 `kind` 欄位。

- `text`：純文字內容。
- `raw`：原始檔案位元組，在 JSON 中以 Base64 編碼表示，通常附帶 `filename` 與 `mediaType`。
- `url`：指向實體檔案內容的超連結。
- `data`：結構化 JSON 酬載（作為提供給被呼叫 agent 的結構化輸入）。

範例：

```json
{
  "messageId": "msg-001",
  "role": "ROLE_USER",
  "parts": [
    {"text": "Summarize this paper."},
    {"raw": "...", "filename": "paper.pdf", "mediaType": "application/pdf"},
    {"data": {"targetLength": "3 paragraphs"}, "mediaType": "application/json"}
  ]
}
```

### Artifacts

輸出結果被封裝為 Artifacts（產物），而非雜亂的裸字串。一個 Artifact 是一個具備名稱與明確型別的輸出結構：

```json
{
  "artifactId": "art-001",
  "name": "summary",
  "parts": [{"text": "...", "mediaType": "text/markdown"}]
}
```

Artifacts 亦支援分塊串流傳輸。每一個 `artifactUpdate` 事件皆攜帶產物本體，並附帶 `append` 與 `lastChunk` 旗標。呼叫端負責逐步累加拼裝。

### 三大協定綁定模式

1. **基於 HTTP 的 JSON-RPC 2.0**（`JSONRPC`）：以 POST 處理常規請求，以 SSE 處理即時串流。方法名稱採用大駝峰命名法（PascalCase）：`SendMessage`、`SendStreamingMessage`、`GetTask`、`ListTasks`、`CancelTask`、`SubscribeToTask`、`CreateTaskPushNotificationConfig`、`GetTaskPushNotificationConfig`、`ListTaskPushNotificationConfigs`、`DeleteTaskPushNotificationConfig` 以及 `GetExtendedAgentCard`。
2. **gRPC**（`GRPC`）：專為原生採用 gRPC 的企業正式環境設計。維持完全相同的方法名稱。
3. **HTTP+JSON/REST**（`HTTP+JSON`）：採用具體的 REST 資源 URL，例如 `POST /message:send` 與 `GET /tasks/{id}`。

這三種綁定模式承載著完全一致的資料模型。每個 `supportedInterfaces` 項目明確指出一種綁定模式與其 `protocolVersion`。用戶端必須在每一個請求中明確傳入 `A2A-Version: 1.0` 標頭，因為若缺少該標頭，伺服器會將請求預設解讀為 0.3 舊版。

```http
POST /a2a HTTP/1.1
Host: research.example.com
Content-Type: application/json
A2A-Version: 1.0

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "SendMessage",
  "params": {
    "message": {
      "messageId": "msg-001",
      "role": "ROLE_USER",
      "parts": [{"text": "Summarize this paper."}]
    }
  }
}
```

### 保持內部不透明性（Opacity Preservation）

這是 A2A 最核心的架構設計原則：被呼叫 agent 的內部運作狀態對外保持完全不透明。呼叫端僅能觀察到任務狀態的推進與最終產物。被呼叫 agent 內部的思維鏈（Chain-of-thought）、工具呼叫細節、子 agent 委派層級——全數對外隱匿。這與 MCP 截然不同；在 MCP 中，所有的工具呼叫過程皆是完全透明公開的。

設計初衷：A2A 讓相互競爭的商業組織或獨立服務能夠在不洩漏內部機密技術的情況下安心協作。A2A 可以單純是「呼叫這項外部客服 agent 服務」，呼叫端無從窺探對方底層究竟是如何實作該服務的。

### 發展時程

- **2025-04-09**：Google 正式發表 A2A。
- **2025-06-23**：專案正式捐贈給 Linux 基金會。
- **2025-08**：整併 IBM 的 ACP 協定。
- **2025-09**：推出 AP2 支付擴充功能（Agent Payments）。
- **2026-04**：正式發布 v1.0，獲得 150 多家機構聯署支援。

### A2A 與 MCP 的定位比較

| 維度 | MCP | A2A |
|------|-----|-----|
| 適用場景 | Agent 到工具（Agent-to-tool） | Agent 到 Agent（Agent-to-agent） |
| 透明度 | 工具呼叫完全透明 | 內部推論過程完全不透明 |
| 典型呼叫端 | Agent 執行時期環境 | 另一個獨立的 Agent |
| 狀態抽象 | 工具呼叫執行結果 | 具備完整生命週期的 Task |
| 身分授權 | OAuth 2.1（Phase 13 · 16） | Agent Card 的 `securitySchemes` 與 `securityRequirements` |
| 傳輸層 | Stdio / Streamable HTTP | JSON-RPC / gRPC / HTTP+JSON |

當你需要呼叫某個具體工具時，使用 MCP。當你需要將一整項完整任務委派給另一個 agent 時，使用 A2A。在許多現代生產系統中，兩者常並行共存：agent 於底層使用 MCP 調用專屬工具，於上層使用 A2A 與其他外部 agent 進行跨組織協同。

```figure
a2a-task-lifecycle
```

## Use It｜實際應用

`code/main.py` 以純 Python 標準函式庫實作了一個最小可行的 A2A 測試控端：寫作 agent 發布自身名片，研究 agent 向其發送包含 PDF 附件與文字指示的 `SendMessage` 請求，隨後任務依序推進 `TASK_STATE_WORKING` → `TASK_STATE_INPUT_REQUIRED` → `TASK_STATE_WORKING` → `TASK_STATE_COMPLETED`，最後回傳文字產物。全流程無外部相依性；透過記憶體內部傳輸層聚焦於訊息格式的精確封裝。

核心觀察重點：

- Agent Card 的標準 JSON 結構。
- 伺服器端的任務 ID 分配與狀態機轉移。
- 依據內容欄位動態決定型別的 Parts 結構。
- 任務中途遭遇的 `TASK_STATE_INPUT_REQUIRED` 互動路徑。
- 任務順利完成後的 Artifact 產物回傳。

## Ship It｜交付成果

本課產出 `outputs/skill-a2a-agent-spec.md`。給定一個準備開放給其他外部 agent 呼叫的新 agent，該技能可自動產出合規的 Agent Card JSON、skills 結構定義與端點實作藍圖。

## Exercises｜練習

1. 運行 `code/main.py`。端到端追蹤完整的 Task 生命週期，特別觀察被呼叫 agent 遇到疑問要求進一步釐清時所觸發的 `TASK_STATE_INPUT_REQUIRED` 中斷暫停。

2. 為 Agent Card 實作數位簽名。在 `signatures` 清單中新增一個 `alg` 為 `HS256` 的 JWS 項目，對排除 `signatures` 欄位後的標準規範化名片 JSON 進行簽名。編寫校驗常式，驗證其在名片內容遭篡改時能精準攔截。

3. 運用 `SendStreamingMessage` 實作任務串流傳輸：寫作 agent 依序推送 `task` 狀態、三個 `artifactUpdate` 分塊資料，以及帶有 `TASK_STATE_COMPLETED` 的 `statusUpdate`，隨後安全關閉連線。呼叫端負責將所有分塊平滑拼接。

4. 設計一個封裝 MCP 伺服器的 A2A agent。將底層的每個 MCP 工具一對一對應為 A2A skill。深入思考該架構下的權衡代價——哪些原生的不透明性因而喪失？

5. 研讀 A2A v1.0 官方發布公告，找出截至 2026 年 4 月為止尚未有任何主流框架實作的一項前瞻功能。（提示：與多跳多層級任務委派機制相關。）

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|---------|-------------|
| A2A | 「Agent 到 Agent 協定」 | 讓不透明 agent 實現跨框架協同作業的開放通訊協定 |
| Agent Card | 「`/.well-known/agent-card.json`」 | 對外公開發布的後設資料名片，詳述 agent 的 skills 與 `supportedInterfaces` |
| Skill | 「可呼叫單元」 | agent 支援的具名作業能力（對標於 MCP 中的 tool） |
| Task | 「委派任務單元」 | 具備完整生命週期與最終產出產物的工作項目 |
| Message | 「任務輸入訊息」 | 負責承載具體 Parts 的通訊結構（包含 `text`、`raw`、`url`、`data`） |
| Part | 「型別化內容區塊」 | 嚴格為 `text` / `raw` / `url` / `data` 其中之一，附帶可選的 `mediaType`；無 `kind` 欄位 |
| Artifact | 「任務產出物」 | 任務完成後回傳的具名、強型別輸出產物 |
| AP2 | 「Agent 支付協定」 | 建構於 A2A 之上的支付擴充功能；名片簽名為 A2A 原生核心（`signatures`） |
| Opacity | 「黑箱協作特性」 | 被呼叫 agent 的內部推論過程對外維持完全不可見 |
| `TASK_STATE_INPUT_REQUIRED` | 「任務中斷等待輸入」 | 當 agent 需要呼叫端補充提供額外資訊時的暫停狀態 |

## Further Reading｜延伸閱讀

- [a2a-protocol.org](https://a2a-protocol.org/latest/) ——A2A 官方權威規範文件
- [a2aproject/A2A — GitHub](https://github.com/a2aproject/A2A) ——官方參考實作與 SDK 程式庫
- [A2A v1.0.1 release](https://github.com/a2aproject/A2A/tree/v1.0.1) ——本課遵循的 `docs/specification.md` 與規範性 `specification/a2a.proto` 標籤版本
- [Linux Foundation — A2A launch press release](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents) ——2025 年 6 月治理權移交 Linux 基金會新聞公告
- [Google Cloud — A2A protocol upgrade](https://cloud.google.com/blog/products/ai-machine-learning/agent2agent-protocol-is-getting-an-upgrade) ——發展藍圖與生態系合作夥伴動向
- [Google Dev — A2A 1.0 milestone](https://discuss.google.dev/t/the-a2a-1-0-milestone-ensuring-and-testing-backward-compatibility/352258) ——v1.0 發布說明與向下相容實務指南
