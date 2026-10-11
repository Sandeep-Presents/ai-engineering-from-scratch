# OpenAI 準備度框架與 DeepMind 前沿安全框架（OpenAI Preparedness Framework and DeepMind Frontier Safety Framework）

> OpenAI 準備度框架 v2（Preparedness Framework v2，2025 年 4 月發布）引入了與「受追蹤類別（Tracked Categories）」截然分立的「研究類別（Research Categories）」——涵蓋長程自主性（Long-range Autonomy）、蓄意裝笨（Sandbagging）、自主複製與適應，以及破壞安全防護機制。受追蹤類別會直接觸發能力報告與防護報告，並交由安全諮詢委員會（SAG）審查。DeepMind 的 FSF v3（2025 年 9 月發布，並於 2026 年 4 月 17 日追加了「受追蹤能力等級」）則將自主性拆解並折疊進機器學習研發與網路安全兩大領域（機器學習研發自主性等級 1 定義為：以媲美「人類加 AI 工具」的具競爭力成本，全自動化 AI 研發管線）。FSF v3 明確承諾針對工具性推理濫用部署自動化監控以防禦欺騙性對齊。客觀的現實提醒：OpenAI PF v2 中的研究類別（包含長程自主性）並不會自動觸發任何強制緩解措施，政策用語僅為「潛在（potential）」措施；DeepMind 自身亦坦言：若工具性推理能力進一步增強，自動化監控「在長遠來看將不足以維持安全」。

**Type:** Learn
**Languages:** Python (stdlib, three-framework decision-table diff tool)
**Prerequisites:** Phase 15 · 19 (Anthropic RSP)
**Time:** ~45 minutes

## The Problem｜問題

第 19 課深入剖析了 Anthropic 的擴展政策。本課則透過細讀 OpenAI 與 DeepMind 的同類架構，拼湊出完整的產業治理圖景。這三份核心文件本質上是兄弟產物，共同回答同一個核心問題——尖端實驗室究竟該在何時暫停訓練或設定模型發布閘門。它們在少數核心類別上達成了高度共識，卻在至關重要的具體條款上產生了顯著分歧。

共識之處：三家機構皆將「長程自主性」視為必須持續追蹤的重大能力類別；皆承認欺騙性行為（對齊造假、蓄意裝笨）屬於獨立且危險的風險類別；且內部皆設有專門的審查機構。分歧之處：OpenAI 將危害類別人為割裂為「受追蹤」（強制採取緩解防護）與「研究類別」（僅觀測而不自動觸發實質措施）；DeepMind 則選擇將自主性拆解並融入具體危害領域，而非將其單獨列為獨立維度。實驗室在命名上可能稱為「受追蹤 vs 研究」，或「嚴重 vs 中度」，亦或「第一級 vs 第二級」；然而某項能力被歸入哪一個分類桶中，在不同實驗室之間所引發的實質維運後果大相逕庭。

將三者並列研讀是一項極具啟發性的工程演練。同一項前沿能力，在 Anthropic 可能屬於「強制防禦緩解」，在 OpenAI 可能屬於「受監控但不觸發動作」，在 DeepMind 則屬於「在特定領域中受追蹤」。背後的政策治理姿態至關重要。

## The Concept｜核心概念

### OpenAI 準備度框架 v2（2025 年 4 月）

架構設計：

- **受追蹤類別（Tracked Categories）**：直接觸發能力報告（說明模型能做到何種程度）與防護報告（說明已部署何種緩解防禦）。在模型部署前必須經過安全諮詢委員會（Safety Advisory Group, SAG）的嚴格審查。
- **研究類別（Research Categories）**：實驗室正在密切追蹤、但尚未做出明確強制緩解承諾的模型能力。包含長程自主性、蓄意裝笨、自主複製與適應，以及破壞安全防護機制。

