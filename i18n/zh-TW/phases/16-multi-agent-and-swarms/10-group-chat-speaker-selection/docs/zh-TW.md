# 群組對話與發言人選取機制（Group Chat and Speaker Selection）

> 共享對話編排將 N 個 Agent 置於同一個對話空間中；由發言人選取函式（LLM、輪詢 Round-robin 或客製化規則）動態決定下一棒由誰發言。這正是湧現式多 Agent 對話的原型代表——各 Agent 在靜態圖中完全不知道自己的固定角色，它們只是單純對共享訊息池做出自發反應。AutoGen GroupChat 與 AG2 GroupChat 是此類架構的經典參考實作：AutoGen v0.2 的 GroupChat 語意在 AG2 fork 中被完整保留；而 AutoGen v0.4 則將其全面重寫為事件驅動的 Actor 模型。微軟隨後於 2026 年 2 月將 AutoGen 轉入維護模式，並將其與 Semantic Kernel 深度整併為微軟 Agent Framework（2026 年 2 月釋出 RC 版）。GroupChat 原語在 AG2 與微軟 Agent Framework 中皆完整延續——一次搞懂，處處通用。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## Problem｜問題

當工作流程完全已知且固定時，靜態執行圖（如 LangGraph）無疑是極佳的選擇。然而真實世界中的人類協同對話絕非死板靜態：有時工程師會主動詢問審查員，有時轉向諮詢研究員，有時又回頭向技術作家求證。若將所有可能的任務交接路徑全數以硬編碼寫死，將引發恐怖的圖邊爆炸。你真正需要的是：**讓各 Agent 對共享訊息池做出動態反應**，並由某個決策函式靈活裁定下一步由誰發言。

這正是 AutoGen GroupChat 的核心使命。

## Concept｜核心概念

### 核心架構形態

```
              ┌─── shared pool ────┐
              │   m1  m2  m3  ...  │
              └─────────┬──────────┘
                        │ (everyone reads all)
      ┌───────┬─────────┼─────────┬───────┐
      ▼       ▼         ▼         ▼       ▼
    Agent A  Agent B  Agent C  Agent D  Selector
                                           │
                                           ▼
                                  "next speaker = C"
```

每個 Agent 皆能看見訊息池中的每一則歷史發言。在每一輪對話中，系統會呼叫選取器函式（Selector），由其裁決下一棒發言權歸屬於誰。

### 三大發言人選取器風格

**輪詢循環（Round-robin）。** 固定的順序循環。具備完全的確定性。計算開銷隨 Agent 數量呈線性擴展，但完全無視當前的語意上下文——即便當前討論的主題是法務合規審查，輪詢依然會刻板地將話語權交給工程師。

**LLM 動態選取（LLM-selected）。** 發起一次專門的 LLM 呼叫，由其通讀最近的訊息池並智慧推選出最合適的下一位發言者。具備極佳的上下文感知能力，但延遲較高：每一輪實質發言皆必須額外疊加一次 LLM 決策開銷。此為 AutoGen 的預設模式。

**客製化混合規則（Custom）。** 封裝了任意自定義邏輯的 Python 函式。典型架構：以 LLM 動態選取為主，並輔以硬性兜底規則（例如「在工程師發言之後，下一棒強制必須交給驗證者」）。

### ConversableAgent API 經典外觀

```
agent = ConversableAgent(
    name="coder",
    system_message="You write Python.",
    llm_config={...},
)
chat = GroupChat(agents=[coder, reviewer, tester], messages=[])
manager = GroupChatManager(groupchat=chat, llm_config={...})
```

`GroupChatManager` 負責掌控選取器。當某個 Agent 完成發言後，Manager 會呼叫選取器裁定下一棒 Agent。該迴圈持續運轉，直到觸發特定的終止條件。

### 對話終止機制（Termination）

三種主流的終止模式：

- **最大輪次硬性上限（Max rounds）。** 為總對話輪次設置不可逾越的安全上限。
- **「TERMINATE」哨兵 Token。** 允許各 Agent 在判定任務完工時發出特殊的哨兵訊息；一旦 Manager 偵測到該標記便立即停止對話。
- **目標達成驗證檢查（Goal-reached check）。** 在每一輪結束時掛載輕量級的驗證器，一旦判定目標達成便優雅終止對話。

### 歷史演進：專案的分叉與整併

在 2025 年初，微軟啟動了對 AutoGen（v0.4）的大規模底層重構，將其全面遷移至基於事件驅動的 Actor 模型。開源社群為了保留早期廣泛採用的 v0.2 GroupChat 經典語意，發起了 **AG2** 分叉專案，確保了既有 API 的長期相容性。

到了 2026 年 2 月，微軟正式宣布將 AutoGen 轉入維護模式，其事件驅動 Actor 模型全面與 Semantic Kernel 整併，共同匯聚為微軟全新的旗艦專案 **Microsoft Agent Framework**（2026 年 2 月發布 RC 版）。GroupChat 的核心原語在兩條演進路徑中皆得以完整延續；底層實作細節雖有差異，但概念一脈相承。對於希望維持 v0.2 風格相容性的專案，AG2 是當前首選的上游。

### 何時群組對話最為契合

- **湧現式自發討論。** 你不希望、也無法預先編排每一條可能的發言跳轉路徑。
- **角色高度交叉混雜的任務。** 工程師向研究員請教，研究員向文獻庫調閱資料，文獻庫又回頭向工程師確認參數。整體流程根本不是一個單向的有向無環圖（DAG）。
- **探索型腦力激盪。** 本質上更貼近一場跨領域的「腦力激盪專案會議」，而非死板嚴格的「流水線工廠」。

