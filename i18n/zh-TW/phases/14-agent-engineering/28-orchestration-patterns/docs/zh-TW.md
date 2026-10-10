# 編排模式：監督者、群集與階層式架構

> 2026 年的主流框架反覆出現四大編排模式：監督者—工作者（Supervisor-worker）、群集／對等（Swarm / peer-to-peer）、階層式（Hierarchical）與多方辯論（Debate）。Anthropic 的權威指引強調：「成功的核心不在於打造最複雜的系統，而在於打造最切合業務需求的正確系統。」始終從簡潔出發；唯有在「單一 Agent + 五大工作流程模式」不足以支撐時，才允許引入複雜拓撲。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 25 (Multi-Agent Debate)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 指出業界高頻反覆出現的四大編排模式及其各自的最佳適用情境。
- 描述 2026 年 LangChain 的最新建議：為何推薦「基於直接工具呼叫的監督模式」而非封裝的監督者專用庫。
- 解釋 Anthropic「建構正確系統」的核心法則，以及該法則如何作為挑選拓撲結構的嚴格閘門。
- 以純 Python 標準函式庫對照共通的腳本化 LLM，端到端實作全部四種編排拓撲。

## The Problem｜問題

許多工程團隊往往在業務真正需要之前，過早盲目引入「多 Agent（Multi-Agent）」架構。事實上，跨框架反覆出現的僅有這四大核心模式；一旦你能為它們精準命名並理解其邊界，你便能游刃有餘地挑選出最合適的拓撲——或者乾脆果斷略過多 Agent 複雜度。

## The Concept｜核心概念

### 監督者—工作者模式（Supervisor-worker）

- 一個中央路由器 LLM 專職負責將任務分派給各領域專家 Agent。
- 決策邏輯：自我迴圈、委派移交給特定專家、終止流程。
- 各專家 Agent 之間**互不相通**；所有通訊與路由皆強制經過中央監督者。

主流實作：LangGraph `create_supervisor`、Anthropic 協調者—工作者模式、CrewAI 階層式流程。

**2026 年 LangChain 官方推薦**：直接透過常規的工具呼叫（Tool calls）來實作監督分派，而非直接調用黑箱的 `create_supervisor`。這賦予了工程師極致精準的脈絡工程控制權——由你完全決定每位專家能看見什麼、不能看見什麼。

### 群集／對等模式（Swarm / peer-to-peer）

- 各 Agent 之間透過共享的工具介面直接進行控制權移交（Handoffs）。
- 完全不存在中央調度中心。
- 響應延遲顯著低於監督者模式（更少的網路跳數）。
- 推理除錯難度更高（缺乏單一控制點）。

主流實作：LangGraph Swarm 拓撲、OpenAI Agents SDK 委派移交（當所有 Agent 皆獲准相互移交時）。

### 階層式架構（Hierarchical）

- 監督者管理次級監督者，次級監督者再管理基層工作者。
- 在 LangGraph 中實作為多層巢狀子圖（Nested Subgraphs）；在 CrewAI 中實作為巢狀團隊。
- 能擴展至容納大規模 Agent 群體，但代價是顯著攀升的系統維運複雜度。

何時真正需要：唯有當單一中央監督者的上下文視窗預算，已完全無法容納全體專家的功能描述時。

### 多方辯論模式（Debate）

- 平行提案者 + 迭代式交叉互相批判（第 25 課）。
- 嚴格而言它更偏向「驗收防禦機制」而非單純編排，但在許多框架中常被作為獨立的拓撲選項提供。

### 自主團隊（Crews）vs 確定性工作流程（Flows）

CrewAI 正式規範了兩種部署形態：

- **Flow**：事件驅動、程式碼掌控的確定性自動化流程（官方推薦的正式環境生產起點）。
- **Crew**：由模型主導的自主角色協同團隊。

這與上述四大模式是正交互補的：Flow 通常實作為監督者或階層式拓撲；而 Crew 則通常是以 LLM 作為路由器的監督者架構。

### Anthropic 的架構選型準則

「大模型領域的成功，不在於打造最複雜精巧的系統，而在於打造最切合你實際需求的正確系統。」

決策先後順序：

