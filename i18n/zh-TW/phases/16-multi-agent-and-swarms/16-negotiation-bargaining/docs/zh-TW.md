# 協商與議價機制（Negotiation and Bargaining）

> Agent 之間需要針對有限資源、服務價格、任務分配以及合約條款展開協商。2026 年的基準測試體系給出了無比清晰的圖景：NegotiationArena（arXiv:2402.05863）證明 LLM 能透過人格操縱（如「陷入絕境」）將自身收益提升約 20%；《Measuring Bargaining Abilities》（arXiv:2402.15813）指出買方比賣方更加難以勝任且模型規模擴展毫無幫助——其提出的 **OG-Narrator**（確定性報價生成器 + LLM 敘述者）將成交率從慘澹的 26.67% 一舉拉升至 88.88%；超大規模自主協商競賽（arXiv:2503.06416）在約 18 萬次真實談判中發現：**隱匿思維鏈（CoT-concealing）** 的 Agent 透過對對手隱藏真實推理過程獲得了壓倒性勝利；Bhattacharya 等人（2025 年）對照哈佛談判專案（Harvard Negotiation Project）指標評估，發現 Llama-3 最具成效、Claude-3 最富侵略性，而 GPT-4 則展現出最高的公平性。本課將親手實作合約網協定（FIPA 鼻祖，第 02 課）、打造具備 LLM 風格的買賣雙方、運作 OG-Narrator 解耦架構，並精準量化各項結構性抉擇對最終成交率的實質影響。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 02 (FIPA-ACL Heritage), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## Problem｜問題

兩個 Agent 需要就某項服務價格達成共識。若完全放任它們依賴純自然語言 prompt 自主協商，2024 至 2026 年的主流 LLM 在嚴格參數化的議價任務中成交率低得驚人（在論文 arXiv:2402.15813 的實測中僅有約 27%）。單純擴大模型參數量根本無法解決這個問題：GPT-4 在談判策略本質上並不比 GPT-3.5 高明；它僅僅是在談判的*辭藻修飾*上顯得更為動聽。

底層的核心病灶在於：LLM 混淆了兩項截然不同的職責——**計算報價**與**陳述報價**。OG-Narrator 提出了關鍵的解耦架構：由確定性的報價生成器精算具體數值；LLM 僅專注於撰寫說服性的口語陳述。整體成交率瞬間飆升至約 89%。

這精準呼應了經典多 Agent 系統的古老規律：將底層博弈機制與上層通訊語意解耦必勝。合約網協定（Contract Net Protocol，FIPA 1996 年標準；Smith 1980 年原創）正是最經典的任務市場機制。將 LLM 置入其文字敘述的卡槽中，你就能立即獲得一座現代化的 LLM 智慧任務市場。

## Concept｜核心概念

### 一個段落了解合約網（Contract Net）

Smith 於 1980 年提出的合約網協定：由一位**管理者（Manager）**廣播發布**招標邀請（Call for proposals, cfp）**；多位**投標者（Bidders）**透過發送帶有各自報價的 **propose** 訊息進行響應；管理者評估後選出獲勝者，向其發送 **accept-proposal** 並向落選者發送 **reject-proposal**。獲勝者隨後動手執行實質工作。可選訊息：**refuse**（投標者主動婉拒報價）。FIPA 將此標準化為經典的 `fipa-contract-net` 互動協定。

### 為什麼 OG-Narrator 能取得壓倒性勝利

《Measuring Bargaining Abilities of Language Models》（arXiv:2402.15813）深刻揭示了純 LLM 的致命盲點：

- LLM 經常在交鋒中主動違反議價規則（開出荒謬離譜的價格，完全無視雙方的潛在協議區間 ZOPA）。
- 它們的定錨效應極其脆弱（容易過早接受糟糕的首次出價；反報價往往依據象徵性數字而非戰略性幅度）。
- 純粹的模型規模擴展對此毫無幫助。更大的模型只會用聽起來極其合理的華麗語句，去包裝本質上完全相同的戰略性錯誤。

