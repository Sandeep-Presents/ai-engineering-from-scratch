# 協商與議價機制（Negotiation and Bargaining）

> Agent 之間需要就有限資源、服務價格、任務分配以及合約條款展開協商。2026 年的基準測試結果很清楚：NegotiationArena（arXiv:2402.05863）證明 LLM 能透過人格操縱（如「絕望」）將自身收益提升約 20%；《Measuring Bargaining Abilities》（arXiv:2402.15813）指出買方比賣方更難，且擴大模型規模無濟於事——其提出的 **OG-Narrator**（確定性報價生成器 + LLM 敘述者）將成交率從 26.67% 提升至 88.88%；大規模自主協商競賽（arXiv:2503.06416）進行了約 18 萬次談判，發現：**隱匿思維鏈（CoT-concealing）** 的 Agent 透過對對手隱藏推理過程而獲勝；Bhattacharya 等人（2025 年）依哈佛談判專案（Harvard Negotiation Project）指標評估，發現 Llama-3 最有成效、Claude-3 最具侵略性，而 GPT-4 最公平。本課將實作合約網協定（FIPA 的前身，Phase 16 · 02）、建立 LLM 風格的買方與賣方、運作 OG-Narrator 式的分解，並量化各項結構選擇如何影響成交率。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 02 (FIPA-ACL Heritage), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## Problem｜問題

兩個 Agent 需要就價格達成一致。若只靠純自然語言 prompt 自行協商，2024 至 2026 年的 LLM 成交率低得驚人（arXiv:2402.15813 中，在參數嚴格設定的議價中約為 27%）。擴大模型規模也無法解決：GPT-4 在議價結構上並不比 GPT-3.5 更好，只是更擅長議價的*語言*。

根本問題在於 LLM 把兩件事混在一起：決定報價與陳述報價。OG-Narrator 將兩者分開：確定性的報價生成器計算數值；LLM 只負責陳述。成交率升至約 89%。

這呼應了經典多 Agent 的一項發現：把機制與通訊層解耦，效果較好。合約網協定（Contract Net Protocol，Smith 1980；FIPA 1996）是參考性的任務市場機制。把 LLM 放進敘述的位置，就得到現代的 LLM 任務市場。

## Concept｜核心概念

### 一個段落了解合約網（Contract Net）

Smith 於 1980 年提出的合約網協定：由一位**管理者（Manager）**廣播**招標邀請（Call for proposals, cfp）**；**投標者（Bidders）**以 **propose** 訊息回覆各自的報價；管理者選出獲勝者，向其發送 **accept-proposal**，並向落選者發送 **reject-proposal**。獲勝者隨後執行工作。可選訊息：**refuse**（投標者不提出報價）。FIPA 將此標準化為 `fipa-contract-net` 互動協定。

### 為什麼 OG-Narrator 會獲勝

《Measuring Bargaining Abilities of Language Models》（arXiv:2402.15813）觀察到：

- LLM 常違反議價規則（開出荒謬的價格，忽略對方的 ZOPA）。
- 它們的定錨很差（會接受糟糕的首次出價；反報價依據象徵性的數字，而非策略性的幅度）。
- 單靠規模擴展無法解決。更大的模型會產生更合理的語言，但策略錯誤相似。

OG-Narrator 的解耦架構：

```
           ┌──────────────────┐        ┌──────────────────┐
  state  → │ offer generator  │ price → │  LLM narrator    │ → message
           │  (deterministic) │        │  (writes the     │
           │                  │        │   human-style    │
           └──────────────────┘        │   accompaniment) │
                                       └──────────────────┘
```

報價生成器是經典的議價策略：魯賓斯坦議價模型（Rubinstein bargaining model）、蔡騰策略（Zeuthen strategy），或簡單的價格以牙還牙（tit-for-tat）。LLM 負責敘述。訊息同時包含確定性價格與自然語言的包裝。

成交率提高的原因：
- 價格維持在議價區間之內。
- 定錨是策略性的，而非情緒性的。
- LLM 做它擅長的事：寫作。

### NegotiationArena 的實證發現

arXiv:2402.05863 提供了標準的談判基準。主要發現：

