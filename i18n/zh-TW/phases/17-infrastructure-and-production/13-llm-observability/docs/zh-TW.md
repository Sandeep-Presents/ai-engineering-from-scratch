# LLM 可觀測性技術堆疊選型（LLM Observability Stack Selection）

> 2026 年的大模型可觀測性市場清晰分化為兩大陣營。研發一體化平台（LangSmith、Langfuse、Comet Opik）將指標監控與 Eval 評測、Prompt 版本管理以及 Session 對話重放深度捆綁。Gateway 與遙測工具（Helicone、SigNoz、OpenLLMetry、Phoenix）則專注於極簡高吞吐的追蹤（Trace）收集。Langfuse 核心採 MIT 授權開源，在社群與企業級功能間取得了最佳平衡（雲端版每月免費 5 萬事件）。Phoenix 則在 Elastic License 2.0 下原生擁抱 OpenTelemetry——在 RAG 檢索管線視覺化與資料漂移排查上表現極其驚豔，但並非專為長久儲存的正式環境後端而設計。Arize AX 則透過零拷貝的 Iceberg/Parquet 資料湖整合，宣稱在大規模流量下成本比傳統單體可觀測性平台低 100 倍。LangSmith 是 LangChain/LangGraph 生態下的絕對霸主，每使用者每月 39 美元，私有自建僅限頂級企業版。Helicone 採反向代理架構，15 至 30 分鐘即可極速接入，每月提供 10 萬次免費請求，但在多步驟 Agent 複雜鏈路上深度略顯不足。成熟的工業級黃金實務：前端 Gateway（Helicone/Portkey）+ 評測平台（Phoenix/TruLens），兩者透過標準 OpenTelemetry 協定無縫黏合。

**Type:** Learn
**Languages:** Python (stdlib, toy trace-sampling simulator)
**Prerequisites:** Phase 17 · 08 (Inference Metrics), Phase 14 (Agent Engineering)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 嚴格區分研發一體化平台（捆綁評測 + Prompt 管理 + Session 重放）與純 Gateway/遙測工具（僅處理 Trace 追蹤 + 核心指標）的邊界。
- 梳理六大主流可觀測性工具（Langfuse、LangSmith、Phoenix、Arize AX、Helicone、Opik）在開源授權、定價模型與最佳甜蜜點場景上的映射關係。
- 深刻理解以 OpenTelemetry 作為通用黏著劑的現代架構模式，無縫串聯前端 Gateway 與獨立評測平台。
- 指出 2026 年大規模下的核心成本分水嶺（Arize AX 的資料湖零拷貝 vs 傳統單體採集），並理解其標稱百倍成本差異的底層原理。

## The Problem｜問題

你剛剛交付了一項核心 LLM 功能。它運作正常。但你對背後的真實情況一無所知：Prompt 為何偶發報錯？工具呼叫是否陷入死循環？P99 延遲為何暗中惡化？Token 帳單為何突發暴增？前綴快取命中率究竟是多少？你在 Google 上搜尋「LLM 可觀測性」，跳出了八種工具，每家都宣稱能解決完全相同的痛點，背後卻標著三種天壤之別的價格矩陣。

它們解決的根本不是同一個問題。LangSmith 專門解答「這一次 LangGraph 運作究竟為什麼崩潰？」Phoenix 專門回答「我的 RAG 檢索向量分佈是否發生了動態漂移？」Helicone 專門揪出「後台究竟是哪一款 App 在瘋狂吞噬 Token？」而 Langfuse 則解答「我們能否在私有 VPC 內部百分之百自建整套系統？」工具不同，面對的目標受眾亦截然不同。

理性選型必須立足於四大維度：技術堆疊（依賴 LangChain？純原生 SDK？跨多供應商？）、開源授權容忍度（僅接受 MIT？接受 Elastic？純商業版無所謂？）、財務預算（免費版？每月 100 美元？每月 1000 美元？），以及自建需求（絕對剛需？加分項？絕不考慮？）。

## The Concept｜核心概念

### 兩大主流類別（Two categories）

**研發一體化平台（Development platforms）**：將即時可觀測性與離線 Eval 評測、Prompt 版本納管、資料集版本控制以及對話 Session 重放深度融合。工程師能在平台內展開 Prompt A/B 實驗，驗證新 Prompt 相較於歷史基準是否存在回歸缺陷。代表：LangSmith、Langfuse、Comet Opik。

**Gateway 與遙測工具（Gateway/telemetry tools）**：極簡侵入推論呼叫鏈路——完整記錄 Prompt、回應內容、Token 數量、端到端延遲、呼叫模型與財務花費。代表：Helicone、SigNoz、OpenLLMetry、Phoenix。架構極度輕量，能透過標準 OpenTelemetry 與下游獨立評測工具無縫對接。

### Langfuse——開源生態的最佳平衡點（Langfuse — OSS balance）

