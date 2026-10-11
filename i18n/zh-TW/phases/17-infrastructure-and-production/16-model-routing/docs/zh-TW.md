# 作為成本縮減原語的模型路由（Model Routing as a Cost-Reduction Primitive）

> 動態調度代理（Broker）即時評估每個流入的請求（任務類別、Token 長度、向量 Embedding 相似度、信心分數），將單純簡單的查詢路由至極低廉的輕量模型，並僅將真正棘手的複雜任務升級至前沿旗艦模型。該架構亦被稱為模型串聯瀑布（Model cascading）。跨美、英、歐盟的正式環境實戰案例證實：在完全維持同等輸出品質（Iso-quality）的前提下，模型路由能直接削減 20% 至 60% 的推論帳單；在高並行 SaaS 產品線上，僅僅 30% 的路由效率提升即可在年度財報中省下六位數美元的淨現金。2026 年的宏觀產業背景是：LLM 推論單價正以每年約 10 倍的速度雪崩式驟降——具備 GPT-4 水準的單百萬 Token 成本從 2022 年底的 20 美元暴跌至 2026 年的約 0.40 美元。這項降幅的核心推動力在於推論服務堆疊架構的持續突破（第 17 課第 04-09 節），而非單純依賴硬體製程。模型路由正是你在不損害產品核心品質的前提下，將該產業價格紅利直接轉化為商業毛利的最高效原語。其最致命的失效模式是輕量模型無聲漂移（Cheap-model drift）：路由器盲目將 40% 的流量強行塞給能力較弱的模型，導致複雜推理任務的品質暗中下滑 3% 至 5%，且一季都沒有人察覺。必須強制使用線上即時品質閘門，絕不可盲目依賴線下靜態評測集。

**Type:** Learn
**Languages:** Python (stdlib, toy cascading router simulator)
**Prerequisites:** Phase 17 · 01 (Managed LLM Platforms), Phase 17 · 19 (AI Gateways)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 深入解釋模型串聯瀑布（Model cascading）：首選輕量便宜模型並進行信心驗證，僅在信心偏低時動態升級至旗艦模型。
- 梳理四大關鍵路由決策訊號（任務分類、Prompt 長度、與已知困難集的向量相似度、首輪推論的自評信心）。
- 依據給定的目標路由切分比例與品質容忍下限，精確推算系統的加權混合成本。
- 指出能精準揪出輕量模型無聲侵蝕（Cheap-model creep）的線上品質監控指標與自動化閘門機制。

## The Problem｜問題

你的 AI 服務每月在 GPT-5 上消耗高達 8 萬美元。資料分析無情揭示：其中 70% 的使用者查詢本質上極其簡單：「巴黎現在幾點？」、「幫我把這句話潤飾得更通順」。Haiku 等級的輕量模型以僅需 3% 的微小成本便能完美解決這些請求。而剩餘 30% 的查詢需要 GPT-5 的推理能力——程式碼編寫、數學、多步驟規劃。

若你能精準將這 70% 的低難度流量導流至便宜模型，並僅將 30% 的硬核任務交給旗艦模型，在產品輸出品質完全不變的前提下，每月帳單將應聲驟降約 65%。這正是模型路由的精髓。其核心工程挑戰在於：如何打造一套高吞吐且精準敏銳的調度代理，同時絕不引發任何輸出品質倒退。

## The Concept｜核心概念

### 四大路由特徵訊號（Four routing signals）

1. **任務分類標籤（Task classification）**：判定當前輸入屬於常規閒聊、文本改寫、複雜程式碼生成還是深層數學邏輯。可透過規則式分類器、超輕量 LLM（Haiku 等級，每百萬 Token 僅 0.25 美元）或與已標註資料桶進行 Embedding 相似度匹配來實現。輸出決定路由決策：輕量級（Cheap）／均衡級（Balanced）／旗艦級（Frontier）。

