# Batch API 批次處理——五折優惠的業界通用標準（Batch APIs — the 50% Discount as Industry Standard）

> 全球各大主流大模型供應商皆標配非同步 Batch API，統一提供 50% 的硬性折扣與約 24 小時的非同步履約保證。OpenAI、Anthropic、Google 以及絕大多數新興推論平台（Fireworks batch 層級、Together batch）皆嚴格貫徹該模式。若將 Batch API 與 Prompt 快取技術雙重疊加，夜間離線流水線的總成本將直接暴降至同步未快取基準線的約 10%。工程鐵律極其殘酷直白：凡是不具備即時互動屬性的業務負載，皆必須強制走 Batch 通道。內容批次生成、巨量文件分類、資料結構化擷取、分析報告起草、海量資料集打標、商品目錄標籤整理——任何能容忍 24 小時非同步延遲的任務，在未遷移至 Batch 之前，皆屬於在桌面上白白燃燒預算。2026 年成熟的正式環境標準範式是將所有新進 LLM 業務嚴格分流進三大專屬通道：即時互動通道（同步呼叫 + 快取）、半即時通道（非同步佇列 + 備援容錯）、批次通道（夜間非同步 + 疊加快取）。那些假裝自己具備即時性、實質上卻能完全容忍數分鐘延遲的偽即時任務，是吞噬團隊經費的最大黑洞。

**Type:** Learn
**Languages:** Python (stdlib, toy batch-vs-sync cost simulator)
**Prerequisites:** Phase 17 · 14 (Prompt & Semantic Caching)
**Time:** ~45 minutes

## Learning Objectives｜學習目標

- 列出三大雲端大廠的 Batch API（OpenAI、Anthropic、Google），並掌握其通用的 50% 折扣優惠與 24 小時履約承諾。
- 精確計算在夜間離線分類業務中將「Batch API」與「快取輸入」雙重疊加後的財務成本，並與同步未快取基準線進行橫向對比。
- 熟練將各類業務負載嚴格分流至即時互動／半即時／批次三大專屬通道，並給出架構層面的充分論證。
- 深刻洞察兩大實務陷阱：偽即時性陷阱（使用者實質上能容忍非同步）與輸出格式差異陷阱（各供應商的批次 JSONL 檔案結構互不相容）。

## The Problem｜問題

你的團隊維運著一套夜間自動產生企業營運報告的離線管線。每晚處理 50,000 份文件，分別進行摘要提煉、對摘要展開語意分群，最終起草一份高階主管決策簡報。若以傳統同步方式運作，耗時 4 小時且每晚消耗高達 2,000 美元。隨後你聽說了 Batch API。

切換至 Batch API 直接為全線帳單打 5 折。你隨後又為這 50,000 次呼叫所共享的系統 Prompt 開啟了 L2 Prompt 快取。兩項技術疊加後，每晚帳單驟降至 180 美元——僅為原始基準線的約 9%。完全相同的輸出品質與處理管線，僅僅改動了三處基礎設定。

Batch API 是大模型成本治理工具箱中門檻最低、節省幅度最驚人，卻最常被工程團隊束之高閣的操作槓桿。其背後的核心阻礙通常是組織架構上的思維慣性：當業務 SLA 實質上僅要求「明早前交付」時，研發團隊卻習慣性在架構中預設「必須即時串流響應」。本課的主旨，正是教你如何不再將高達 90% 的真金白銀白白拱手送給雲端廠商。

## The Concept｜核心概念

### 三大主力 Batch API（The three batch APIs）

**OpenAI Batch API**：透過上傳包含單行獨立請求的 JSONL 檔案發起。官方承諾 24 小時內完成履約（在實務中 P50 通常僅需 2 至 8 小時）。針對輸入與輸出 Token 全程提供 50% 的硬性折扣。對外暴露標準的 `/v1/batches` 管理端點。若輸入 Prompt 符合快取資格，更能在此 5 折基礎上進一步疊加快取輸入專屬折扣。

