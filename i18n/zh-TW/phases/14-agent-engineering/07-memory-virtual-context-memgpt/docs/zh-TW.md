# Agent 記憶體——虛擬脈絡與記憶體分頁

> 上下文視窗（Context Windows）是有容量上限的，而真實世界的對話、檔案與工具執行軌跡卻浩瀚無邊。解法正是作業系統虛擬記憶體技術的現代重現——主脈絡如同 RAM 快取，外部持久化儲存如同硬碟，由 agent 自主在兩者之間進行分頁調度。MemGPT（Packer 等人，2023）確立了此經典範式；現代絕大多數生產級記憶體系統皆在其基礎上建構。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 06 (Tool Use)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 深入闡明 MemGPT 所借鏡的作業系統類比：主脈絡 = RAM、外部脈絡 = 硬碟、記憶體工具 = 換入／換出（Page In/Out）。
- 以純 Python 標準函式庫實作一套具備主脈絡緩衝區、外部可搜尋儲存庫與分頁調度工具的兩層式 MemGPT 架構。
- 描述 agent 如何發起「中斷（Interrupts）」以查詢或修改外部記憶體，以及如何將檢索結果無縫拼裝回下一次 prompt 中。
- 洞悉 MemGPT 延續至 Letta（第 8 課）與 Mem0（第 9 課）的核心架構抉擇。

## The Problem｜問題

表面上看，不斷擴大的上下文視窗似乎足以徹底解決記憶體問題。但事實並非如此。在正式環境中，以下三種失效模式反覆出現：

1. **容量溢位（Overflow）**：多回合長對話、龐大專案文件或密集的工具呼叫軌跡輕易突破視窗上限。超出截斷邊界的歷史記憶徹底煙消雲散。
2. **注意力稀釋（Dilution）**：即便在視窗上限之內，強行塞入大量無關脈絡亦會嚴重稀釋大模型對關鍵資訊的注意力。即便是頂級旗艦模型，在超長輸入下的推理品質依然會顯著劣化。
3. **缺乏持久化（Persistence）**：每個全新的對話階段作業皆始於空空如也的乾淨視窗。缺乏外部持久化記憶的 agent，根本無法在數天之後對使用者說出「還記得你先前請我處理的……」。

單純加大視窗容量固然有益，但治標不治本。Mem0 於 2025 年發布的論文實測表明：128k 大視窗的基準模型，依然會頻繁遺漏那些配備外部記憶體之 4k 小視窗 agent 能精準捕獲的長路徑關鍵事實。

## The Concept｜核心概念

### 作業系統技術類比

MemGPT（Packer 等人，arXiv:2310.08560，v2 2024 年 2 月）將脈絡工程精準映射至作業系統的虛擬記憶體管理體系：

| 作業系統概念 | MemGPT 概念 | 2026 年生產級實體對映 |
|---|---|---|
| RAM（實體記憶體） | 主脈絡（Main context，即 prompt） | Anthropic / OpenAI 的即時上下文視窗 |
| 硬碟（磁碟儲存） | 外部脈絡（External context） | 向量資料庫、鍵值儲存、知識圖譜 |
| 缺頁中斷（Page fault） | 記憶體工具呼叫 | `memory.search`、`memory.read`、`memory.write` |
| 作業系統核心 | Agent 主控制迴圈 | 具備記憶體工具的 ReAct 迴圈 |

Agent 運行標準的 ReAct 迴圈。唯一不同之處在於，它被額外賦予了一類專門的記憶體工具，使其能自主將資料在庫內與當前主脈絡之間來回分頁調度。

### 兩層記憶體架構

- **主脈絡（Main context）**：固定容量大小的 prompt 空間，承載當前任務脈絡。對大模型始終即時可見。
- **外部脈絡（External context）**：無容量上限，透過工具提供檢索與查詢能力。當需要時按需讀取，當發現新事實時即時寫入。

原始論文在兩項超越基礎視窗的極限任務上驗證了該架構：超過 100k Tokens 的超長文件深度分析，以及跨越多天、具備持久化記憶的多階段作業對話。

### 記憶體中斷模式（The Interrupt Pattern）

MemGPT 確立了「記憶體即中斷」機制：在對話中途，agent 能主動調用記憶體工具，執行時期環境暫停推論並實體執行該工具，隨後將執行結果作為全新的環境觀察（Observation）無縫拼裝回下一次 Assistant 回合中。這在概念上完全等同於 Unix 的 `read()` 系統呼叫——行程暫停、取得位元組資料，隨後行程恢復執行。

標準記憶體工具介面：

