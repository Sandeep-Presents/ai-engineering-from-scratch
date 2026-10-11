# 平行／群體／網路式架構（Parallel / Swarm / Networked Architectures）

> 與監督者模式形成鮮明對比：群體架構內部不存在任何中央裁決實體。各 Agent 透過監聽共享的事件匯流排（event bus），非同步地從中主動認領任務，並將產出結果回寫入池。LangGraph 明確支援「群體架構（Swarm Architecture）」以應對去中心化的動態多變環境。Matrix 框架（arXiv:2511.21686）更進一步，將控制流與資料流全數抽象化為在分散式佇列中傳遞的序列化訊息，徹底消除了單一編排器的效能瓶頸。其背後的權衡取捨極為明確：以犧牲系統的確定性與可追溯性為代價，換取近乎無限的水平擴展能力。群體架構極度適用於包含大量相互獨立子任務的業務；然而面對需要全局一致性宏觀規劃的任務，它將徹底崩潰。

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`, `queue`)
**Prerequisites:** Phase 16 · 05 (Supervisor Pattern), Phase 16 · 04 (Primitive Model)
**Time:** ~75 minutes

## Problem｜問題

監督者模式能夠優雅協同數個工作者。但若工作者規模攀升至數百個呢？此時監督者自身將迅速淪為全系統最大的效能瓶頸：關於誰該做什麼的每一項細微決策，全部被迫塞進單一 Agent 的狹窄咽喉。只要某個規劃步驟發生短暫遲滯，整座系統就會瞬間陷入全局阻塞。

群體架構（Swarm architecture）徹底顛覆了這套思維。它不再依賴中央規劃者進行由上而下的任務派發，而是讓各工作者主動從共享佇列中動態拉取任務。「協同編排」不再依賴特定中央腦袋，而是直接內化於事件匯流排的排程語意之中。徹底拿掉中心編排器；系統的擴展天花板，將直接取決於底層訊息佇列的承載極限。

## Concept｜核心概念

### 核心架構形態

```
                ┌──── shared queue ────┐
                │                      │
       ┌────────┼────────┐  ◄──────┬───┘
       ▼        ▼        ▼         │
     Worker  Worker  Worker   Worker
      A       B       C        D
       │        │        │         │
       └────────┴────────┴─────────┘
                 │
                 ▼
            results pool
