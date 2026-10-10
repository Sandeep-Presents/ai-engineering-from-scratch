# 記憶體區塊與睡眠期運算

> 讓大模型能直接就地編輯離散的模組化記憶體區塊，並引入專門的睡眠期背景 agent 在主 agent 閒置時非同步整合梳理記憶。這兩大核心理念正是將記憶體能力擴展超越單一對話的關鍵之道。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 07 (MemGPT)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 指出 Letta 所劃分的三層記憶體架構（Core、Recall、Archival）及其各自的職責邊界。
- 深入闡明記憶體區塊模式：將 Human 區塊、Persona 區塊以及使用者自訂區塊視為一等強型別物件。
- 描述睡眠期運算（Sleep-Time Compute）的運作機制、為何能徹底脫離關鍵路徑，以及為何能調用比主 agent 更強大的昂貴模型。
- 以純 Python 標準函式庫實作雙 agent 協同迴圈：主 agent 快速回應使用者對話，睡眠期 agent 在對話回合之間非同步整合記憶體區塊。

## The Problem｜問題

MemGPT（第 7 課）成功解決了虛擬記憶體的控制流程。然而在真實生產實踐中，浮現了三大全新維運瓶頸：

1. **延遲代價（Latency）**：所有的記憶體維護操作皆位於使用者的即時關鍵路徑之上。若 agent 必須在使用者焦急等待時現場修剪、提煉摘要或調解記憶矛盾，P99 尾端延遲將徹底失控爆炸。
2. **記憶腐化（Memory rot）**：寫入累積遠快於讀取。相互矛盾的歷史事實未被清理。檢索結果被海量陳舊過時的資訊所淹沒。
3. **缺乏語義結構（Structure loss）**：扁平純文字檔案庫無法表達結構化規則：「Human 區塊必須常駐於 prompt 中；Persona 區塊必須常駐於 prompt 中；而 Task 區塊則隨階段作業切換」。

Letta（letta.com）是原 MemGPT 團隊於 2024 年推出的全新平台名稱（原始論文架構仍維持 MemGPT 名稱），而 2026 年的 Letta V1 重構則是後續的重大革新。記憶體區塊讓語義結構清晰明確；而睡眠期運算則將記憶整合徹底移出即時關鍵路徑。

## The Concept｜核心概念

### 三層記憶體架構

| 記憶層級 | 作用範疇 | 物理存取位置 | 寫入與維護者 |
|---|---|---|---|
| Core（核心層） | 隨時完全可見 | 駐留於主 prompt 內部 | Agent 工具呼叫 + 睡眠期背景重寫 |
| Recall（回想層） | 完整歷史對話串流 | 可按需檢索 | 系統自動記錄各對話回合 |
| Archival（檔案層） | 任意長效知識事實 | 向量 + 鍵值 + 知識圖譜 | Agent 工具呼叫 + 睡眠期批次導入 |

Core 承襲自 MemGPT 核心常駐區；Recall 是包含已淘汰尾端的對話歷史緩衝區；Archival 則是外部可檢索儲存庫。此切分徹底理清了原本 MemGPT 雙層架構中的概念超載。

### 記憶體區塊（Memory Blocks）

一個區塊（Block）是 Core 核心層內部一段具備強型別、持久化且可編輯的文字區段。原始 MemGPT 論文定義了兩個核心區塊：

- **Human 區塊**：關於使用者的客觀事實（姓名、職位、偏好習慣、目標）。
- **Persona 區塊**：Agent 的自我人設（身分識別、語氣風格、行為約束）。

Letta 將其泛化為支援任意使用者自訂區塊：承載當前任務目標的 `Task` 區塊、記錄程式碼庫事實的 `Project` 區塊、宣告安全紅線的 `Safety` 區塊。每個區塊皆包含 `id`、`label`、`value`、`limit`（字元長度上限）與 `description`（指導大模型何時應當編輯該區塊）。

模型可透過標準工具介面直接編輯各區塊：

- `block_append(label, text)`：向指定區塊追加內容。
- `block_replace(label, old, new)`：替換區塊內的特定字句。
- `block_read(label)`：精確讀取某個區塊的當前內容。
- `block_summarize(label)`：當區塊接近字元上限時，主動壓縮提煉其內容。

### 睡眠期運算（Sleep-Time Compute）

2025 年 Letta 的重大創新：在背景非同步運行第二個專屬 agent，完全脫離使用者的即時關鍵路徑。睡眠期 agent 在系統閒置時批次處理對話日誌與程式碼庫脈絡、將學習到的情境知識（`learned_context`）寫入共享區塊中，並自動整合或淘汰失效的檔案記錄。

該架構展現出三大壓倒性優勢：

- **零延遲衝擊**：主線 agent 的即時回應絕不需要停下來等待耗時的記憶體整理。
- **獲准調用更強大的模型**：睡眠期 agent 完全不受即時延遲約束，因此可以使用成本較高、推論更深、速度較慢的頂級旗艦模型進行精確提煉。
- **天然的記憶整合時間視窗**：在使用者未在線上等待的空檔，從容進行去重、提煉摘要與矛盾事實驗收。

這與人類大腦的運作機制如出一轍：白天執行具體任務，夜間進入睡眠狀態，大腦在背景非同步將短期記憶固化沉澱為長期記憶。

### 原生推論通道（Native Reasoning）