v2 版的關鍵核心定調：研究類別**不會**自動觸發任何強制緩解措施。政策文本中所使用的字眼是「潛在（potential）」緩解措施。這是研讀時必須緊盯的關鍵差異：一項能力被歸類在「受追蹤」還是「研究類別」，是決定該能力會遭遇「實質卡關」還是僅僅被「記錄觀察」的關鍵樞紐。

### DeepMind 前沿安全框架 v3（2025 年 9 月；2026 年 4 月 17 日追加追蹤能力等級）

架構設計：

- **關鍵能力等級（Critical Capability Levels, CCLs）**：跨越五大領域的能力門檻：網路攻擊（Cyber）、生物危害（Bio）、機器學習研發（ML R&D）、生化核武（CBRN），以及自主性（被直接拆解並融入機器學習研發與網路安全之中）。
- **受追蹤能力等級（Tracked Capability Levels）**：於 2026 年 4 月新增的更細緻顆粒度標準。具體代表性範例：機器學習研發自主性等級 1 = 以媲美「人類加 AI 工具」的具競爭力成本，全自動化整條 AI 研發管線。
- **欺騙性對齊監控（Deceptive alignment monitoring）**：明確承諾針對工具性推理的惡意濫用部署全自動化即時監控。

其對自主性的認知框架與 OpenAI 截然不同。DeepMind 並未將「自主性」保留為獨立的一級領域；而是將其直接折疊進自主性可能造成實質破壞的具體領域中（機器學習研發與網路安全）。支持該架構的論點是：缺乏具體作用領域的抽象自主性，只是單純的能力而無直接危害；反對者的論點則是：跨領域的通用自主性本身就是一種元風險（meta-risk），框架理應賦予其獨立的地位。

### 三大機構框架的趨同共識

- 內部安全諮詢小組（Anthropic 稱為 SAG、OpenAI 稱為 SAG、DeepMind 稱為內部委員會）。負責在發布高能力模型之前進行強制審查。
- 明確將欺騙性對齊／對齊造假定性為重大獨立風險類別。
- 確立常設性報告並宣稱定期更新（Anthropic：前沿安全路線圖、風險報告；OpenAI：能力與防護報告；DeepMind：FSF 更新循環）。
- 共同承認單純依賴監控的防禦手段具有不可逾越的理論天花板。DeepMind 明確指出：「長期來看，自動化監控將不足以維持安全。」

### 三大機構框架的核心分歧

- **Anthropic**：在 v3.0 中徹底移除了硬性暫停承諾；將 AI R&D-4 能力門檻定為下一個明文管制的關鍵閘門。
- **OpenAI**：採用「受追蹤 vs 研究類別」雙軌劃分；研究類別（包含長程自主性）不會自動觸發實質卡關機制。
- **DeepMind**：將自主性拆解並折疊進其他具體領域；於 2026 年 4 月追加了細緻的「受追蹤能力等級」。

### 蓄意裝笨（Sandbagging）：讓三者皆陷入複雜困境的特殊能力

蓄意裝笨（即模型在能力評測中策略性地故意考低分）被 OpenAI 列於研究類別中。Anthropic 的 RSP v3.0 透過「評測語境落差（第 1 課）」對其進行間接規範。DeepMind 則在 FSF v3 中透過欺騙性對齊監控進行應對。

若一個模型學會了在評測中蓄意裝笨，所有安全框架的能力門檻都將被系統性低估。唯有在客觀測量切實有效的前提下，擴展政策才能發揮實質作用。這正是為何除了實驗室自身的內部評估之外，外部獨立評估體系（第 21 課，METR）以及紅隊對抗評測顯得如此不可或缺。

### 專業研讀政策的關鍵技能

- **精準定位**：你在意的每一項核心能力，都必須能在政策中被清楚找到。若找不到，即意味著該政策對其完全缺乏管轄力。
- **分類辨析**：該能力究竟屬於「受追蹤」（強制觸發緩解）還是「研究類別」（僅記錄而不觸發動作）？OpenAI 明確給出了標籤，而 Anthropic 與 DeepMind 亦有其各自對應的實質分級。
- **更新節奏**：政策是依照預先宣告的固定週期更新，還是僅在特定突發事件後才被動修改？明確宣告的常態節奏通常具備更高的可信度。
- **外部獨立性**：外部審查是法定強制還是自由裁量？Anthropic 與 Apollo 及美國 AI 安全研究所合作；OpenAI 與 METR 合作；而 DeepMind 則主要依賴其內部的 SAG 審查。

