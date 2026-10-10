# LLM 路由層——LiteLLM、OpenRouter 與 Portkey

> 供應商綁定（Vendor Lock-in）代價高昂。不同的工具呼叫任務適合由不同的模型來處理。路由閘道器（Routing Gateway）提供統一的 API 介面、重試機制、容錯切換、成本追蹤與安全護欄。2026 年由三大主流架構主導：LiteLLM（開源自建託管）、OpenRouter（全代管 SaaS）與 Portkey（生產級別，於 2026 年 3 月全面開源）。本課將梳理其架構選型決策標準，並以 Python 標準函式庫交付一套路由閘道器。

**Type:** Learn
**Languages:** Python (stdlib, routing + failover + cost tracker)
**Prerequisites:** Phase 13 · 02 (function calling), Phase 13 · 17 (gateways)
**Time:** ~45 minutes

## Learning Objectives｜學習目標

- 嚴格區分自建託管、雲端代管與生產級路由方案的架構差異。
- 實作一條容錯切換鏈（Fallback Chain），依預設的優先順序在供應商發生故障時依序重試。
- 跨多家供應商逐請求追蹤成本與 Token 消耗量。
- 依據具體的正式環境約束條件，在 LiteLLM、OpenRouter 與 Portkey 之間做出正確技術選型。

## The Problem｜問題

在以下五大典型場景中，模型供應商路由層扮演著決定性角色：

1. **成本控制**：Claude Sonnet 的單價是 Haiku 的 3 倍。對於簡單的分流分類任務，Haiku 綽綽有餘；而對於複雜的內容綜合生成，Sonnet 物有所值。閘道器能做到逐請求動態路由。
2. **容錯備援（Failover）**：OpenAI 突發一小時的服務中斷，導致所有請求全數失敗。你希望系統能自動平滑切換至 Anthropic，而無需緊急重新部署程式碼。
3. **回應延遲**：即時對話介面極度要求首字延遲（Time-to-first-token）。但離線批次摘要任務則不然。閘道器可依據延遲 SLA 智慧路由。
4. **資料合規**：歐盟用戶的資料請求必須嚴格保留於歐盟境內節點處理。閘道器支援依地理區域進行合規分流。
5. **模型實驗**：針對完全相同的生產負載對兩款模型進行 A/B 測試。閘道器可依流量分桶進行分流。

若為每一次外部整合手動編寫這套邏輯，會充斥大量重複程式碼。路由閘道器直接暴露一個與 OpenAI 完全相容的標準 API，並由後端統籌處理其餘一切細節。

## The Concept｜核心概念

### OpenAI 相容代理架構

業界幾乎全數遵循 OpenAI 的 API 呼叫格式。路由閘道器對外統一暴露 `/v1/chat/completions` 端點，接收標準的 OpenAI Schema，並在內部自動將其代理轉換為 Anthropic、Gemini、Cohere、Ollama 或任何自訂後端格式。呼叫端應用完全感受不到底層差異。

### 模型別名（Model Aliases）

呼叫端程式碼不再寫死具體的快照版本 ID，而是使用如 `our_smart_model` 的抽象別名。閘道器負責在後端將別名動態對映至真實模型。當供應商推出新一代模型時，你只需在閘道器伺服器端更新別名對映即可，前端程式碼完全無需改動任何一行。

### 容錯切換鏈（Fallback Chains）

```
primary: openai/gpt-4o
on 5xx: anthropic/claude-3-5-sonnet
on 5xx: google/gemini-1.5-pro
on 5xx: refuse
```

閘道器在設定檔中宣告這條調度鏈。所有的重試皆受配額預算嚴格限制，避免容錯瀑布流引發呼叫成本雪崩。

### 語意快取（Semantic Caching）

完全相同或高度相近的 prompts 會直接命中本地快取，而無需重複請求外部供應商。在重複的 agent 執行迴圈中，這能節省高達 30% 到 60% 的開銷。快取索引基於語意向量（Embedding）；語意極度接近的 prompt 共享同一個快取槽位。