```

系統內部不存在任何中央編排者。每個工作者僅不斷重複極簡的閉環：從佇列拉取任務、執行處理、寫回結果（並視需要將後續新衍生出的任務重新推入佇列）。

### 何時群體架構最為契合

- **包含大量相互獨立的任務。** 例如大規模網頁抓取、批次資料轉換、大量文字分類。任務之間完全不存在相互依賴關係。
- **任務執行時長波動劇烈。** 若部分任務僅需耗時 100 毫秒，而另一部分需要 10 秒，群體架構能自發實現極致的負載平衡——手頭工作快速完成的工作者能立即拉取下一棒。而傳統監督者則必須痛苦地預判並計算每個任務的耗時。
- **吞吐量優先於確定性順序。** 業務真正關心的是整體完工的端到端吞吐效率，而非死板嚴格的先後執行順序。

### 何時群體架構注定失敗

- **具備嚴格先後順序的工作流程。** 若步驟 3 在物理上完全依賴步驟 2 的輸出，在群體架構下極易發生步驟 3 在步驟 2 尚未完工前就被搶先領取執行的災難。
- **需要全局宏觀規劃的任務。** 複雜的深度科研調研任務極度依賴一位統籌全局的規劃者。由一群各自為政的研究員組成的群體，最終只會堆砌出一堆零散破碎的事實片段，而永遠無法拼湊出一份結構嚴謹的深度洞察報告。
- **複雜除錯場景。** 缺乏集中式的全域執行日誌，加上完全非同步的並行交織，使得在群體架構下重現並定位一個偶發性 bug 的代價高昂到令人卻步。

### Matrix 框架（arXiv:2511.21686）

Matrix 是 2025 年將群體架構推向極致境界的代表性論文：它將系統的控制流（Control flow）與資料流（Data flow）全部統一序列化為在分散式佇列上穿梭的標準訊息。徹底根絕了中心協同器。系統的容錯能力直接轉嫁給底層訊息的持久化保證；而系統的水平擴展性則直接成為訊息代理器（Message broker）的責任，而不再是應用層的包袱。

其核心技術貢獻：確立了一套嶄新的程式設計模型，讓多 Agent 協同的核心問題從傳統的「監督者下一步該挑選哪位 Agent？」徹底昇華為「該 Agent 應當訂閱哪一個訊息主題（Topic）？」。這讓整個多 Agent 系統在架構外觀上宛如一座高度成熟的發布／訂閱（Pub/Sub）事件網格。

### 圖結構框架中的群體實現

LangGraph 2025 年官方文件明確將「群體架構」列為其核心多 Agent 模式之一：各 Agent 依然表現為節點，但節點之間的圖邊構成了一個允許迴圈循環的有向圖，任何節點皆能依據條件自發從共享池中被啟動。工作者依據條件動態認領可執行的工作，而非被動接受監督者的強制指派。

### 典型的系統失效模式：飢餓與熱點

若所有工作者皆自發爭搶最容易完成的輕量任務，耗時甚長的艱難任務將會長期滯留在佇列底部無人問津，直到佇列中只剩下它們為止。這是經典的佇列任務飢餓（Starvation）現象。

標準工程緩解手段：
- 引入具備動態老化加權的優先級佇列（隨著等待時間拉長，自動逐步調高任務的優先權）。
- 工作者專業化分工：指定一部分專屬工作者專門認領長任務。
- 背壓機制（Back-pressure）：嚴格限制高頻輕量任務進入佇列的速度。

### 基於內容的路由關聯

群體架構能與基於內容的路由機制（第 22 課）天然完美契合。與其使用單一的大雜燴通用佇列，不如為每種訊息型別劃分專屬佇列。專業工作者僅訂閱專屬於自身領域的主題。這正是訊息匯流排架構得以輕鬆擴展至成千上萬個 Agent 的基石。

```figure
sw-work-stealing
```

## Build It｜動手實作

`code/main.py` 透過 Python 標準函式庫實現了一個由 4 個工作者執行緒共同從共享 `queue.Queue` 中拉取任務的群體系統。各任務具備高度波動的耗時特徵（部分極快，部分極慢）。展示程式生動對比了三種模式：

- **循序串聯基準線（Sequential baseline）**：由單一工作者依序串聯處理所有任務。
- **固定指派模式（Fixed assignment）**：每個任務預先靜態指派給特定工作者（類監督者風格）。
- **群體架構模式（Swarm）**：各工作者動態自發從共享佇列中搶單執行。

群體架構展現出驚人的自發負載平衡能力；而在固定指派模式下，當某位工作者不幸被分派到長任務時，其餘動作飛快的工作者只能被迫陷入無所事事的漫長空轉。

執行指令：

```
python3 code/main.py
```

輸出將詳細呈現每位工作者實際消化的任務數量（群體模式下的分配是不均勻但整體最佳化的），以及顯著縮減的端到端實際耗時。

## Use It｜實際應用

`outputs/skill-swarm-fit.md` 能客觀評估一項給定任務究竟應當採用群體架構還是監督者模式。評估維度包含：任務獨立性、工時波動變異數、嚴格順序要求，以及系統除錯可觀測性需求。

## Ship It｜交付成果

群體架構上線前的必備工程檢查清單：

- **配備動態老化特性的優先級佇列。** 堅決防範長時程任務陷入永久性飢餓。
- **保證工作者具備嚴格冪等性（Worker idempotency）。** 若工作者在執行中途不幸崩潰，該任務可能會被重新推回佇列並被二次認領。工作者邏輯必須具備重複執行結果不變的冪等保證。
- **引入持久化訊息佇列。** 在正式環境中，必須採用 Kafka、Redis Streams 或具備資料庫備援的實體佇列。標準函式庫的 `queue.Queue` 僅屬純記憶體暫態。
- **逐任務級別的全鏈路可觀測性。** 每個任務皆必須指派唯一的 Trace ID；每位工作者在啟動與完成時皆必須嚴格記錄該 ID。
- **背壓防禦機制（Back-pressure）。** 一旦佇列積壓的速度遠超過工作者群體的消化能力，必須及時通知上游生產者強制減速。

## Exercises｜練習

1. 執行 `code/main.py`。在耗時波動劇烈的負載情境下，群體架構相較於循序串聯模式提速了多少倍？相較於固定靜態指派又提速了多少？
2. 實現基於優先級的佇列變體（改採 `queue.PriorityQueue`）。依據任務資料中的重要性欄位動態指派優先權。觀察在源源不絕的持續負載衝擊下，低優先級任務是否會遭遇嚴重的飢餓現象。
3. 實作一個熱點偵測器（Hot-spot detector）：當任何工作者消化的任務總量超過最慢工作者的 3 倍時自動發出警報。思考這揭示了底層任務時長分布的何種深層特徵？
4. 閱讀 Matrix 論文（arXiv:2511.21686）的摘要與第 3 節。具體指出 Matrix 所甘願接受的一項代價妥協（換取極致擴展性），以及它所主動放棄的一項關鍵特性（可追溯性與確定性）。
5. 改造群體展示程式，使其採用由 `queue.Queue` 承載的 (task_type, payload) 元組任務佇列，並讓各工作者僅訂閱並處理特定類型的任務。當任務呈現高度異質性時，何種路由規則才是最為合理的？

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Swarm architecture | "Decentralized agents" | Workers pull from shared queue; no central orchestrator. |
| Event bus | "Agents subscribe to topics" | Message broker that routes tasks to workers by type or content. |
| Starvation | "Task never runs" | Low-priority task never gets picked because higher-priority work arrives continuously. |
| Hot-spotting | "One worker drowns" | Load imbalance where one worker gets most tasks. |
| Back-pressure | "Slow down the producer" | Mechanism that signals upstream to stop producing when the queue fills up. |
| Idempotent worker | "Safe to re-run" | A task processed twice produces the same result. Required because workers may crash mid-run. |
| Durable queue | "Survives crashes" | Queue backed by disk or replicated storage; tasks are not lost when a worker crashes. |
| Matrix framework | "Full message-passing swarm" | Both data and control flow are serialized messages on distributed queues. |

## Further Reading｜延伸閱讀

- [LangGraph workflows and agents — Swarm Architecture](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — 圖原生框架對群體架構的顯式支援規範。
- [Matrix — A Decentralized Framework for Multi-Agent Systems](https://arxiv.org/abs/2511.21686) — 全訊息傳遞驅動的純粹去中心化群體框架奠基之作。
- [Anthropic engineering — why supervisor not swarm in Research](https://www.anthropic.com/engineering/multi-agent-research-system) — 深刻揭示具體正式環境系統為何果斷挑選監督者而堅決摒棄群體架構的技術抉擇內幕。
- [AutoGen v0.4 actor-model docs](https://microsoft.github.io/autogen/stable/) — 基於事件驅動的 Actor 模型重構，相比 v0.2 的 GroupChat 更貼近群體架構本質。
