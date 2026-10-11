# Anthropic 負責任擴展政策 v3.0（Anthropic Responsible Scaling Policy v3.0）

> RSP v3.0 於 2026 年 2 月 24 日正式生效，全面取代了 2023 年發布的舊版政策。其核心設計包含雙層緩解架構：區分 Anthropic 將單方面採取的行動，與針對全產業提出的建議性規範（包含 RAND SL-4 資安標準）。將「前沿安全路線圖（Frontier Safety Roadmaps）」與「風險報告（Risk Reports）」確立為常態化更新的常設文件，而非一次性的交付產物。徹底移除了 2023 年版的「硬性暫停訓練承諾」。引入了關鍵的「AI R&D-4」能力門檻：一旦跨越該門檻，Anthropic 必須主動發布正面論證報告，明確指出失準風險與緩解手段。當前 Claude Opus 4.6 尚未跨越該門檻，但 Anthropic 在 v3.0 公告中坦言：「要自信地排除這一點已變得愈發困難。」獨立安全評估機構 SaferAI 將 2023 年版 RSP 評為 2.2 分；而在審查 v3.0 後將其降級至 1.9 分，使 Anthropic 與 OpenAI、DeepMind 同列「薄弱（weak）」RSP 梯隊。以質性門檻取代量化承諾、並刪除強制暫停條款，是新版政策中最為劇烈的實質倒退。

**Type:** Learn
**Languages:** Python (stdlib, RSP threshold decision engine)
**Prerequisites:** Phase 15 · 06 (AAR), Phase 15 · 07 (RSI)
**Time:** ~45 minutes

## The Problem｜問題

尖端前沿實驗室所發布的模型擴展政策，本質上兼具了技術文件、公司治理宣告以及向監管機構傳遞政治訊號的三重屬性。RSP v3.0 是 Anthropic 現行的權威治理文件。深入研讀它之所以至關重要，並非因為它具有法律約束力（事實上完全沒有），而是因為它的論述框架深刻形塑了一家尖端實驗室如何定義災難性風險，以及他們如何向大眾溝通與權衡取捨。

v3.0 與 v2.0 之間的差異對比（diff）極具學習價值。新版新增的內容包括：前沿安全路線圖、風險報告，以及 AI R&D-4 能力門檻。新版刪除的內容包括：2023 年版中具備強硬約束力的暫停承諾。重新包裝的維度包括：將緩解措施拆分為「Anthropic 單方面行動」與「全產業建議」雙軌架構。第三方外部評估機構 SaferAI 將其評分從 2.2（v2 版）下調至 1.9（v3.0 版）。這生動展示了一份擴展政策如何在表面包裝得更加光鮮專業的同時，底層的實質約束力卻被悄悄削弱。

## The Concept｜核心概念

### 雙層緩解措施清單（Two-Tier Mitigation Schedule）

- **Anthropic 單方面行動（Unilateral actions）**：無論其他同業實驗室採取何種行動，Anthropic 承諾自己皆會強制執行的底線。包含在跨越特定門檻時暫停特定訓練、部署特定的資安硬性防線，以及設定嚴格的發布閘門。
- **全產業倡議性建議（Industry-wide recommendations）**：Anthropic 認為整個 AI 產業應當共同恪守的理想準則。例如 RAND SL-4 資安防禦標準。這並非 Anthropic 對自身的承諾，而是屬於公共政策倡議範疇。

這種雙層結構在 v2 版中並不存在。這意味著讀者在研讀時，必須極其清醒地辨析各項條款究竟落在欄位的哪一側。一項出現在「全產業倡議」欄位中的高等級資安措施，並不是 Anthropic 做出的莊嚴承諾，而僅僅是 Anthropic 的美好期許。

### AI R&D-4 能力門檻