### 閘道器護欄（Guardrails）

在閘道器層級實施的防護：

- **PII 去識別化（Redaction）**：在將 prompt 發送給模型前，透過正規表達式或機器學習模型抹除個人敏感資訊。
- **違規策略防禦**：果斷攔截包含違禁內容的請求。
- **輸出過濾**：在 completion 回傳前過濾機密資料洩漏。

Portkey 與 Kong 皆內建了高度整合的安全護欄，而 LiteLLM 則將其保留為選用設定。

### 依 API Key 限制頻率與預算

單一 API Key = 一個內部團隊。依金鑰獨立設定配額，能防止單一團隊耗盡全公司的共享資源額度。主流閘道器皆原生支援此功能。

### 自建託管 vs 雲端代管權衡分析

| 評估維度 | LiteLLM（自建託管） | OpenRouter（雲端代管） | Portkey（生產級別） |
|----------|-------------------|-------------------|-------------------|
| 程式碼架構 | 開源、Python | 封閉 SaaS 代管 | 2026 年 3 月開源 + 雲端代管 |
| 建置門檻 | 需自行部署 Proxy | 註冊帳號即可使用 | 兩者皆可 |
| 支援供應商 | 100+ 家 | 300+ 家 | 100+ 家 |
| 計費模式 | 使用自備 API Keys | 購買 OpenRouter 點數額度 | 使用自備 API Keys |
| 可觀測性 | 支援 OpenTelemetry | 提供基礎儀表板 | 完整 OTel 鏈路追蹤 + PII 抹除 |
| 最適合場景 | 重視資料主權與自主控管的團隊 | 快速驗證原型（PoC） | 重視合規與護欄的正式環境生產系統 |

當組織擁有專職 SRE 團隊並高度重視資料主權時，LiteLLM 是首選。當需要單一訂閱、免除一切基礎設施維運負擔時，OpenRouter 最具優勢。當需要開箱即用的合規防護與進階安全護欄時，Portkey 是最佳解法。

### 成本追蹤（Cost Tracking）

每一個請求皆精確記錄 `provider`、`model`、`input_tokens` 與 `output_tokens`。閘道器將其與維護的即時價格表相乘，並按使用者、團隊與專案進行多維度彙整。

### MCP 與路由整合

閘道器不僅能路由 LLM 呼叫，亦能一併代理 MCP 的 Sampling 請求。當 Sampling 請求中的 modelPreferences 指定了特定偏好時，閘道器會自動將其翻譯並轉發給最適當的後端。這正是 Phase 13 · 17（MCP 閘道器）與本課的 LLM 路由閘道器在真實架構中融合為單一服務的地方。

### 常見路由策略

- **靜態優先序（Static Priority）**：始終優先請求清單第一項，遭遇錯誤時依序降級。
- **負載平衡（Load Balancing）**：採輪詢（Round-robin）或加權權重分流。
- **成本感知（Cost-Aware）**：在滿足延遲與品質門檻的前提下，自動挑選最便宜的模型。
- **延遲感知（Latency-Aware）**：挑選過去 N 分鐘內回應速度最快的模型。
- **任務感知（Task-Aware）**：利用輕量分類器，將寫程式任務導向特定高智能模型，將摘要任務導向高速度模型。

```figure
tp-router-failover
```

## Use It｜實際應用

`code/main.py` 以約 150 行程式碼實作了一套路由閘道器：接收相容 OpenAI 的請求格式、轉換為各供應商的 stub、運行具備優先級的容錯切換鏈、逐請求精確計算成本，並對輸入資料執行 PII 去識別化。執行時包含三種情境：常規成功請求、主力供應商斷線觸發容錯降級、以及被安全護欄攔截抹除的 PII 洩漏情境。