- 核心程式碼採 Apache / MIT 開源授權；支援透過 Docker 極速私有化自建。
- 雲端託管版提供每月 5 萬次免費事件額度；團隊版起跳價每月 29 美元。
- 完整涵蓋 Eval 評測、Prompt 納管、分散式追蹤與基準測試資料集四大能力。
- 最佳甜蜜點：期望享有 LangSmith 級別的完整研發體驗，但強烈要求必須開源可控或本地私有化部署。

### Phoenix (Arize)——遙測優先、OpenTelemetry 原生

- 採 Elastic License 2.0 授權；本機單行指令即可極速拉起。
- 在 RAG 檢索視覺化與語意分佈漂移診斷上無人能出其右。原生提供將 Embedding 投影至降維散佈圖的開箱即用功能。
- 設計初衷並非作為永久存檔的正式環境監控後端——其核心定位是研發階段與測試環境下的深度除錯利器。
- 最佳甜蜜點：RAG 檢索管線調優、語意漂移排查；在正式環境中通常與前端獨立 Gateway 搭檔協同。

### Arize AX——超大規模下的成本破局者（Arize AX — the scale play）

- 純商業級企業產品。核心採用基於 Apache Iceberg 與 Parquet 的資料湖零拷貝架構。
- 官方宣稱在超大規模流量下，成本比傳統單體可觀測性方案（如 Datadog 體系）便宜約 100 倍。底層數學邏輯：所有追蹤日誌直接以 Parquet 格式落盤在你自身的 S3 儲存貯體中；Arize 僅透過外表直接查詢分析，完全無需支付昂貴的中心化資料寫入費。
- 最佳甜蜜點：日均 Trace 超過 1,000 萬次、內部已建置成熟資料湖，期望以極致成本享有大模型專屬儀表板的巨型企業。

### LangSmith——LangChain 與 LangGraph 生態王者（LangSmith — LangChain/LangGraph first）

- 商業閉源，每使用者每月 39 美元。私有化自建僅開放給頂級 Enterprise 企業客戶。
- 針對 LangChain 與 LangGraph 技術堆疊提供堪稱極致的原生調適。但若你的底層架構並未採用這兩款框架，其性價比將大打折扣。
- 最佳甜蜜點：已全面深度綁定 LangChain 生態、且具備充足軟體採購預算的研發團隊。

### Helicone——基於代理的最小可行方案（Helicone — proxy-based minimum viable）

- 接入極其極速：僅需將程式碼中的 `OPENAI_API_BASE` 指向 Helicone 代理端點，15 至 30 分鐘內即可全量上線。
- 核心程式碼採 MIT 授權；每月提供 10 萬次免費請求，付費版每月 20 美元起。
- 內建智慧容錯移轉、語意快取、全域速率限制——兼具可觀測性與輕量 Gateway 雙重角色。
- 在多步驟複雜 Agent 追蹤圖譜的呈現深度上相對有限。
- 最佳甜蜜點：單體應用、需要以最快速度同時獲得 Gateway 與基礎可觀測性雙重能力的精悍團隊。

### Opik (Comet)——開源研發一體化平台（Opik (Comet) — OSS dev platform）

- 全面遵循 Apache 2.0 開源協議。
- 功能矩陣高度對標 Langfuse，並深度繼承了 Comet 在機器學習實驗追蹤領域的深厚底蘊。
- 最佳甜蜜點：本就依賴 Comet 進行傳統 ML 模型管理的團隊，期望在同一個單一面板中統一檢視 LLM 應用。

### SigNoz——以 OpenTelemetry 為核心的全端 APM（SigNoz — OpenTelemetry-first full APM）

- Apache 2.0 開源授權。在統一的視圖中同時處理微服務常規 APM 指標與 LLM 推論呼叫。
- 最佳甜蜜點：期望在同一套監控體系中打通端到端微服務鏈路與底層 LLM 呼叫的大型基礎架構團隊。

### 黏著劑：OpenTelemetry 與 GenAI 語意約定（The glue: OpenTelemetry + GenAI semantic conventions）

OpenTelemetry 聯盟於 2025 年底正式發布了官方 GenAI 語意約定標準（涵蓋 `gen_ai.system`、`gen_ai.request.model`、`gen_ai.usage.input_tokens` 等標準屬性）。凡是能消費 OTel 標準格式的工具皆能無縫互通。當前在工業界全面成型的標準範式：

1. 每次 LLM 呼叫時，用戶端一律輸出嚴格符合 GenAI 語意約定的 OpenTelemetry Trace。
2. 日常正式環境流量直接導向 Gateway（Helicone / Portkey）實現即時監控與成本管控。
3. 同步雙寫分流至離線評測平台（Phoenix / Langfuse）以自動檢測回歸缺陷。
4. 全量日誌冷存至基於 Iceberg 的資料湖中，供 Arize AX 或 DuckDB 展開長時程深度資料分析。

### 致命陷阱：在錯誤的架構層次進行埋點（The trap: instrumenting at the wrong layer）