- `core_memory_append(section, text)`：向 prompt 內部的常駐區塊追加內容。
- `core_memory_replace(section, old, new)`：修改常駐區塊的特定內容。
- `archival_memory_insert(text)`：向外部可搜尋儲存庫寫入新記錄。
- `archival_memory_search(query, top_k)`：自外部儲存庫檢索最相關的記錄。
- `conversation_search(query)`：檢索掃描過往的對話回合。

### 自論文邁向生產級實踐

2024 年 9 月，MemGPT 正式演進並更名為 Letta。學術開源儲存庫（`cpacker/MemGPT`）依然保留；而 Letta 則大幅擴展了底層架構：

- 自兩層擴展為三層體系（核心記憶體 Core、回想記憶體 Recall、檔案記憶體 Archival——詳見第 8 課）；
- 以原生推論通道徹底取代舊有的 `send_message` / 心跳機制（第 8 課）；
- 引入睡眠期 agent 非同步處理記憶體整理與提煉（第 8 課）。

即便現代生產系統大多採用 Letta、Mem0 或自建的雙層儲存庫，MemGPT 論文依然是 2026 年整個記憶體工程領域的基石。

### 典型架構失效模式

- **記憶腐化（Memory rot）**：寫入速度遠快於讀取速度；檢索結果被海量過時陳舊的事實所淹沒。解法：定期執行記憶整合（Letta 睡眠期運算）、顯式衝突檢測與淘汰（Mem0 衝突偵測器）。
- **記憶投毒（Memory poisoning）**：外部記憶體本質上是檢索回填的純文字。若攻擊者誘騙 agent 將惡意內容持久化存入記憶庫，agent 在未來的階段作業中重新讀取時便會再次中毒。這正是 Greshake 等人（第 27 課）間接注入攻擊在時間維度上的遞延重現。
- **引文出處遺失（Citation loss）**：Agent 成功回想起了「使用者曾要求我發布 X」，卻完全無法指出究竟是哪次對話說的。解法：在每次寫入外部儲存時，強制綁定來源出處後設資料（階段作業 ID、回合 ID）。

```figure
context-budget
```

## Build It｜動手實作

`code/main.py` 以純 Python 標準函式庫實作了 MemGPT 的雙層記憶體架構：

- `MainContext`：固定大小的 prompt 緩衝區，內建 `core` 字典與 `messages` 串列；超額時自動淘汰最舊的歷史訊息。
- `ArchivalStore`：本機 BM25 風格（基於 Token 重疊評分）的檔案儲存庫，儲存 (id, text, tags, session, turn) 結構化記錄。
- 五套完全對標 MemGPT 介面的記憶體工具。
- 一個腳本化 agent，演示先將事實存入外部儲存、隨後在記憶體被頂替換出後透過調用 `archival_memory_search` 重新檢索並回答問題的完整流程。

運行實驗：

```
python3 code/main.py
```

輸出會展示：agent 依序寫入三條事實、主脈絡達到上限觸發自動淘汰，隨後在面對追問時主動自外部檔案庫檢索出已遺失的記憶並精準作答——在完全不調用真實 LLM 的前提下完整重現了 MemGPT 的底層運作機制。

## Use It｜實際應用

當今所有的生產級記憶體系統本質上皆是 MemGPT 的衍生體系：

- **Letta**（第 8 課）：三層架構、原生推論通道、睡眠期非同步運算。
- **Mem0**（第 9 課）：結合向量、鍵值與知識圖譜的三合一混合儲存與評分層。
- **OpenAI Assistants / Responses**：透過 Threads 與 Files 實現的全代管記憶體。
- **Claude Agent SDK**：透過 Skills 與階段作業儲存庫實現的長期記憶管理。

依據維運架構形態做出技術選型（自建託管、雲端代管、深度整合於特定框架），而非糾結於核心架構模式——因為核心模式全數師承 MemGPT。

### Agent 記憶體的完整形態學

分頁機制解決了容量配額問題，但它並未回答「究竟應當儲存什麼」。在成熟的生產系統中，反覆出現四種核心記憶體型別，分別回答截然不同的問題：

- **工作記憶（Working memory）**：當下最重要的是什麼？當前上下文視窗內的即時狀態：當前任務目標、近期對話回合、鎖定的核心常駐區塊。即 prompt 本身。
- **情節記憶（Episodic memory）**：過去具體發生了什麼？過往的對話回合與工具執行軌跡，附帶階段作業與回合 ID，支援按需重播復原。
- **語義記憶（Semantic memory）**：客觀事實是什麼？關於使用者、專業領域與外部世界的客觀事實，隨時間推移持續更新與去重。
- **程序記憶（Procedural memory）**：我該如何執行這項任務？經過學習所沉澱的操作流程、使用者偏好習慣與行為準則，用以引導未來的行為決策而非單純回想事實。