Letta V1（`letta_v1_agent`，2026 年）正式廢棄了舊有的 `send_message` / 心跳機制與行內 `Thought:` 字串，全面擁抱**原生推論（Native Reasoning）**。OpenAI Responses API 與 Anthropic 的延伸思考（Extended Thinking）Messages API 皆在獨立專屬通道上發射推論內容，並在各對話回合間透明透傳（正式環境跨供應商調用時通常全程加密）。底層控制迴圈依然是 ReAct，但思維軌跡已轉化為結構化的原生資料。

### 典型架構失效模式

- **區塊容量膨脹（Block bloat）**：無節制的 `block_append` 會導致區塊迅速打滿字元上限。解法：在寫入可能溢位前，強制掛載自動區塊摘要器。
- **靜默語義漂移（Silent drift）**：睡眠期 agent 大幅重寫了某個區塊，而主線 agent 卻渾然不知。解法：為區塊實施版本控管，並在追蹤鏈中明確展示 Diff 差異。
- **投毒整合風險（Poisoned consolidation）**：睡眠期 agent 在處理外部輸入時，誤將未經審查的攻擊者內容沉澱至 Core 核心區塊中。第 27 課所講述的安全邊界防護同樣必須嚴格套用於睡眠期架構中。

```figure
memory-blocks
```

## Build It｜動手實作

`code/main.py` 以純 Python 標準函式庫實作了以下核心架構：

- `Block`：封裝 id、label、value、limit 與 description。
- `BlockStore`：提供 CRUD 操作與 `near_limit(label)` 容量預警輔助函式。
- 雙 agent 協同：`PrimaryAgent` 負責即時回應對話回合，`SleepTimeAgent` 負責在對話回合之間非同步整合記憶。
- 執行軌跡展示：包含三次對話回合中的區塊寫入，隨後展示睡眠期背景通道如何自動壓縮區塊並淘汰過時的陳舊事實。

運行實驗：

```
python3 code/main.py
```

終端日誌清晰展示了職責切分：主線回合維持極致低延遲並產出原始寫入；隨後的睡眠期通道則從容進行壓縮與清理。

## Use It｜實際應用

- **Letta**（letta.com）：官方權威參考實作，支援開源私有部署與雲端全代管服務。
- **Claude Agent SDK skills** 作為區塊形態的結構化知識：一項 skill 本質上就是一段具備名稱、版本控管且可按需載入的 instructions 知識區塊。
- **自建架構**：適合高度重視底層儲存自主權的團隊。遵循 Letta API 規格契約進行實作，利於未來無縫遷移。

## Ship It｜交付成果

`outputs/skill-memory-blocks.md` 能為任何目標執行時期環境產出 Letta 風格的記憶體區塊系統架構與睡眠期掛鉤配置，內建安全防護規則與來源引文追蹤鏈結。

## Exercises｜練習

1. 新增 `block_summarize` 工具：當 `near_limit` 回傳 true 時，自動調用模型產出的精簡摘要覆寫該區塊。哪個觸發閾值能在「最小化摘要呼叫次數」與「防範區塊溢位」之間取得最佳平衡？
2. 實作睡眠期檔案庫去重：當兩筆記錄的文字 Token 重疊度超過 90% 時，將其自動合二為一。確保該去重運算嚴格僅在睡眠期執行，絕不拖累即時關鍵路徑。
3. 為記憶體區塊導入版本控制。在每次寫入時記錄舊值與 Diff 變更。暴露 `block_history(label)` 介面，使維運人員能精準排查「為何 agent 遺忘了 X」。
4. 將睡眠期 agent 視為不可信的寫入者。當其企圖修改 Persona 或 Safety 等關鍵核心區塊時，強制要求第二個獨立 agent 進行交叉審核後方可確認生效。
5. 將此教學範例移植為使用 Letta 官方 API（`letta_v1_agent`）。區塊 Schema 產生了何種轉變？原生推論通道又是如何改變最終的日誌結構？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| Memory block | 「可編輯的 Prompt 區段」 | 駐留於 Core 核心記憶體中、具備強型別且可由大模型直接編輯的文字片段 |
| Human block | 「使用者畫像記憶」 | 關於使用者的客觀事實，常駐鎖定於 Core 核心層 |
| Persona block | 「Agent 人設記憶」 | 自我身分、語氣設定與行為約束，常駐鎖定於 Core 核心層 |
| Sleep-time compute | 「非同步記憶體整理」 | 脫離即時關鍵路徑在背景運行的第二個 agent，專職負責記憶提煉與整合 |
| Core / Recall / Archival | 「三層記憶體體系」 | 隨時可見核心層／對話歷史回想層／外部海量檔案庫的三層架構劃分 |
| Block limit | 「區塊長度配額」 | 為每個區塊設定的字元上限；達到時強制觸發提煉壓縮 |
| Native reasoning | 「原生推論通道」 | 供應商底層專屬通道輸出的推論內容，而非 prompt 拼接的 `Thought:` 字串 |
| Learned context | 「睡眠整理產物」 | 睡眠期 agent 在復盤後寫入共享區塊中的全新精煉事實 |

## Further Reading｜延伸閱讀

- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) ——記憶體區塊設計模式實戰
- [Letta, Sleep-time Compute blog](https://www.letta.com/blog/sleep-time-compute) ——非同步記憶整合架構解析
- [Letta, Rearchitecting the Agent Loop](https://www.letta.com/blog/letta-v1-agent) ——擁抱原生推論通道的架構重構
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) ——虛擬記憶體奠基論文