1. **單一 Agent + 五大工作流程模式**（第 12 課）——永遠從此起步。
2. **監督者—工作者**：當你擁有 2 到 4 個明確的專業專家時。
3. **對等群集（Swarm）**：當響應延遲的重要性遠高於推理邊界的清晰度時。
4. **階層式架構**：唯有當單一監督者的脈絡預算徹底耗盡時方可考慮。
5. **多方辯論**：當正確性的重要性遠高於 Token 成本時。

### 典型架構失效模式

- **拓撲先行的本末倒置思考**：在尚未釐清多 Agent 究竟能解決何種痛點前，便盲目宣告「我們必須做多 Agent」。
- **群集架構中的乒乓反彈死迴圈**：A 移交給 B，B 又移交回 A。必須強制實施跳數計數器（Hop counter）。
- **為架構而架構的虛假階層**：單純為了顯得具備「企業級架構」而硬套三層階層，實質上底層只有兩個小團隊。請果斷拍平收斂。

```figure
orchestration-pattern
```

## Build It｜動手實作

`code/main.py` 以純 Python 標準函式庫對照腳本化 LLM 實作了全部四大模式：

- `Supervisor`：中央路由器架構。
- `Swarm`：具備直接移交機制的對等群集。
- `Hierarchical`：監督者管轄次級監督者的階層體系。
- `Debate`：平行提案 + 交叉批判收斂。

所有模式皆處理完全相同的三意圖任務（退款、錯誤、銷售）。各模式的日誌結構截然不同。

運行實驗：

```
python3 code/main.py
```

輸出會對比各模式的執行軌跡與運算操作次數：監督者模式最乾淨清晰；群集模式步驟最短；階層模式層級最深；而辯論模式成本最為高昂。

## Use It｜實際應用

- **LangGraph**：監督者與階層式架構（巢狀子圖）的首選。
- **OpenAI Agents SDK**：將委派移交作為工具調用（標準監督者形態）。
- **CrewAI Flow**：正式環境確定性工作流程的最佳實踐。
- **自建架構**：多方辯論或需要對底層控制流程實施極致掌控時。

## Ship It｜交付成果

`outputs/skill-orchestration-picker.md` 能依據業務需求精準選定拓撲結構，並產出標準的實作程式碼鷹架。

## Exercises｜練習

1. 透過移除中央路由器，將監督者模式重構為對等群集（Swarm）。哪些環節產生了崩潰風險？哪些指標獲得了改善？
2. 為群集架構新增跳數計數器：在超過 3 次移交後堅決拒絕。觀察它如何精準捕獲 A->B->A 的乒乓死迴圈。
3. 為包含 12 個專家的複雜業務領域打造兩層階層式系統。若不採用巢狀結構，分析單一監督者的上下文預算在何處最先耗盡？
4. 在具備生產形態的負載上，對四大模式進行基準效能剖析。哪種模式在延遲、成本、準確率與除錯難度上分別勝出？
5. 研讀 Anthropic 的《Building Effective Agents》專題文章。將你目前的線上業務流程逐一對映至這四大模式。是否存在任何無法乾淨對映的特殊邊界？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| Supervisor-worker | 「中央路由器 + 專家」 | 中央 LLM 分派任務給各專家；專家之間完全互不通訊 |
| Swarm | 「對等群集 P2P」 | 各 Agent 透過共享工具直接移交控制權；無中央調度中心 |
| Hierarchical | 「監督者的監督者」 | 透過多層巢狀子圖容納大規模 Agent 群體的分層體系 |
| Debate | 「提案 + 交叉批判」 | 多個平行提案者透過 R 輪交叉反思收斂共識（第 25 課） |
| Tool-call-based supervision | 「純工具監督模式」 | 直接透過常規工具呼叫實作監督者，以實現精細的上下文工程控制 |
| Crew | 「自主協同團隊」 | CrewAI 由大模型主導的開放性探索協同模式 |
| Flow | 「確定性工作流程」 | CrewAI 由程式碼主導的事件驅動生產級工作流程 |

## Further Reading｜延伸閱讀

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) ——五大模式與工作流程 vs Agent 權威指南
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) ——監督者、群集與階層式圖架構
- [CrewAI docs](https://docs.crewai.com/en/introduction) ——Crew vs Flow 生產實踐手冊
- [Du et al., Society of Minds (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325) ——多 Agent 辯論奠基論文
