# 控端即函式庫——子 Agent 與階段作業儲存庫

> 一套能直接透過 import 引用的控端框架：內建工具集、用於脈絡隔離的子 agent（Subagents）、生命週期鉤子、W3C 分散式追蹤脈絡傳播，以及階段作業持久化儲存庫。Claude Agent SDK 正是其代表性典範——它是 Claude Code 控端架構的函式庫形態；而 Claude Managed Agents 則是面向長時間非同步工作的雲端全代管方案。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 10 (Skill Libraries)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 深入解釋 Anthropic 用戶端 SDK（底層原始 API）與 Claude Agent SDK（高階控端架構）的本質差異。
- 描述子 agent（Subagents）的兩大核心定位——平行化運算與脈絡隔離，並明確識別其適用時機。
- 掌握 Python SDK 階段作業儲存庫的介面規範（`append`、`load`、`list_sessions`、`delete`、`list_subkeys`）以及 `--session-mirror` 旗標的運作原理。
- 以純 Python 標準函式庫實作一套具備內建工具、具備獨立脈絡的子 agent 衍生機制、生命週期鉤子與階段作業儲存庫的完整控端。

## The Problem｜問題

直接調用原始大模型 API 僅能完成單次網路往返。然而，一套成熟的生產級 agent 必然需要實體工具執行能力、MCP 伺服器連線、生命週期掛鉤、子 agent 動態衍生、階段作業持久化，以及全鏈路分散式追蹤傳播。Claude Agent SDK 將這套成熟的系統骨架直接打包為可引用的軟體函式庫——將 Claude Code 原生採用的同款強大控端，完整開放給開發者打造自訂 agent。

## The Concept｜核心概念

### 用戶端 SDK vs Agent SDK

- **用戶端 SDK（`anthropic`）**：暴露底層原始的 Messages API。工程師必須親手編寫控制迴圈、管理工具執行與維護全域狀態。
- **Agent SDK（`claude-agent-sdk`）**：原生內建工具實體執行、MCP 連線管理、生命週期鉤子、子 agent 衍生與階段作業儲存庫。將 Claude Code 的核心迴圈直接封裝為高階函式庫。

### 原生內建工具集

該 SDK 開箱即用提供了 10 多種標準工具：檔案讀寫、Shell 命令列、Grep 搜尋、Glob 檔案配對、網頁抓取等。自訂工具則可透過標準的工具 Schema 介面無縫註冊。

### 子 Agent（Subagents）

Anthropic 官方文檔定義的兩大核心使命：

1. **平行化運算（Parallelization）**：並發處理彼此獨立的工作任務。例如「在 20 個獨立模組中分別找尋對應的測試檔案」可直接分派為 20 個平行子 agent 任務。
2. **脈絡隔離（Context isolation）**：子 agent 擁有各自完全獨立的上下文視窗；僅有最終產出結果會回傳給主協調者（Orchestrator）。這能誓死捍衛主協調者的上下文 Token 預算免於崩潰。

Python SDK 近期新增了 `list_subagents()` 與 `get_subagent_messages()` 介面，支援直接審查子 agent 的完整執行對話紀錄。

### 階段作業儲存庫（Session Store）

與 TypeScript SDK 保持嚴格協定對等：

- `append(session_id, message)`：追加對話回合；
- `load(session_id)`：完整復原過往對話；
- `list_sessions()`：列舉所有階段作業；
- `delete(session_id)`：刪除階段作業，並自動級聯清理關聯的子 agent 記錄；
- `list_subkeys(session_id)`：檢索該階段作業衍生的所有子 agent 鍵值。

命令列旗標 `--session-mirror` 能在串流推播時將完整對話即時同步轉存至外部檔案中，極利於本機即時除錯。

### 生命週期鉤子（Hooks）

支援註冊的關鍵生命週期掛鉤：

- `PreToolUse`、`PostToolUse`：在工具呼叫前後進行安全審批卡點或審計日誌記錄；
- `SessionStart`、`SessionEnd`：環境初始化與資源善後清理；
- `UserPromptSubmit`：在模型看到使用者輸入前，預先實施過濾或安全檢查；
- `PreCompact`：在對話脈絡觸發自動壓縮前執行；
- `Stop`：Agent 退出時的最終清理常式；
- `Notification`：旁路帶外通知與告警。

各種專業工作流程正是透過這些鉤子，優雅地注入跨領域的系統切面行為。

### W3C 分散式追蹤脈絡（W3C Trace Context）

呼叫端當前活躍的 OTel Spans，會透過標準 W3C 分散式追蹤標頭自動傳播至底層 CLI 子行程中。整套跨行程的呼叫鏈在後端觀測平台中會被無縫匯總呈現為單一完整 Trace。

### Claude 全託管 Agent（Claude Managed Agents）

