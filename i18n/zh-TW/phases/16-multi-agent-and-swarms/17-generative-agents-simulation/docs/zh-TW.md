# 生成式 Agent 與湧現式社會模擬（Generative Agents and Emergent Simulation）

> Park 等人於 2023 年（UIST '23，arXiv:2304.03442）在名為 **Smallville** 的虛擬小鎮沙盒中部署了 25 位 Agent，並確立了經典的三位一體架構：**記憶流（Memory stream）**（自然語言事件日誌）、**反思（Reflection）**（Agent 針對自身記憶流定期生成的高階綜合認知）以及**規劃（Plan）**（從天到小時的自頂向下行為規劃與動態調整）。整項研究的里程碑成果在於「情人節派對」的自發湧現：僅對單一 Agent 注入「想在情人節舉辦派對」的初始種子，在完全未經任何後續腳本排定的情況下，邀請函在群體中自發擴散、各 Agent 自主協調行程，最終這群最初對此一無所知的 24 位 Agent 準時出席了派對。消融實驗證明這三大元件缺一不可。文獻記錄的典型失效主要為空間社會常規的理解偏差（闖入打烊店家、多人擠入單人廁所）。這套架構是 2026 年當代社會級 Agent 模擬與群體智慧評估的黃金參考標準。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 13 (Shared Memory)
**Time:** ~75 minutes

## Problem｜問題

絕大多數工業級多 Agent 系統皆屬於高度腳本化的特化團隊：規劃者負責規劃、工程師負責編碼、審查員負責審查。這在邊界明確的確定性任務中運作良好。但它完全無法捕捉當 Agent 擁有長期記憶、自發意圖與開放世界環境時，所自然展現出的**非腳本化湧現行為（Emergent behavior）**。學術研究、社會經濟學模擬以及現代遊戲 NPC AI，極度需要這種第二類 Agent 體系。

Smallville 架構正是這類系統的權威基準。在 Park 等人 2023 年的突破之前，最頂尖的 Agent 模擬充其量只是膚淺的硬編碼腳本跟隨者；在此之後，該模式實質成為開放世界生成式 Agent 的預設底座。在 2026 年打造任何 Agent 模擬系統，你要麼全面採用 Smallville 的三大核心元件，要麼必須提出極其嚴密的架構理由說明為何不採用。

## Concept｜核心概念

### 三大核心組成要素

**記憶流（Memory stream）。** 一份僅限附加（Append-only）的日誌，詳盡記錄各項觀察、行動、反思與規劃。每個條目皆包含時間戳記、事件類型、自然語言描述，以及三大衍生中繼資料：**新鮮度（Recency）**、**重要性（Importance）**（由 Agent 在寫入時自主打分 1-10）以及**相關性（Relevance）**（與當前查詢的餘弦相似度）。

```
[2026-02-14 09:12:03] observation: Isabella Rodriguez asked me if I like jazz
[2026-02-14 09:14:22] reflection:   I enjoy long conversations about music
[2026-02-14 10:05:00] plan:         Attend Isabella's Valentine's Day party tonight
```

記憶檢索綜合計算這三項分數：`score = w_recency * e^(-decay * age) + w_importance * importance + w_relevance * cos_sim`。最終排名前 k 名（Top-k）的條目會被注入當前 prompt 中。

**反思（Reflection）。** 週期性地（每累積 N 筆記憶或遭遇重大關鍵事件時），Agent 會從近期的記憶碎片中提煉出更高階的綜合抽象認知。反思條目會被重新寫回記憶流中，並與一般記憶一樣可被檢索調閱。這正是 Agent 建立深層「世界理解」的機制——等價於認知架構中的長期信念。

**規劃（Plan）。** 自頂向下的階層式任務分解。首先擬定宏觀的一日總體規劃（「去上班，晚上與 Klaus 聚餐」）。隨後進一步細化為每小時規劃。最後落地為具體單一步驟動作。規劃具備可修訂性：一旦接收到的新觀察與既定規劃發生衝突，Agent 會主動重新排程受影響的局部區段。

### 為什麼三者缺一不可（消融實驗）

Park 等人在論文中進行了嚴格的消融實驗，分別移除觀察、反思與規劃。每一次移除皆會對擬真度帶來毀滅性打擊：

- 缺乏**觀察**：Agent 會徹底喪失即時環境感知，固執地依據過時的陳舊信念做出荒謬動作。
- 缺乏**反思**：Agent 無法形成高階認知抽象；人際互動始終停留在膚淺隨機的問答層面。
- 缺乏**規劃**：行為全面退化為被動的反應雜訊；宏觀目標迅速消散殆盡。

人類評審員給予的「擬真度（Believability）」評分在三者齊備時達到最高峰；拿掉其中任何一項，皆會引發顯著的品質斷崖。

### 情人節派對的經典湧現現象