2. **Prompt 長度（Prompt length）**：長度大於 4k Token 的 prompt 通常需要 frontier model 以維持連貫性；而小於 500 Token 的 prompt 通常不需要。

3. **與已知高難度集的向量相似度（Embedding similarity to known-hard set）**：若輸入查詢與歷史標記的高難度問答集餘弦相似度大於閾值（例如 Cosine > 0.88），直接無條件升級指派給旗艦模型。

4. **首輪推論的自評信心（Self-confidence from first-pass）**：先將請求派發給輕量模型；若模型的 Log-probs 機率值顯示信心極低、模型主動使用猶豫措辭（Hedging language），或拒絕回答，立即觸發容錯重試並升級至旗艦模型。該策略雖然為約 10% 的升級流量引入了額外的 P95 延遲，卻為其餘 90% 的龐大流量省下了 50% 以上的雲端帳單。

### 三大核心架構模式（Three patterns）

**前置分類路由（Pre-route）**：在請求最前端部署超輕量分類器；額外引入約 5 至 10 ms 網路微延遲；全域耗時最快。

**瀑布級聯串聯（Cascade）**：便宜模型首發，信心偏低時動態升級；中位數延遲約為 1.2 倍（包含輕量模型運算 + 驗證評估），被升級請求延遲約為 2 倍；具備最堅實的輸出品質底線。

**全並行集成挑選（Ensemble route）**：針對部分採樣流量同時並行呼叫輕量與旗艦模型，由獎勵模型（Reward model）即時挑選最優輸出；品質最高、成本最重；通常僅用於極度嚴肅的產品 A/B 灰度測試。

### 工業級落地實踐（Implementation）

現代 AI Gateways（第 17 課第 19 節）原生內建模型路由能力。LiteLLM 提供包含容錯降級與成本最佳化的 `router` 配置。Portkey 內建 Guards 防護欄與智慧路由。Kong AI Gateway 透過擴充功能提供動態路由能力。OpenRouter 則直接在平台層面提供推薦路由 API。

相關工具：LMSYS 推出的 RouteLLM、商業級 Not Diamond，以及 Prompt Mule。

### 2026 年價格驟降曲線（The 2026 price curve）

| 模型等級 | 2022 年底 | 2026 年現狀 | 總體降幅變遷 |
|-------------|-----------|------|--------|
| GPT-4 水準輸出品質 | 約 $20/M | 約 $0.40/M | 足足便宜了 50 倍 |
| 頂級旗艦前沿（GPT-5、Claude 4） | — | 約 $3-10/M | 開闢出的全新智慧梯隊 |

絕大多數的成本降低皆源自推論服務引擎架構的突破——第 17 課第 04 至 09 節所剖析的核心技術轉化為了雲端廠商的底層降價空間。而模型路由能讓你在應用層立即全額收割這些技術紅利，無需被動等待所有終端使用者自行切換至低價模型。

### 資料漂移是真正的隱形殺手（Drift is the real risk）

你的路由器原本穩定將 40% 的流量指派給便宜模型。但在過去六個月中，使用者的提問習慣悄然發生了結構性演進（使用者愈發專業成熟，提出的問題日益龐大複雜）。然而由於路由分類器是基於半年前的第一季度資料訓練的，它對此毫無察覺。系統開始在無聲無息中發生嚴重的品質劣化。終端使用者並未大聲抗議，而是默默流失；直到在競品評測對比中敗北，團隊才猛然驚醒。

防禦之道在於強制設立線上即時品質閘門：

- 在每個路由出口處嚴密監控使用者點讚／點踩（Thumbs-up / Thumbs-down）比率。
- 引入自動化 LLM-Judge，對每個路由出口抽取 5% 的盲測樣本進行即時打分。
- 監控升級率（Escalation rate）：若瀑布級聯中的升級率突破了 30%，說明輕量模型正在被嚴重超負荷過度路由。
- 監控各路由的拒絕回答率（Refusal rate）。