OG-Narrator 的解耦架構：

```
           ┌──────────────────┐        ┌──────────────────┐
  state  → │ offer generator  │ price → │  LLM narrator    │ → message
           │  (deterministic) │        │  (writes the     │
           │                  │        │   human-style    │
           └──────────────────┘        │   accompaniment) │
                                       └──────────────────┘
```

報價生成器（Offer generator）採用經典博弈論策略：例如魯賓斯坦議價模型（Rubinstein bargaining model）、蔡騰策略（Zeuthen strategy）或簡單的價格以牙還牙（Tit-for-tat）。LLM 則專注於敘述潤飾。發出的訊息同時包含嚴謹計算後的確定性價格與充滿說服力的人性化自然語言包裝。

成交率之所以大幅飆升的根本原因：
- 報價被硬性約束在合法的協議區間之內。
- 價格定錨具備清晰的數學戰略性，而非受情緒隨機波動。
- LLM 僅被指派執行其最擅長的任務：文字撰寫。

### NegotiationArena 的實證發現

論文 arXiv:2402.05863 建立了權威的談判基準。其震撼性結論包括：

- LLM 能夠透過採取特定人格設定（例如「我週五前必須急售此物否則將面臨破產」）將自身收益提升約 20%——**人格操縱（Persona manipulation）** 是一項確鑿有效的實戰策略。
- 講求公平、友善合作的 Agent 極易被惡意對抗型 Agent 殘酷剝削；系統必須配備顯式的對抗性防禦姿態。
- 在對稱設定的對局中，有高達約 40% 的情境最終收斂至極端不平等的剝削性結果。

這並非「LLM 不擅長談判」；而是「LLM 談判時過度擬真了人類的所有弱點，包括那些極易被算計與利用的脆弱本性」。

### 思維鏈隱匿（Chain-of-Thought Concealment）

超大規模自主協商競賽（arXiv:2503.06416）在數十種 LLM 策略之間運作了約 18 萬次真實談判。最終拔得頭籌的贏家策略，無一例外皆對對手**嚴密隱匿了自身的真實推理過程**：

- 若一個 Agent 在公開可見的暫存區（Scratchpad）中印出「我最高能接受 75 美元；我的真實保留價格底線是 70 美元」，對手將能直接看清其底牌。
- 獲勝的策略皆在私有通道內完成核心運算；公開對外通道僅輸出最終出價以及維持對話所需的最低限度文字包裝。

這精準呼應了經典博弈論（Aumann 1976 年關於理性與資訊結構的奠基研究）：洩露自身的私有估值必定會招致嚴重的收益損失。當前的 LLM 缺乏這種博弈直覺，經常樂此不疲地在公開推理軌跡中將自身底線全盤托出。

工程實踐的不可妥協鐵律：**必須將私有暫存上下文與公開通訊上下文進行物理隔離**。絕無妥協空間。

### Bhattacharya 等人 2025 年的模型風格排行榜

對照哈佛談判專案（Harvard Negotiation Project）指標（原則談判法、對最佳替代方案 BATNA 的尊重、利益互惠性）：

- **Llama-3** 在促成交易與斬獲收益上綜合**最具成效（Most-effective）**。
- **Claude-3** 展現出最為**強勢激進（Most-aggressive）**的風格（開出極高定錨價，在最後關頭才極其緩慢地讓步）。
- **GPT-4** 表現得最為**公平客觀（Fairest）**（跨越不同對局時的收益變異數最小）。

這是一幅 2025 年的實測快照。學習的重點不在於哪個模型在當下勝出——關鍵在於深刻意識到：不同的基底模型具備長期穩定的談判人格特質。在建構異質整合體系（第 15 課）時，這是一處極其寶貴的多樣性來源。

### 基於合約網與 LLM 的任務市場分配