雲端全託管替代方案（Beta 標頭 `managed-agents-2026-04-01`）。專門處理長時段運行的非同步複雜工作，原生內建 Prompt 快取與自動脈絡壓縮。以讓渡部分精細掌控權為代價，換取免維運的強大雲端基礎設施。

### 典型架構失效模式

- **子 Agent 濫發（Subagent over-spawn）**：為 100 個極其瑣碎的小任務衍生 100 個獨立子 agent。通訊與啟動開銷徹底吞噬效能。解法：實施批次合併處理。
- **鉤子失控蔓延（Hook creep）**：每個團隊皆在系統中肆意追加鉤子，導致啟動時間劇烈膨脹。解法：每季對全域鉤子進行嚴格審查與整併。
- **階段作業容量膨脹**：歷史階段作業無節制堆積，儲存容量激增。解法：結合 `list_sessions` 與過期淘汰機制定期清理。

```figure
ae-subagent-isolation
```

## Build It｜動手實作

`code/main.py` 以純 Python 標準函式庫實作了 SDK 的核心架構：

- `Tool`、`ToolRegistry` 內建 `read_file`、`write_file`、`list_dir`；
- `Subagent`：具備私有獨立脈絡、隔離運行並回傳最終結果；
- `SessionStore`：支援 append、load、list、delete、list_subkeys；
- `Hooks`：包含 `pre_tool_use`、`post_tool_use`、`session_start`、`session_end`；
- 完整演示：主 agent 並行衍生 3 個相互隔離的子 agent、聚合各方結果，並持久化保存階段作業。

運行實驗：

```
python3 code/main.py
```

日誌會清晰展示：子 agent 的脈絡隔離（主協調者的上下文大小嚴格維持在可控邊界內）、鉤子的即時執行，以及階段作業的完整持久化。

## Use It｜實際應用

- **Claude Agent SDK**：適用於以 Claude 為核心、希望直接享用 Claude Code 控端骨架的產品。
- **Claude Managed Agents**：適用於需要雲端託管的長時段非同步背景任務。
- **OpenAI Agents SDK**（第 16 課）：OpenAI 生態系中的對等控端方案。
- **LangGraph + 自訂工具**：當需要將核心邏輯建模為顯式狀態機圖結構時使用。

## Ship It｜交付成果

`outputs/skill-claude-agent-scaffold.md` 能自動產出標準的 Claude Agent SDK 應用程式鷹架，內建子 agent 衍生、生命週期鉤子、階段作業儲存庫、MCP 伺服器掛載與 W3C 追蹤傳播。

## Exercises｜練習

1. 為子 agent 衍生器實作批次調度：將 20 個任務拆解為每組 5 個並行子 agent 進行批次執行。對比主協調者的脈絡大小與一對一單獨衍生的差異。
2. 實作 `PreToolUse` 鉤子，為 `write_file` 呼叫加入頻率限制（單一階段作業每分鐘最多 5 次）。追蹤其攔截行為。
3. 運用 `list_subkeys` 繪製出樹狀結構的子 agent 衍生圖。當層級深度巢狀時，架構呈現出何種形態？
4. 將此教學實作移植為使用真實的 `claude-agent-sdk` Python 套件。工具註冊介面產生了何種改變？
5. 研讀 Claude Managed Agents 官方文件。分析在何種具體業務邊界下，團隊應當自私有部署切換至全託管方案？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| Agent SDK | 「函式庫版的 Claude Code」 | 封裝工具執行、MCP 連線、鉤子、子 agent 與階段作業的控端架構 |
| Subagent | 「子 Agent」 | 具備獨立上下文視窗與專屬預算的子執行體；結果匯總回傳給協調者 |
| Session store | 「對話歷史資料庫」 | 支援回合追加、載入、列舉與級聯刪除的持久化儲存設施 |
| Hook | 「生命週期回呼函式」 | 於工具調用前後、階段作業起訖、輸入送出或壓縮前執行的自訂擴充點 |
| W3C trace context | 「跨行程分散式追蹤」 | 父層 Span 透過標準標頭透明傳播至 CLI 子行程中的追蹤機制 |
| Managed Agents | 「雲端代管控端」 | 由 Anthropic 官方託管維運、專門處理長時間非同步運算的雲端服務 |
| `--session-mirror` | 「對話即時轉存」 | 將階段作業對話在串流推播時即時寫入外部本機檔案的命令列旗標 |
| MCP server | 「外部工具表面」 | 掛載於 agent 之下、對外提供工具與資源存取能力的外部微服務 |

## Further Reading｜延伸閱讀

- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) ——Claude Code 的函式庫形態官方文檔
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) ——生產級實戰模式解析
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) ——雲端全代管方案指南
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) ——對等架構參考