**Anthropic Message Batches**：同樣採 JSONL 檔案批次上傳機制。承諾 24 小時非同步履約。全線 5 折。原生完整支援 `cache_control`——快取寫入顯式標註，同一批次內部的後續請求自動享有快取讀取折扣。

**Google Vertex AI Batch Prediction**：支援直接以 BigQuery 資料表或 GCS 物件儲存作為資料來源與目標。針對 Gemini 全系列模型提供同等 50% 折扣。深度整合進 GCP 的 Vertex Pipelines 工作流。

### 語意本質：非同步，而非緩慢（Semantic: asynchronous, not slow）

Batch 的真實語意是「我承諾在 24 小時以內將結果交給你」——絕非「每個請求都要跑滿 24 小時」。在真實環境中，P50 耗時通常落在 2 至 6 小時區間。各大雲端供應商本質上是將你的批次任務靈活排程至深夜或離峰時段，動態填補其閒置 GPU 庫存的算力低谷。

### 疊加快取技術（Stack with caching）

以 50,000 份文件摘要且共享相同的 4k Token 系統 Prompt 為例：

- 同步未快取：50000 × ($input × 4000 + $output × 200) at full rates.
- 同步有快取：系統 Prompt 在首次寫入後成功落盤；其餘 49,999 次呼叫享有便宜 10 倍的輸入單價。
- 批次有快取：在上述快取巨大節省的基礎之上，對讀取費率、寫入費率與輸出費率全額再次砍半（打 5 折）。

技術疊加效應：Batch + Cache = 僅需原始同步未快取帳單的約 10%。任何在夜間運作且具備共享系統提示的離線負載，皆應當強制落實該架構。

### 業務工作負載分流決策（Workload triage）

**即時互動通道（Interactive）**——使用者在螢幕前焦急等待文字跳出。TTFT 與 ITL 具有生命攸關的影響。必須走同步呼叫，搭配 Prompt 快取。絕對無法使用 Batch。

**半即時通道（Semi-interactive）**——使用者主動送出一項複雜任務，並被告知數分鐘後回來檢視進度。採用非同步佇列調度，並在 Batch 暫態不可用時提供自動降級同步的備援能力。例如中小規模的知識庫 RAG 索引建置。

**批次通道（Batch）**——使用者期望在「明早開工前」或「下一小時內」拿到批次結果。內容產出管線、巨量資料離線分類、夜間財務審計。必須百分之百走 Batch，並強制疊加前綴快取。

業界最常見的架構悲劇：僅僅因為該管線屬於正式環境業務，便將所有任務一律粗暴判定為「即時互動」。正式環境是一項穩定性規範，絕非延遲參數指標——業務 SLA 才是決策依據。

### 偽即時性陷阱（The partial-interactivity trap）

許多業務功能表面上看似即時互動，但實質上完全能容忍 5 至 10 分鐘的非同步等待。經典範例：企業儀表板上的「重新整理」按鈕。使用者點選重新整理後，若被告知「系統正在重新精算，完成後將發送通知」，等待 10 分鐘通常完全在接受範圍內。然而研發團隊往往習慣性將其直接實作為前端同步阻塞。若 50 位使用者同時點選重新整理，其產生的突發雲端花費，是採用非同步批次並透過郵件或推播交付結果的 10 倍以上。

架構師必須反覆追問產品經理：「若延遲 24 小時交付，使用者的核心體驗是否真會崩塌？」若答案是「他們根本無所謂」，果斷轉入 Batch 通道。

### 輸出格式差異陷阱（The output-schema trap）

各大供應商在 Batch 檔案的具體結構定義上存在顯著方言差異：

- OpenAI：JSONL 格式，一行代表一個包含 custom_id 的獨立 API Request 封裝。
- Anthropic：JSONL 格式，一行代表一條 Message 呼叫，且回傳的結構深度嵌套。
- Vertex：強制依賴 BigQuery 資料表或以 TFRecord 格式封裝的 GCS 路徑。