單一 Agent Isabella Rodriguez 被注入了「希望於 2 月 14 日下午 5 點在 Hobbs 咖啡廳舉辦情人節派對」的單純初始種子。其餘 24 位 Agent 完全未曾獲得任何預設指令。在隨後的虛擬天數中：

1. Isabella 的一日規劃中自然生成了「邀請鎮民」的子任務。
2. 每一份發出的邀請函，皆化為鄰居記憶流中的一筆全新客觀觀察條目。
3. 該鄰居在反思週期中自然提煉出全新信念：「Isabella 正在籌備一場派對。」
4. 該鄰居隨後將「2 月 14 日參加派對」納入了自身未來的行事曆規劃中。
5. 鄰居在日常閒聊中主動將此消息分享給其他鄰居。邀請函在毫無中心協調的情況下自發在全鎮擴散開來。
6. 2 月 14 日下午 5 點整，多位 Agent 準時自主匯聚於 Hobbs 咖啡廳。

這正是嚴格技術意義上的「湧現（Emergence）」：全域系統級的複雜協同行為（成功舉辦一場熱鬧派對），完全源自於局部的個體互動（點對點雙邊邀請 + 自主日程規劃），期間不存在任何中央編排者。

### 文獻記載的經典失效模式

Park 等人在論文中毫不避諱地坦誠揭露了以下結構性缺陷：

- **空間常規認知偏差。** Agent 經常大搖大擺地闖入早已打烊的店家。多個 Agent 試圖同時擠進同一間單人洗手間。Agent 在根本不該進食的非用餐場所用餐。單純的模型無法自發從虛擬環境中推斷出隱性的社會實體規範。
- **記憶體無界膨脹。** 隨著模擬時間拉長，記憶檢索的計算開銷呈幾何級數攀升。實戰解法：實施週期性的記憶壓縮（摘要並剪裁無關雜訊），並對低重要性條目施加指數衰減。
- **反思幻覺（Reflection hallucination）。** 反思過程可能會憑空捏造出原本根本不存在於記憶流中的人際關係。緩解手段：在反思 prompt 中強制包含原始記憶 ID，並在檢索時執行嚴密的事實校驗。

任何在 2026 年打造 Agent 模擬的工程團隊，皆必然會全盤繼承這批經典挑戰。

### 三大元件的工程落地鐵律

1. **記憶流強制維持「僅限附加」特性。** 絕對嚴禁就地竄改歷史記憶。任何修正必須表現為全新的一筆修正條目。
2. **重要性評分計算極其廉價。** 在條目寫入的瞬間，讓 LLM 一氣呵成給出 1-10 的評分。隨後將該分數落盤快取。
3. **檢索採用多維綜合排序，而非粗暴硬性過濾。** 依據三維綜合加權分數選取 Top-k；嚴禁使用一刀切的硬性過濾器（這會導致寶貴的邊緣上下文徹底遺失）。
4. **反思採用週期性批次觸發。** 當未處理記憶的重要性總和累計突破特定門檻（例如 150 分）時自動觸發。
5. **規劃具備局部可微修訂性。** 當全新觀察與既定規劃衝突時，僅針對受影響的局部的時間片段進行重新規劃，絕不推倒重來。

### 生成式 Agent 超越 Smallville 的現代擴展

2024 至 2026 年的後續文獻在該架構之上展開了深度的產業化拓展：

- **用於政策驗證與市場調研的社會級模擬。** 建立數千個類 Smallville Agent，模擬全體用戶在面對特定新功能或法規政策時的自發反應。速度遠勝傳統 A/B 測試，雖然其預測準確性仍有爭議。
- **下一代遊戲 NPC AI。** 角色扮演遊戲（RPG）透過導入該架構，徹底擺脫死板的預設支線任務，自發湧現出千變萬化的動態故事情節。
- **生成式 Agent 的專屬品質評測基準。** 評估指標從單純的「任務準確率」，轉向「長時間執行下個體行為的合理連貫性與擬真度（Believability）」。

Smallville 是經典的母體架構。現代的演進主要是在替換底層零件（例如將純記憶體替換為向量資料庫、引入檢索增強反思、導入神經符號規劃器），但始終恪守著三位一體的骨幹架構。

### 這對多 Agent 工程學的啟示

Smallville 是多 Agent 湧現機制在工程上可行且代價廉價的終極概念驗證。如今該架構已能在開源模型上順暢復現。任何需要**湧現式社會協同行為**的正式環境系統，皆應以此架構為起點。而任何需要**高精度嚴格任務執行**的系統，則應當堅決採用本階段前面幾課所傳授的監督者、角色分工以及原語模型。

```figure
a5-memory-reflection
```

## Build It｜動手實作

`code/main.py` 透過純 Python 標準函式庫實現了這三大核心元件，並搭配腳本化原則模擬 Agent 行為（完全不依賴外部真實 LLM）。該展示精巧復現了微縮版的情人節派對自發湧現全過程：