合約網協定在當代 LLM 多 Agent 系統中的標準重生路徑：

1. 管理者 Agent 將大型目標拆解為多個可獨立執行的最小任務單元。
2. 向工作者 Agent 群體廣播發送帶有任務規格說明的 `cfp`。
3. 每個工作者回傳正式報價：`(price, eta, confidence)`，其中代價可以是 Token 消耗、GPU 算力單位或美元金額。
4. 管理者擇優挑選獲勝者（視任務性質可為單一或多個）並發送任務授予通知。
5. 落選的工作者立即釋放資源，可自由參與其他新任務的競標。

該架構能輕鬆擴展至 100 位以上的工作者，因為其協調本質上是「廣播-響應」的非同步機制，而非死板擁擠的同步多人聊天室。微軟 Agent Framework 的編排模式與 LangGraph 的多項工業級實作皆採用了此模式。

### 多利益關係人互動協商（NeurIPS 2024）

NeurIPS 2024 發布的里程碑研究 (https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) 引入了帶有**隱私效用評分**與**最低接受門檻**的多方可計分博弈遊戲。每個利益關係人皆擁有私有的效用函數；LLM 必須僅透過對話訊息去智慧推斷對方的真實偏好。這是將雙方談判向多方聯盟組建（Coalition formation）的自然泛化，極度適用於異質工作者能力的正式環境任務市場。

### 「敘述 vs 機制」的核心工程鐵律

貫穿 2024 至 2026 年所有談判基準測試，有一條歷久彌堅的永恆工程準則：

> 讓 LLM 負責陳述。絕不讓 LLM 計算出價。

若提議需要表現為具體數值（價格、預估工期、資源配額），必須直接依據當前談判狀態進行確定性計算，隨後交由 LLM 生成外層包裝。若提議需要表現為複雜的提案結構（任務拆解方案、角色分工權限），可允許 LLM 起草初稿，但在正式發送之前，必須嚴格依據結構化 Schema 進行約束檢驗與硬性門檻防護。

```figure
a5-og-narrator
```

## Build It｜動手實作

`code/main.py` 完整實作了以下模組：

- `ContractNetManager`、`ContractNetTask`、`Bid`——實現管理者與投標者之間的廣播 cfp、收集投標與授予任務閉環。
- `og_narrator_bargain(state, rng)`——實現 OG-Narrator 買方：採用確定性的蔡騰風格（Zeuthen-style）逐步向中間點發起微幅讓步。
- `seller_response(state, rng)`——確定性賣方反報價原則（為兩種風格提供完全一致的客觀受測基準線）。
- `naive_llm_bargain(state, rng)`——模擬純 LLM 談判者：產出變異數極大的隨機報價，頻繁跌出協議區間 ZOPA 之外。
- 實戰評測套件：在 1,000 次獨立對局中（每輪對局皆重新隨機抽樣保留價格底線），量化統計兩種風格的最終成交率。

執行指令：

```
python3 code/main.py
```

預期終端輸出：純 LLM 的成交率大約徘徊在 65-75% 區間；而 OG-Narrator 的成交率則高達 85-95%；這 15 到 25 個百分點的巨大鴻溝，精準彰顯了「將報價計算與文字陳述解耦」所帶來的壓倒性戰略優勢。程式隨後還會展示一場由三位投標者爭奪單一任務的標準合約網市場分配。

## Use It｜實際應用

`outputs/skill-bargainer-designer.md` 能為具體的商業任務設計一套專業的協商議價協定：明確界定由誰負責報價生成（確定性演算法 vs LLM）、由誰負責文字陳述、如何實現私有暫存區與公開通訊的物理隔離，以及如何建立即時成交率監控看板。

## Ship It｜交付成果

正式環境議價系統上線前的必備檢查清單：