這是 RSP v3.0 明確標註的下一個重大關鍵能力里程碑。具體定義為：模型具備以具競爭力的成本，全自動化大部分 AI 科研工作的能力。一旦 Anthropic 判定某個模型跨越了該門檻，在繼續推進下一階段模型擴展之前，必須強制發布一份正面論證（affirmative case）報告，精確辨識潛在的失準風險並證明各項防禦緩解措施已經充分到位。

在 v3.0 發布公告中，官方認定 Claude Opus 4.6 尚未跨越該門檻。但文件中隨後補充道：「要自信地排除這一點已變得愈發困難。」這句措辭意味深長；它坦白承認該門檻已經近在咫尺，不再只是遙遠虛無的科幻假設，而是眼下必須嚴肅應對的真實隱患。

第 6 課（自動化對齊研究）與第 7 課（遞歸式自我改進）正是直接推動系統逼近該門檻的核心技術驅動力。自動化對齊研究員在科研品質指標上超越人類，正是 AI R&D-4 門檻即將被攻破的確鑿實證。

### 前沿安全路線圖與風險報告

v3.0 將兩類關鍵產物升格為常設的週期性文件：

- **前沿安全路線圖（Frontier Safety Roadmap）**：前瞻性文件，詳盡說明團隊規劃的安全研發工作、對未來模型能力的預期，以及預計展開的緩解技術研究。
- **風險報告（Risk Report）**：針對特定模型發布後進行的回溯性審查文件，如實記錄觀察到的真實能力與殘餘風險。

兩者皆強制對公眾公開，並按照宣稱的節奏定期更新。其核心價值在於：公眾與研究者可以系統性地比對 Anthropic 當初在路線圖中承諾的行動，與其在後續風險報告中所揭露的真實狀況是否存在脫節。

### 移除硬性暫停條款（Pause Clause）

2023 年版的 RSP 包含一條明確的硬性暫停承諾：若某個模型跨越了特定的危險能力門檻，在相應的緩解防禦措施全面就緒之前，模型訓練將被強制暫停。v3.0 徹底廢除了這條硬性暫停條款，替換為一種更為溫和的模糊表述（發布正面論證報告，只要判定緩解措施充分即可繼續推進）。SaferAI 及眾多獨立資深分析師直接指出，這是新版政策中最為劇烈的原則倒退。

政策辯護方的說法是：2023 年制定的量化門檻在實務中難以精準對齊，因為 2026 年的基準測試體系本身經歷了多次重新標定（rescaling）。反對方的論點則更為尖銳：擴展政策中的硬性暫停條款是整份架構唯一的承諾定錨工具（commitment device）；一旦拿掉這道煞車，整份政策的客觀公信力將蕩然無存。

### SaferAI 的客觀評級降級

SaferAI 是一家專門針對各大實驗室 RSP 類政策進行客觀量化評級的獨立評估機構。其公開評分標準中：Anthropic 2023 年版的 RSP 獲得了 2.2 分（滿分 4.0 分代表目前最優異的 RSP，1.0 分則僅屬形式化空談）。而 v3.0 的得分被直接降級至 1.9 分。這項降級直接將 Anthropic 從「中等（moderate）」跌落至「薄弱（weak）」梯隊，與 OpenAI 及 DeepMind 處於同一水準。

SaferAI 指出的具體降級因素包括：
- 以主觀模糊的質性門檻全面取代了原有的客觀量化指標。
- 徹底刪除了強制暫停訓練的硬性承諾。
- 針對 AI R&D-4 門檻的緩解措施僅被描述為撰寫「正面論證」，而非列出具體的防禦手段清單。
- 審查機制高度依賴 Anthropic 內部的安全顧問委員會（Safety Advisory Group），嚴重缺乏獨立的外部監督制衡。

### 本課的學習宗旨