在特定的 Agent 框架內部進行侵入式埋點（例如直接在程式碼中硬編碼 LangSmith 追蹤邏輯），會導致業務邏輯與該特定框架死死綁定。而在最底層的 HTTP 傳輸層或 OpenAI-SDK 封裝層進行透明攔截（透過 OpenLLMetry 或統一 Gateway），才是具備長遠可移植性的最佳架構。

### 採樣策略——你無法保留所有原始追蹤（Sampling — you can't keep everything）

當系統請求量突破每日 100 萬次大關時，全量保留每一筆 Trace 原始輸入輸出的儲存帳單，將迅速超越呼叫 LLM 本身的費用。落實基於規則的階梯採樣：對所有報錯異常 100% 全量保留；對所有極端高成本請求 100% 全量保留；對一般成功的平淡請求僅隨機採樣 5%。度量指標永遠維持 100% 聚合；原始詳細 Payload 僅針對長尾異常予以保留。

### 務必銘記的核心數字指標（Numbers you should remember）

- Langfuse 雲端版免費額度：每月 5 萬個事件。
- LangSmith 標價：每使用者每月 39 美元。
- Helicone 免費額度：每月 10 萬次請求。
- Arize AX 標稱優勢：在超大規模流量下成本比傳統單體可觀測性方案便宜約 100 倍。
- OpenTelemetry GenAI 語意約定：2025 年底正式發布，2026 年成為全產業事實標準。

```figure
i4-otel-glue
```

## Use It｜實際應用

`code/main.py` 在日均 100 萬次 Trace 追蹤的模擬業務下，橫向演練了三種資料保留策略（100% 全量寫入、均勻隨機採樣、智慧規則採樣+錯誤全量保留）。終端機即時輸出各策略下的實體儲存費用，以及在遭遇偶發長尾事故時所面臨的診斷盲區代價。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-observability-stack.md`。輸入當前程式語言、框架技術堆疊、每日請求規模、月度預算上限與開源授權偏好，該 Skill 將自動為你推導出最佳工具選型組合與標準的 OpenTelemetry 埋點配置清單。

## Exercises｜練習

1. 某團隊全面採用 LangChain 打造應用，但公司法規強制要求必須採用開源且私有化自建的可觀測性方案。在 Langfuse 與 Opik 之間做出抉擇並給出充分論證。
2. 某業務系統日均產生 500 萬次 Trace 呼叫，Datadog 報價為每月 15 萬美元。若採用 Arize AX 搭配 S3 Parquet 自建資料湖，計算其年度損益平衡點。
3. 為你所在企業設計一套 OpenTelemetry GenAI 必填屬性標準清單，要求所有接入推論服務的業務團隊強制在 SDK 層級注入該中繼資料。
4. 深入剖析為何單純依靠 Phoenix 往往不足以支撐高並行正式環境。在何種具體的維運場景下它會暴露出能力短板？
5. Helicone 的代理架構引入了約 20 ms 的網路轉發延遲。若你服務的 P99 TTFT 預算為 300 ms，該開銷是否在可接受範圍內？若 SLA 門檻嚴格收緊至 100 ms 呢？

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| OpenLLMetry | "OTel for LLMs" | Open-source OpenTelemetry instrumentation for LLMs |
| GenAI conventions | "OTel attributes" | Standard OTel attribute names for LLM calls |
| LangSmith | "LangChain observability" | Commercial platform bundled with LangChain ecosystem |
| Langfuse | "OSS LangSmith" | MIT OSS with similar feature set |
| Phoenix | "Arize dev tool" | OpenTelemetry-native dev/eval platform |
| Arize AX | "scale observability" | Commercial zero-copy Iceberg/Parquet observability |
| Helicone | "proxy observability" | HTTP proxy collecting LLM telemetry + gateway features |
| Opik | "Comet LLM" | Apache 2.0 OSS dev platform from Comet |
| Session replay | "trace rerun" | Replay a full agent session with tool calls |
| Eval | "offline test" | Running candidate model/prompt over labeled dataset |

## Further Reading｜延伸閱讀

- [SigNoz — Top LLM Observability Tools 2026](https://signoz.io/comparisons/llm-observability-tools/) — 頂級大模型可觀測性工具橫向橫評。
- [Langfuse — Arize AX Alternative analysis](https://langfuse.com/faq/all/best-phoenix-arize-alternatives) — 官方深度架構對比手冊。
- [PremAI — Setting Up Langfuse, LangSmith, Helicone, Phoenix](https://blog.premai.io/llm-observability-setting-up-langfuse-langsmith-helicone-phoenix/) — 四大主流工具端到端配置實戰。
- [OpenTelemetry GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — 官方語意約定規格說明書。
- [Arize Phoenix docs](https://docs.arize.com/phoenix) — Phoenix 官方架構指南。
- [Helicone docs](https://docs.helicone.ai/) — Helicone 快速上手與進階配置手冊。