- `MemoryStream`——支援新鮮度、重要性與相關性綜合加權檢索的僅限附加記憶流。
- `reflect(stream)`——針對近期高重要性記憶進行腳本化反思提煉。
- `plan(agent_state)`——依據當前信念狀態生成天層級與小時層級的行為規劃。
- 模擬場景：5 位 Agent。Agent 1 初始持有「下午 5 點舉辦派對」的種子目標。隨著虛擬時間推移，邀請函在鄰里間擴散，最終全員自主匯聚。

執行指令：

```
python3 code/main.py
```

預期終端輸出：逐個虛擬時間步（Tick）的詳細日誌。在最後一個時間步，5 位 Agent 中至少有 3 位的規劃行事曆中皆明確排定了參加派對，並準時抵達派對地點。單一的初始種子，在缺乏任何中央協同器的前提下，自發催生了一場完美協調的群體集會。

## Use It｜實際應用

`outputs/skill-simulation-designer.md` 能為具體的生成式 Agent 模擬系統產出完備的架構設計方案：明確界定 Agent 人口規模、記憶結構 Schema、反思觸發節奏、規劃時程跨度，以及整體擬真度評估指標。

## Ship It｜交付成果

正式環境模擬系統上線前的工程鐵律：

- **記憶流必須落盤於實體資料庫。** 在大規模場景下必須採用具備持久化能力的向量資料庫或 PostgreSQL。純記憶體僅限於原型驗證。
- **強制落盤每一項行動的記憶檢索軌跡。** 針對 Agent 的每一次決策，必須精確記錄是哪 Top-k 筆歷史記憶驅動了該動作。這是展開任何事後除錯的唯一生命線。
- **嚴格為每個 Agent 配置 Token 預算。** 每個時間步的「檢索 + 反思 + 規劃」涉及大量 LLM 呼叫。N 位 Agent × T 個時間步 × 每次步數開銷 會以驚人速度燒穿預算。
- **實施定期記憶壓縮。** 定期摘要並剪裁低重要性條目。資料保留策略是一項嚴肅的架構設計，絕非微不足道的實作細節。
- **顯式架設空間與社會常規校驗閘門。** 該架構無法自發學會物理世界的生活常規，必須透過外部環境規則強制約束其行為合法性。

## Exercises｜練習

1. 執行 `code/main.py`。確認是否確實有 3 位以上的 Agent 自發抵達派對。將 Agent 人口擴充至 10 位——觀察這項自發湧現現象是否依然能穩定發生？
2. 拿掉反思（Reflection）模組。觀察 Agent 的整體行為退化為怎樣的樣貌？對照 Park 2023 論文中的消融實驗結論進行交叉分析。
3. 引入一個相互競爭的對抗性種子目標（例如「Klaus 希望在下午 5 點舉辦一場學術演講」）。觀察全鎮 Agent 是走向陣營分裂，還是其中一個目標徹底佔據主導地位？究竟是哪些參數決定了最終的走向？
4. 加入空間物理約束：規定 Hobbs 咖啡廳最多只能同時容納 4 位訪客。模擬系統是否能優雅應對人流過載，抑或會直接觸發「多人硬擠單人廁所」的經典擁擠崩潰？
5. 閱讀 Park 等人論文（arXiv:2304.03442）第 6 節（湧現行為實驗）。挑選一項在本課微型展示中無法復現的進階複雜行為。若要成功重現它，你需要對底層架構的哪一個元件進行實質性強化？

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Memory stream | "The agent's diary" | Append-only log of observations, actions, reflections, plans. |
| Recency | "How new is the memory" | Exponential-decay score by age. |
| Importance | "How much does the agent care" | Self-rated 1-10 at write time. Cached. |
| Relevance | "How related to the current query" | Cosine similarity (embedding-based). |
| Reflection | "Higher-order belief" | Synthesis generated from recent memories, re-ingested as a new memory. |
| Plan | "Day/hour/action decomposition" | Top-down plan tree. Revisable when observations contradict. |
| Smallville | "Park 2023's sandbox" | 25-agent simulation that produced the Valentine's Day emergence. |
| Believability | "The quality metric" | Human-rater score for whether behavior seems like a plausible agent. |

## Further Reading｜延伸閱讀

- [Park et al. — Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442) — 奠基之作，生成式 Agent 的標準參考架構。
- [UIST '23 paper page](https://dl.acm.org/doi/10.1145/3586183.3606763) — 官方頂級人機互動研討會發布頁面。
- [Smallville code release](https://github.com/joonspk-research/generative_agents) — 官方參考 Python 實作開源專案。
- [Hayes-Roth 1985 — A Blackboard Architecture for Control](https://www.sciencedirect.com/science/article/abs/pii/0004370285900639) — 結構化記憶 Agent 的經典先驅文獻。