本課絕非教導如何合規。RSP v3.0 不是一項具有法律強制力的法規，沒有任何外部力量能強制 Anthropic 嚴格遵守它。本課的真正目的，是培養大家以應有的精準度與批判性懷疑視角去解讀此類文件的能力。擴展政策是尖端實驗室向外界釋放其面對災難性風險治理態度的最重要公開窗口。學會穿透表面公關包裝看清其底層實質，是每一位工作依賴於尖端 AI 能力的工程師必備的實用素養。

```figure
a5-rsp-ladder
```

## Use It｜實際應用

`code/main.py` 透過 Python 標準函式庫實現了一個映射 RSP 門檻評估邏輯的微型決策引擎：給定一個候選模型與一組實測能力指標，判定其是否跨越了 AI R&D-4 能力門檻、自動生成所需的正面論證架構章節，並裁定後續部署是否允許繼續推進。該程式刻意維持精簡樸素，旨在讓政策背後的判斷邏輯清晰透明地具象化。

## Ship It｜交付成果

`outputs/skill-scaling-policy-review.md` 能對照 v3.0 基準參照系，全面審查任何擴展政策（無論是 Anthropic、OpenAI、DeepMind 還是企業內部政策）：涵蓋雙層架構劃分、門檻嚴謹度、暫停承諾完整性以及獨立外部審查機制。

## Exercises｜練習

1. 執行 `code/main.py`。輸入三個具備不同能力等級的合成模型樣本。驗證門檻評估器是否如預期運作，並生成結構正確的正面論證報告樣板。

2. 通讀 RSP v3.0 全文（32 頁）。找出所有被歸類在「全產業倡議性建議」欄位中的條款。其中有哪些項目在 v2 版中原本屬於「Anthropic 單方面行動」？

3. 閱讀 SaferAI 的 RSP 評級方法論。對照其評分標準逐項審視 v3.0 文本，嘗試復現出 1.9 分的評定結果。究竟是哪一項評分指標主導了此次降級？

4. 2023 年版的硬性暫停承諾已被刪除。提出一條替代性的承諾條款，使其既能維持擴展政策的公信約束力，又能妥善解決 2026 年基準測試重新標定帶來的實務困難。

5. 將 RSP v3.0 與 OpenAI 的準備度框架 v2（Preparedness Framework v2，詳見第 20 課）進行對比。指出 v3.0 在哪一方面顯著更為嚴謹；並指出準備度框架在哪一方面反而更具優勢。

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|---|---|---|
| RSP | "Anthropic's scaling policy" | Responsible Scaling Policy; v3.0 effective Feb 24, 2026 |
| AI R&D-4 | "Research-automation threshold" | Capability to automate substantial AI research at competitive cost |
| Affirmative case | "Safety justification" | Published argument that risks are identified and mitigations adequate |
| Frontier Safety Roadmap | "Forward plan" | Standing document on planned safety work and expected capabilities |
| Risk Report | "Retrospective on a model" | Standing document on observed capability and residual risk after release |
| Two-tier mitigation | "Unilateral vs industry" | Anthropic commitments vs industry recommendations, separated |
| Pause commitment | "2023 clause" | Explicit promise to pause training; removed in v3.0 |
| SaferAI rating | "Independent RSP grade" | Third-party rubric; v3.0 scored 1.9 (v2 was 2.2) |

## Further Reading｜延伸閱讀

- [Anthropic — Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — 32 頁完整政策全文。
- [Anthropic — RSP v3.0 announcement](https://www.anthropic.com/news/responsible-scaling-policy-v3) — 相較於 v2 版本的官方變更摘要。
- [Anthropic — Frontier Safety Roadmap](https://www.anthropic.com/responsible-scaling-policy/roadmap) — RSP v3.0 引用的常設路線圖文件。
- [Anthropic — Risk Report: February 2026](https://www.anthropic.com/feb-2026-risk-report) — 針對發布時處於頂尖地位的 Claude Opus 4.6 進行的回溯審查報告。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 將 AI R&D-4 與實測自主性指標深度關聯的權威分析。