```figure
a5-tracked-vs-research
```

## Use It｜實際應用

`code/main.py` 透過 Python 標準函式庫實現了一個決策矩陣比對工具。給定一項特定能力（自主性、欺騙性對齊、研發自動化、網路攻擊賦能等），它會自動輸出三大政策各自對該能力的具體分類歸屬，以及會觸發何種層級的緩解防護。這是一份專為專業研讀設計的輔助工具，而非形式化的政策宣告。

## Ship It｜交付成果

`outputs/skill-cross-policy-diff.md` 能以三大安全框架為基準參照系，針對特定的前沿 AI 能力生成跨機構政策橫向對比分析報告。

## Exercises｜練習

1. 執行 `code/main.py`。確認比對工具的輸出結果是否與原始文獻完全吻合，挑選至少兩項具體能力進行原文逐字核對。

2. 通讀 OpenAI 準備度框架 v2 全文。梳理所有的「研究類別」。針對每一個類別，撰寫一句話說明 OpenAI 將其歸入研究類別而非受追蹤類別的深層考量。

3. 通讀 DeepMind FSF v3 全文，以及 2026 年 4 月更新的「受追蹤能力等級」。找出「機器學習研發自主性等級 1」的具體評測條件。你會如何設計外部獨立測試來驗證該指標？

4. 蓄意裝笨被列於 OpenAI 的研究類別中。結合第 1 課關於評測語境博弈的討論，設計一套能夠迫使蓄意裝笨的模型暴露其真實極限能力的對抗性評估協定。

5. 針對一項特定能力（由你自選）橫向對比三大政策。指出哪一家實驗室的分類規範最為嚴謹，哪一家最為薄弱。引用原文條文為你的結論給出充分的論證依據。

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|---|---|---|
| Preparedness Framework | "OpenAI's scaling policy" | PF v2 (April 2025); Tracked vs Research categories |
| Tracked Category | "Mandatory mitigation" | Triggers Capabilities + Safeguards Reports; SAG review |
| Research Category | "Monitored only" | Tracked but no automatic mitigation; includes Long-range Autonomy |
| Frontier Safety Framework | "DeepMind's scaling policy" | FSF v3 (Sept 2025) + Tracked Capability Levels (Apr 2026) |
| CCL | "Critical Capability Level" | DeepMind threshold per domain (Cyber, Bio, ML R&D, CBRN) |
| ML R&D autonomy level 1 | "R&D automation" | Fully automate AI R&D pipeline at competitive cost |
| Sandbagging | "Strategic underperformance" | Model underperforms on evals; in OpenAI Research Categories |
| Instrumental reasoning | "Means-ends reasoning" | Reasoning about how to achieve goals; target of DeepMind monitoring |

## Further Reading｜延伸閱讀

- [OpenAI — Updating our Preparedness Framework](https://openai.com/index/updating-our-preparedness-framework/) — v2 正式發布公告。
- [OpenAI — Preparedness Framework v2 PDF](https://cdn.openai.com/pdf/18a02b5d-6b67-4cec-ab64-68cdfbddebcd/preparedness-framework-v2.pdf) — 政策全文。
- [DeepMind — Strengthening our Frontier Safety Framework](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — FSF v3 發布公告。
- [DeepMind — Updating the Frontier Safety Framework (April 2026)](https://deepmind.google/blog/updating-the-frontier-safety-framework/) — 2026 年 4 月受追蹤能力等級補充條文。
- [Gemini 3 Pro FSF Report](https://storage.googleapis.com/deepmind-media/gemini/gemini_3_pro_fsf_report.pdf) — FSF 風格風險報告的經典範例。