### 務必銘記的核心數字指標（Numbers you should remember）

- 2026 年同等品質下模型路由所能帶來的成本節省：在各正式環境案例中達到 20% 至 60%。
- 2022 至 2026 年間大模型推論單價複合降幅：平均每年約暴跌 10 倍。
- GPT-4 等級單價變遷：從約 20 美元/百萬 Token 驟降至約 0.40 美元/百萬 Token。
- 瀑布級聯對延遲的物理影響：中位數延遲約 1.2 倍；被升級的請求延遲約 2 倍（約佔整體流量的 10%）。

```figure
model-cascade-router
```

## Use It｜實際應用

`code/main.py` 在混合業務負載下全面模擬了前置分類（Pre-route）、瀑布級聯（Cascade）與全並行集成（Ensemble）三種路由模式。終端機即時輸出混合綜合成本、理論品質損失折損率以及動態升級率指標。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-router-plan.md`。輸入具體業務流量特徵分佈與品質容忍底線，該 Skill 將自動為你推導出最佳路由架構模式，並規劃出一套多維度的特徵決策訊號矩陣。

## Exercises｜練習

1. 執行 `code/main.py`。在何種準確率底線條件下，瀑布級聯模式（Cascade）的綜合經濟效益會超越前置分類模式（Pre-route）？
2. 你的使用者群體中，30% 為企業用戶（提出複雜查詢），70% 使用免費方案（提出簡單查詢）。設計路由分流策略。哪一項線上指標作為閘門？
3. 某項路由策略雖然讓輸出品質微幅下滑了 2%，但節省了高達 40% 的推論帳單。這項改動究竟是否值得發布至正式環境？立足於具體產品型態給出兩面論述。
4. 基於 OpenAI 或 Anthropic API 暴露的 Log-probs 機率資訊，實作一套即時信心校驗常式。你建議將初始門檻設定在什麼具體數值？
5. 在過去六個月中，系統的動態升級率從 8% 一路飆升至 22%。列出引發該現象的三項最可能架構原因，並針對每一項分別給出標準修復方案。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| Model routing | 「成本仲介」 | 依每個請求動態選擇模型 |
| Model cascade | 「先用便宜模型，不足再升級」 | 先執行便宜模型，信心不足時改用前沿模型 |
| Pre-route | 「先分類」 | 先用分類器判斷，不會重新執行 |
| Ensemble route | 「並行挑選」 | 同時執行多個模型，再由獎勵模型選出最佳結果 |
| Escalation rate | 「升級比例」 | 瀑布式請求中升級至更強模型的比例 |
| RouteLLM | 「LMSYS 路由器」 | 開源路由函式庫 |
| Not Diamond | 「商業路由器」 | SaaS 模型路由產品 |
| Drift | 「便宜模型悄然退化」 | 路由器未察覺的資料分布變化 |
| Online quality gate | 「即時檢查」 | 對線上流量抽樣並自動進行 LLM 評審 |

## Further Reading｜延伸閱讀

- [AbhyashSuchi — Model Routing LLM 2026 Best Practices](https://web.archive.org/web/20260413143335/https://abhyashsuchi.in/model-routing-llm-2026-best-practices/) — 大模型路由實務指南。
- [Lukas Brunner — Rise of Inference Optimization 2026](https://dev.to/lukas_brunner/the-rise-of-inference-optimization-the-real-llm-infra-trend-shaping-2026-4e4o) — 推論架構演進趨勢報告。
- [RouteLLM paper / code](https://github.com/lm-sys/RouteLLM) — LMSYS 開源模型路由專案。
- [Not Diamond — model routing](https://www.notdiamond.ai/) — 商業級大模型智慧路由系統。
- [OpenRouter](https://openrouter.ai/) — 內建多模型智慧調度原語的通用推論 Gateway。