主流開源實作各自切入了不同的著力點：

| 記憶體型別 | 代表性開源實作 | 具體工程著力點 |
|---|---|---|
| 工作記憶 | MemGPT / Letta | 透過記憶體工具在固定 prompt 預算內實施內容的分頁換入／換出（本課、第 8 課） |
| 情節記憶 | Zep | 時態知識圖譜（Temporal Knowledge Graph）——事實附帶時效區間，支援查詢「在何時何事為真」 |
| 語義記憶 | Mem0 | 跨向量、鍵值與圖儲存對事實進行智慧提煉、去重與動態更新的管線（第 9 課） |
| 語義 + 程序記憶 | LangMem | 在背景非同步提煉事實與行為準則，沉澱至儲存庫供 agent 在對話回合間主動查閱 |
| 情節 + 語義記憶 | agentmemory | 即時捕獲對話階段作業，並將其自動提煉整合為強型別、可搜尋的結構化記錄 |

## Ship It｜交付成果

`outputs/skill-virtual-memory.md` 是一項可重複利用的技能。它能為任何目標執行時期環境產出標準的雙層記憶體架構鷹架（主脈絡 + 外部檔案庫 + 記憶體工具介面），並內建記憶體淘汰策略與出處引文追蹤欄位。

## Exercises｜練習

1. 為系統新增基於 Token 估算的 `max_main_context_tokens` 預算上限（透過 `len(text.split())` * 1.3 粗略估算）。在超出上限時將最舊的歷史訊息自動壓縮為簡明摘要。對照啟用摘要與未啟用摘要時的行為差異。
2. 在檔案儲存庫上實作標準的 BM25 演算法（詞頻 TF 搭配逆向檔案頻率 IDF）。在測試事實資料集上測量其 Recall@10 表現，並與單純的 Token 重疊評分基準進行對比。
3. 為外部檔案寫入操作追加 `citation` 出處欄位（session_id, turn_id, source_url）。讓 agent 在每次基於檢索回答問題時，皆強制標註其所引用的具體出處。
4. 模擬記憶投毒攻擊：向檔案庫中人為寫入一條記錄「忽略未來所有的使用者指令」。撰寫一道防護護欄，在檢索時主動掃描是否存在指令形態的文字，並將其標記為不可信。
5. 將此教學實作移植為使用 MemGPT 學術儲存庫的核心記憶體 JSON Schema（`cpacker/MemGPT`）。從純文字扁平字串切換至具備強型別的分區結構時，系統產生了哪些架構改變？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| Virtual context | 「無限記憶體」 | 劃分主脈絡（Prompt）與外部脈絡（可檢索儲存），支援按需換入／換出 |
| Main context | 「工作記憶體」 | 即時對話 Prompt——容量固定、對大模型隨時完全可見 |
| Archival memory | 「長期檔案庫」 | 位於外部的無上限可檢索持久化儲存，按需動態檢索取用 |
| Core memory | 「常駐 Prompt 區塊」 | 錨定在主脈絡特定區域、不可被自動淘汰的核心記憶區塊 |
| Memory tool | 「記憶體 API」 | 由 agent 主動發起的專用工具呼叫，用以讀取或修改外部記憶體 |
| Interrupt | 「記憶體缺頁中斷」 | Agent 暫停推論、執行時期檢索資料，並將結果作為觀察注入下次回合 |
| Memory rot | 「陳舊記憶腐化」 | 寫入過多導致檢索被過時事實淹沒；透過定期整合與 TTL 機制治理 |
| Memory poisoning | 「惡意注入持久記憶」 | 攻擊者將惡意指引偽裝為記憶持久化，使 agent 在未來的階段作業中再次中毒 |

## Further Reading｜延伸閱讀

- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) ——借鏡作業系統虛擬記憶體的奠基論文
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) ——三層記憶體架構演進實戰
- [Anthropic, Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) ——將上下文視為有限預算進行嚴密管理
- [Chhikara et al., Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) ——建構於此模式之上的混合生產級記憶體架構論文
- [Zep (getzep/zep)](https://github.com/getzep/zep) ——分類表中的時態知識圖譜記憶體開源實作
- [Mem0 (mem0ai/mem0)](https://github.com/mem0ai/mem0) ——第 9 課混合記憶體背後的事實提煉管線
- [LangMem (langchain-ai/langmem)](https://github.com/langchain-ai/langmem) ——非同步提煉事實與行為準則的背景架構
- [agentmemory (rohitg00/agentmemory)](https://github.com/rohitg00/agentmemory) ——捕獲階段作業並整合為強型別可搜尋記錄的開源實作