### 何時群組對話注定失靈

- **需要嚴格確定性的場景。** 基於 LLM 的選取器天生存在機率波動。完全相同的 prompt，在不同執行中可能會推選出截然不同的發言順序。
- **諂媚附和級聯（Sycophancy cascades）。** 各 Agent 容易集體向發言最具自信的那個 Agent 妥協盲從。必須在 prompt 中顯式注入反制指令。
- **上下文急遽膨脹。** 每個 Agent 在每一輪都必須通讀全場歷史；對話進行 10 輪之後，上下文視窗將變得無比臃腫。應當引入投影視圖（第 15 課）進行範圍剪裁。
- **單一話霸霸凌（Hot speakers）。** 某個 Agent 徹底統治了整場對話，因為選取器過度偏愛其專業標籤。必須在選取器特徵中強制引入發言平衡機制。

### 群組對話 vs 監督者模式

相同的四大原語，不同的預設值配置：

- 監督者模式：由一位 Agent 負責統籌規劃，其餘工作者執行。選取器本質上是「詢問規劃者下一步該做什麼」。
- 群組對話：所有 Agent 在地位上皆屬平等同儕；選取器是一個直接運作在全域共享池上的動態決策函式。

兩者皆完美立足於第 04 課所傳授的四大原語。群組對話預設採用「LLM 動態選取」的編排器以及「完整池」的共享狀態。

```figure
swarm-speaker
```

## Build It｜動手實作

`code/main.py` 透過 Python 標準函式庫從零實現了一個完整的 GroupChat 系統。內部協同三個 Agent（工程師、審查員、管理者），同時支援輪詢（Round-robin）與 LLM 模擬選取兩種風格，並配置了基於 `TERMINATE` 哨兵標記的優雅終止機制。

展示程式會完整列印出兩種模式下的對話文字記錄，以及選取器在每一步的決策推理鏈條。

執行指令：

```
python3 code/main.py
```

## Use It｜實際應用

`outputs/skill-groupchat-selector.md` 能為一項給定的具體任務精準配置 GroupChat 選取器——評估該選用輪詢、LLM 選取還是客製化規則，並定義選取器所需的最佳特徵輸入（最近訊息、各 Agent 專長權重、當前發言計數）。

## Ship It｜交付成果

群組對話推向正式環境前的必備檢查清單：

- **強制配置最大輪次上限。** 絕無例外。常規任務通常設置為 10-20 輪。
- **監控發言平衡度指標。** 追蹤各 Agent 的發言輪次；一旦出現嚴重傾斜立即告警。
- **明確的終止哨兵機制。** 支援 `TERMINATE` 標記或配備專屬的驗證者 Agent。
- **引入投影視圖或受限記憶體。** 在對話超過約 10 則訊息後，強烈建議為各 Agent 僅提供剪裁後的局部視圖，防止上下文無界膨脹。
- **選取器全鏈路日誌記錄。** 針對 LLM 選取模式，必須完整記錄選取器的輸入 prompt 與其最終決策。否則事後排查除錯將徹底淪為不可能。

## Exercises｜練習

1. 執行 `code/main.py`。對比輪詢模式與 LLM 選取模式下的對話軌跡。在兩種模式下分別是哪位 Agent 佔據了主導發言地位？
2. 在選取器中加入「單一 Agent 最大發言次數限制」規則。觀察這對最終的對話品質與流暢度產生了何種實質影響？
3. 實現基於目標達成的終止條件：當審查員回傳「approved」字眼時自動結束對話。在多大比例的測試中，該機制能在觸及輪次上限前順利提前結束？
4. 閱讀 AutoGen 官方 GroupChat 穩定版文件 (https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html)。指出 `GroupChatManager` 預設採用的選取器類型。
5. 閱讀 AG2 官方儲存庫 (https://github.com/ag2ai/ag2)，並將其 v0.2 GroupChat 架構與 v0.4 事件驅動版本進行深度對比。v0.4 究竟在哪些具體維度上（吞吐量、容錯性、可組合性）實現了實質架構躍升？

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GroupChat | "Agents in one chat room" | Shared message pool + selector function. AutoGen / AG2 primitive. |
| Speaker selection | "Who talks next" | The function that picks the next agent. Round-robin, LLM-selected, or custom. |
| GroupChatManager | "The meeting host" | AutoGen component that owns the selector and loops over turns. |
| ConversableAgent | "The base agent" | AutoGen base class; an agent that can send and receive messages. |
| Termination token | "The 'stop' word" | Sentinel string (usually `TERMINATE`) that ends the chat. |
| Hot speaker | "One agent dominates" | Failure mode where the selector keeps picking the same agent. |
| Context bloat | "Pool grows unbounded" | Each agent reads every prior message; context grows with turns. |
| Projection | "Scoped view" | Role-specific view into the shared pool to prevent context bloat. |

## Further Reading｜延伸閱讀

- [AutoGen group chat docs](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html) — 群組對話編排的官方權威參考實作。
- [AG2 repo](https://github.com/ag2ai/ag2) — 社群持續維護並演進的 AutoGen v0.2 主力專案。
- [Microsoft Agent Framework docs](https://learn.microsoft.com/en-us/agent-framework/) — 微軟整併後的官方繼承者專案，於 2026 年 2 月釋出 RC 版。
- [AutoGen v0.4 release notes](https://microsoft.github.io/autogen/stable/) — 基於事件驅動 Actor 模型的底層重構架構技術細節。