若想在多供應商之間編寫通用的「抽象 Batch 用戶端」，必須為每家大廠分別編寫精緻的轉接器（Adapter）。即便號稱支援多供應商批次的商用 Gateway，其底層亦必須針對各廠商的專屬格式進行多重適配。

### 務必銘記的核心數字指標（Numbers you should remember）

- 各大雲端廠通用的 Batch 硬性折扣：輸入與輸出 Token 全面統一 5 折（50% off）。
- 履約保證 SLA：官方承諾 24 小時內交付；真實 P50 耗時約 2 至 6 小時。
- 疊加批次與快取的綜合成效：總算力支出被壓縮至原始同步未快取的約 10%。
- 分流決策鐵律：凡是業務能容忍 24 小時非同步的任務，永遠強制走 Batch。

```figure
batch-lane-triage
```

## Use It｜實際應用

`code/main.py` 針對 50,000 份文件的典型批次負載，橫向精算四種不同架構下的財務開銷：純同步、同步+快取、純批次、批次+快取。即時輸出各方案的美元總支出與淨節省百分比。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-batch-triager.md`。輸入具體業務負載屬性、使用者期望時效與資料吞吐規模，該 Skill 將自動將任務分流至最適通道，並精確產出切換至 Batch 後的財務節省預估。

## Exercises｜練習

1. 執行 `code/main.py`。針對包含 10 萬份文件、系統 Prompt 為 3k Token 且輸出為 500 Token 的離線管線，計算全套技術疊加（批次 + 快取）相較於原始同步基準線所能節省的確切金額。
2. 檢視你目前所屬產品中的三項真實 AI 功能。將它們分別精準分流至即時互動／半即時／批次三大專屬通道，並為每一項給出充分論據。
3. 某使用者投訴其報告在送出後花費了 3 小時才產出。這究竟是分流決策失誤誤入了 Batch，還是合理的非同步預期？制定標準的判斷準則。
4. 你的 Batch API 官方履約承諾是 24 小時，但長尾 P99 偶發達到 20 小時。你該如何向終端使用者設計產品互動——當遭遇極限長尾時，下游系統應當展現何種容錯行為？
5. 精算損益平衡點：在共享前綴達到多少 Token 以上時，採用公共雲端 Batch + Cache 的總成本，會低於企業自行租賃專屬 GPU 跑滿整夜的自建開銷？

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Batch API | "async discount" | 50% off with 24h turnaround |
| JSONL | "batch format" | One JSON request per line; OpenAI/Anthropic standard |
| Message Batches | "Anthropic batch" | Anthropic's batch API product name |
| Batch prediction | "Vertex batch" | Vertex AI's batch API product |
| Turnaround SLA | "24h promise" | Guarantee, not typical; typical is 2-6h |
| Workload triage | "interactivity decision" | Interactive / semi / batch routing decision |
| Output schema | "response format" | Per-provider JSONL layout; not portable |
| Stacked discount | "batch + cache" | ~10% of uncached sync bill when both apply |

## Further Reading｜延伸閱讀

- [OpenAI Batch API](https://platform.openai.com/docs/guides/batch) — 官方 JSONL 規格與 `/v1/batches` 管理語意。
- [Anthropic Message Batches](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing) — 批次傳輸格式與 `cache_control` 快取互動指南。
- [Vertex AI Batch Prediction](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/batch-prediction-gemini) — Gemini 批次預測語意與架構。
- [Finout — OpenAI vs Anthropic API Pricing 2026](https://www.finout.io/blog/openai-vs-anthropic-api-pricing-comparison) — 2026 雲端大廠費率橫向對比。
- [Zen Van Riel — LLM API Cost Comparison 2026](https://zenvanriel.com/ai-engineer-blog/llm-api-cost-comparison-2026/) — 最新 API 成本結構解析。