核心觀察重點：

- `ROUTES` 字典：模型別名 -> 依優先級排序的具體供應商清單。
- 容錯迴圈在遇到 5xx 伺服器錯誤時自動重試下一家。
- 成本追蹤器將 Token 消耗乘以各模型即時費率。
- PII 去識別化模組在轉發前精準抹除類似身分證字號（SSN）的機密格式。

## Ship It｜交付成果

本課產出 `outputs/skill-routing-config-designer.md`。給定具體的業務負載特徵（延遲門檻、成本預算、法規合規），該技能可自動在 LiteLLM、OpenRouter 與 Portkey 之間完成架構選型，並產出對應的生產路由設定檔。

## Exercises｜練習

1. 運行 `code/main.py`。觸發供應商斷線情境；確認容錯切換能順利降級至第二家供應商，且呼叫成本被精確歸因。

2. 為閘道器新增語意快取功能：以 prompt 的 SHA-256 雜湊值作為快取鍵，快取命中時立刻回傳。實測重複呼叫下的成本節省幅度。

3. 新增任務感知分類器：將帶有「code ...」的 prompt 導向偏重程式能力的高智能模型別名，將帶有「summarize ...」的 prompt 導向偏重速度的模型別名。

4. 設計多團隊預算管理機制：為每個團隊設定每月花費上限；一旦額度耗盡，閘道器堅決拒絕後續請求。深入評估強制攔截的執行粒度（逐請求即時扣款 vs 滾動時間視窗）。

5. 交叉對比閱讀 LiteLLM、OpenRouter 與 Portkey 的官方架構文件。指出各家各自具備、而另外兩家所不具備的一項獨家殺手級功能。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|---------|-------------|
| Routing gateway | 「LLM 代理轉發層」 | 位於眾多模型供應商前方的單一統一 API 閘道器 |
| OpenAI-compatible | 「相容 OpenAI 格式」 | 對外接收 `/v1/chat/completions` 結構，對內轉發至任意後端 |
| Model alias | 「our_smart_model」 | 程式碼中引用的邏輯名稱，由閘道器動態映射至具體模型 |
| Fallback chain | 「重試降級清單」 | 當主力供應商呼叫失敗時，依序嘗試的有序供應商調度鏈 |
| Semantic caching | 「Prompt 向量快取」 | 以 prompt 語意向量為索引鍵；語意相近的請求共享命中快取 |
| Guardrails | 「輸入／輸出安全護欄」 | 抹除 PII 敏感資料、攔截違反安全規範的請求 |
| Per-key rate limit | 「團隊預算配額」 | 綁定於特定 API Key 的存取頻率與金額消耗上限 |
| Cost tracking | 「逐請求花費審計」 | 累加各請求 Token 用量並乘以各模型單價進行成本歸因 |
| LiteLLM | 「開源輕量代理」 | 支援純自建託管的開源 LLM 路由閘道器 |
| OpenRouter | 「雲端代管聚合平台」 | 採用單一點數額度統一計費的全託管 SaaS 閘道器 |
| Portkey | 「生產級治理平台」 | 內建企業級護欄與全鏈路觀測的開源兼代管路由平台 |

## Further Reading｜延伸閱讀

- [LiteLLM — docs](https://docs.litellm.ai/) ——自建託管路由閘道器官方文件
- [OpenRouter — quickstart](https://openrouter.ai/docs/quickstart) ——全代管路由 SaaS 快速入門指引
- [Portkey — docs](https://portkey.ai/docs) ——內建生產級安全護欄的路由平台架構指南
- [TrueFoundry — LiteLLM vs OpenRouter](https://www.truefoundry.com/blog/litellm-vs-openrouter) ——架構選型深入決策手冊
- [Relayplane — LLM gateway comparison 2026](https://relayplane.com/blog/llm-gateway-comparison-2026) ——2026 年度主流 LLM 閘道器全面橫向評測