- **嚴格物理隔離私有暫存區。** 私有底牌與保留價格絕對嚴禁流入對手可見的上下文視窗。此項毫無妥協餘地。
- **採用確定性數值報價生成器。** 價格、數量、交期：一律透過數學計算，嚴禁依賴 prompt 隨意臆造。
- **在協定邊界嚴格檢驗所有接收到的報價**是否符合 Schema。直接在閘門處拒絕任何跌出 ZOPA 的荒謬出價。
- **配置硬性輪次上限。** 限制最多進行 3-5 輪交鋒；在陷入僵局時自動升級轉交第三方調解機制。
- **持續監控成交率與收益變異數。** 成交率的異常下跌是一項關鍵前兆——通常暗示著出現了 prompt 語意漂移，或對手端發起了對抗攻擊。
- **詳盡落盤所有落選提議及其確定性淘汰理由。** 在合約網架構下，落選的工作者需要清晰獲知自身落敗的原因以便改進後續投標。

## Exercises｜練習

1. 執行 `code/main.py`。確認 OG-Narrator 在成交率上是否徹底擊敗純 LLM 模式？兩者之間的具體差距幅度為何？
2. 實現**基於人格的收益提升機制**（arXiv:2402.05863）——讓買方僅在陳述文字中採取「本週內必須緊急購得」的急迫人設，底層報價計算器保持不變。觀察成交率與最終平均成交價格是否產生了實質位移？
3. 實現思維鏈**隱匿機制**：維護一個專屬的私有字串暫存區，嚴禁傳遞給對手。如果不慎發生了資料外洩（模擬通道反轉），觀察對手在獲悉你的保留價格後會發起何種致命的定錨壓制？
4. 將合約網擴充為帶有底價保留機制的 N 人拍賣體系。當所有出價皆高於保留底價時，管理者該如何在「最低報價」與「最高品質承諾」之間進行權衡取捨？動手設計你的裁決公式並說明理由。
5. 閱讀 Bhattacharya 等人 2025 年關於哈佛談判專案指標的論文。實現兩種風格迥異的談判 Agent（強勢激進型 vs 公平協商型）。分別測量在對稱配對與非對稱配對下，雙方的收益分配變異數。

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Contract Net | "Task market" | Smith 1980, FIPA 1996. cfp + propose + accept/reject. The canonical task-market. |
| ZOPA | "Zone of possible agreement" | Overlap between buyer's max and seller's min. Offers outside it cannot close. |
| BATNA | "Best alternative to a negotiated agreement" | Your fallback if this deal fails. Sets your reservation price. |
| OG-Narrator | "Offer generator + narrator" | Decomposition: deterministic offer, LLM narration. |
| Zeuthen strategy | "Risk-minimizing concession" | Classical offer-generator that concedes based on risk limits. |
| Rubinstein bargaining | "Alternating-offer equilibrium" | Game-theoretic model for infinite-horizon bargaining with discounting. |
| CoT concealment | "Hide your reasoning" | Winners in arXiv:2503.06416 kept private scratchpads; public channel shows offer only. |
| Persona manipulation | "Emotional posturing" | arXiv:2402.05863: ~20% payoff gain from desperation/urgency personas. |

## Further Reading｜延伸閱讀

- [NegotiationArena](https://arxiv.org/abs/2402.05863) — 談判基準測試；深入揭示人格操縱與惡意剝削的權威論文。
- [Measuring Bargaining Abilities of Language Models](https://arxiv.org/abs/2402.15813) — OG-Narrator 架構與「買方難度遠高於賣方」的經典研究。
- [Large-Scale Autonomous Negotiation Competition](https://arxiv.org/abs/2503.06416) — 18 萬次真實談判對抗；證明思維鏈隱匿是致勝關鍵。
- [LLM-Stakeholders Interactive Negotiation (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) — 帶有隱私效用評分的多方可計分博弈基準。
- [Smith 1980 — The Contract Net Protocol](https://ieeexplore.ieee.org/document/1675516) — IEEE Transactions on Computers 上的歷史奠基之作。