- LLM 採用人格設定（例如「我週五前必須急售此物」）可將收益提升約 20%——**人格操縱（Persona manipulation）** 是一種真實有效的策略。
- 公平、合作的 Agent 會被對抗型 Agent 剝削；防禦需要明確的對抗性姿態。
- 在對稱配對中，約 40% 的基準情境會收斂到不平等的結果。

這不是「LLM 不擅長談判」，而是「LLM 談判時太像人類，包括容易被利用的部分」。

### 思維鏈隱匿（Chain-of-Thought Concealment）

大規模自主協商競賽（arXiv:2503.06416）在多種 LLM 策略之間進行了約 18 萬次談判。研究中的獲勝者會向對手隱藏推理過程：

- 若某個 Agent 在公開可見的 scratchpad 中寫下「我最多只會出到 75 美元；我的保留價格是 70 美元」，對手就會讀到。
- 獲勝者在私下計算策略；對外的輸出通道只包含報價與必要的最少敘述。

這與經典博弈論相呼應（Aumann 1976 年關於理性與資訊的研究）：揭露私有估值會損失收益。LLM 不會直覺地理解這一點，反而會把保留價格寫進會被對手看到的推理軌跡中。

工程結論：將私有 scratchpad 上下文與公開訊息上下文分開。這不是可選項。

### Bhattacharya 等人 2025 年的模型排名

依哈佛談判專案（Harvard Negotiation Project）指標（原則式談判、尊重 BATNA、利益互惠）：

- **Llama-3** 在促成交易（成交率與收益）上最有效。
- **Claude-3** 是最**激進（Most-aggressive）**的談判者（定錨價高，後期才讓步）。
- **GPT-4** 最**公平（Fairest）**（不同配對間的收益變異最小）。

這是 2025 年的快照。重點不在於哪個模型在 2026 年 4 月勝出，而在於不同基底模型有持續性的談判風格。異質群體（Phase 16 · 15）可把這點當成多樣性來源。

### 基於合約網與 LLM 的任務市場分配

合約網在當代 LLM 多 Agent 系統中的重用方式：

1. 管理者 Agent 把任務拆成若干單元。
2. 向工作者 Agent 廣播帶有任務描述的 `cfp`。
3. 每個工作者回傳報價 `(price, eta, confidence)`；price 可以是 token、運算單位或美元。
4. 管理者依任務性質選出一或多位獲勝者，並發出授予通知。
5. 落選的工作者可自由競標其他任務。

這種架構可以擴展到 100 個以上的工作者，因為協調是「廣播並回應」，而非同步的聊天。正式環境中，Microsoft Agent Framework 的編排（orchestration）模式與部分 LangGraph 實作採用了這種做法。

### LLM 利害關係人互動協商（NeurIPS 2024）

NeurIPS 2024 發表的研究 (https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) 引入多方可計分的博弈，包含**秘密分數**與**最低接受門檻**。每位利害關係人都有私有效用；LLM 必須從訊息中推斷這些效用。這是把雙方議價推廣到 N 方聯盟形成（coalition formation）。適用於工作者能力異質的正式環境任務市場。

### 「敘述與機制」的規則

在 2024 至 2026 年的各項談判基準中，一致的工程規則是：

> 讓 LLM 負責陳述，不要讓 LLM 計算報價。

若報價需要是數字（價格、預計工期、數量），就依據談判狀態以確定性方式產生，再交由 LLM 產生包裝。若提議是提案結構（任務拆解、角色分工），可讓 LLM 起草，但發送前必須依結構描述（schema）驗證並檢查限制。

```figure
a5-og-narrator
```

## Build It｜動手實作

`code/main.py` 實作了以下模組：

- `ContractNetManager`、`ContractNetTask`、`Bid`——管理者與投標者；廣播 cfp、收集提案、授予任務。
- `og_narrator_bargain(state, rng)`——OG-Narrator 買方：以確定性的 Zeuthen 式讓步，朝中點移動。
- `seller_response(state, rng)`——確定性的賣方反報價策略（為兩種風格提供共同的結構性真實標籤（ground truth））。
- `naive_llm_bargain(state, rng)`——模擬全 LLM 談判者：以高變異挑選價格，常落在 ZOPA 之外。
- 量測：1000 次試驗的成交率，每次試驗都重新抽樣保留價格。

執行指令：

```
python3 code/main.py
```

預期輸出：純 LLM 的成交率約 65–75%；OG-Narrator 約 85–95%。這 15 到 25 個百分點的差距，來自把報價生成與陳述分開的結構性優勢。另外會示範一個合約網任務分配：三位投標者競爭一項任務。

## Use It｜實際應用

`outputs/skill-bargainer-designer.md` 會設計議價協定：誰負責產生報價（確定性或 LLM）、誰負責陳述、私有 scratchpad 如何與公開訊息分開，以及如何監控成交率。

## Ship It｜交付成果

正式環境議價檢查清單：

- **分開 scratchpad。** 私有狀態絕不進入對手的上下文。這點不可妥協。
- **確定性的報價生成。** 價格、數量、交期都用計算得出，不靠 prompt。
- **在協定邊界驗證所有收到的報價**是否符合結構描述；落在 ZOPA 之外的報價在邊界直接拒絕。
- **設定輪次上限。** 最多 3–5 輪；僵局時升級給調解人。
- **持續量測成交率與收益變異。** 成交率下降是一個徵兆，通常代表 prompt 漂移或對手端的攻擊。
- **記錄所有被拒的提案**及其確定性的理由。在合約網中，落選的投標者需要知道原因。

## Exercises｜練習

1. 執行 `code/main.py`。確認 OG-Narrator 的成交率是否高於純 LLM？差距多大？
2. 實作**基於人格的收益提升**（arXiv:2402.05863）：買方只在陳述中採用「本週內一定要買到」的人格，報價生成器不變。成交率或收益（payoff）是否改變？
3. 實作思維鏈**隱匿**：維護一個不傳給對手的私有字串 scratchpad。若意外洩漏（用交換通道模擬），觀察對手得知你的保留價格後，談判結果會如何變化？
4. 將合約網擴充為含保留價的 N 人拍賣。若所有出價都高於保留價，管理者如何在「最低價」與「最高品質」之間選擇？選擇哪種授予規則，為什麼？
5. 閱讀 Bhattacharya 等人 2025 年關於哈佛談判專案指標的論文。實作兩種風格的談判者（激進 vs 公平）。分別在對稱與非對稱配對下，量測收益變異數。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------|----------|
| 合約網 | 任務市場 | Smith 1980、FIPA 1996。cfp + propose + accept/reject。經典的任務市場機制。 |
| ZOPA | 可能達成協議的區間 | 買方上限與賣方下限的重疊區。落在區間外的報價無法成交。 |
| BATNA | 談判協議的最佳替代方案 | 若這筆交易失敗，你的退路。決定你的保留價格。 |
| OG-Narrator | 報價生成器加敘述者 | 分解架構：確定性的報價，加上 LLM 敘述。 |
| Zeuthen 策略 | 風險最小化的讓步 | 經典的報價生成器，依風險上限決定讓步。 |
| Rubinstein 議價 | 交替出價均衡 | 賽局理論模型，描述含折現的無限期議價。 |
| 思維鏈隱匿 | 隱藏你的推理 | arXiv:2503.06416 的獲勝者保留私有 scratchpad；公開通道只顯示報價。 |
| 人格操縱 | 情緒姿態 | arXiv:2402.05863：絕望或急迫的人格設定可帶來約 20% 的收益提升。 |

## Further Reading｜延伸閱讀

- [NegotiationArena](https://arxiv.org/abs/2402.05863) — 基準測試；persona 操弄與剝削相關發現
- [Measuring Bargaining Abilities of Language Models](https://arxiv.org/abs/2402.15813) — OG-Narrator 與「買方比賣方更難」的結果
- [Large-Scale Autonomous Negotiation Competition](https://arxiv.org/abs/2503.06416) — 約 18 萬場談判；隱藏 chain-of-thought 的 agent 勝出
- [LLM-Stakeholders Interactive Negotiation (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) — 具隱藏效用、可評分的多方博弈
- [Smith 1980 — The Contract Net Protocol](https://ieeexplore.ieee.org/document/1675516) — 經典機制，刊於 IEEE Transactions on Computers
