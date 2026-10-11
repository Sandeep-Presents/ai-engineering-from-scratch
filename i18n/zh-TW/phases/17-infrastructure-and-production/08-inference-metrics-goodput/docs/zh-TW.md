# 推論指標度量——TTFT、TPOT、ITL、Goodput、P99（Inference Metrics — TTFT, TPOT, ITL, Goodput, P99）

> 四大核心指標決定了一套推論服務系統在正式環境中究竟是穩定運作還是全面崩潰。TTFT 是 Prefill 運算、佇列等待與網路傳輸的總和。TPOT（等價於 ITL）代表解碼階段受限於記憶體頻寬的單 Token 吐字成本。端到端延遲 E2E 則是 TTFT 加上 TPOT 乘以輸出長度。吞吐量（Throughput）代表全叢集跨 GPU 每秒吐出的 Token 總量。然而在真實產品中唯一真正至關重要的度量是 Goodput——即同時且嚴格滿足每一項 SLO 服務等級目標的合格請求比例。在高吞吐量下遭遇極低 Goodput，意味著你耗費昂貴算力吐出的海量 Token 根本未能在使用者容忍時限內送達。2026 年 TRT-LLM 運作 Llama-3.1-8B-Instruct 的官方權威基準指標：平均 TTFT 為 162 ms、平均 TPOT 為 7.33 ms、平均 E2E 為 1,093 ms。在對外通報時必須強制呈報 P50、P90 與 P99 百分位數——絕不可僅給出平均值。同時必須提防工具定義衝突陷阱：GenAI-Perf 在計算 ITL 時排除了首字 TTFT，而 LLMPerf 則將其納入分母計算；在完全相同的測試軌跡下，兩款工具給出的 TPOT 數字截然不同。

**Type:** Learn
**Languages:** Python (stdlib, toy percentile calculator and goodput reporter)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 精確定義 TTFT、TPOT、ITL、E2E、吞吐量（Throughput）與有效吞吐量（Goodput），並指出每一項指標所具體衡量的底層系統模組。
- 深刻解釋為何平均值是評估 LLM 推論服務的錯誤統計度量，並學會解讀 P50、P90 與 P99 百分位數背後的真實系統狀態。
- 建構多維度複合 SLO 約束條件（例如 TTFT<500 ms AND TPOT<15 ms AND E2E<2 s），並精確計算對應的 Goodput 履約率。
- 指出兩款在相同測試下對 TPOT 計算產生嚴重分歧的業界主流壓測工具，並剖析背後的定義差異根因。

## The Problem｜問題

「我們推論叢集的總吞吐量高達每秒 15,000 個 Token。」那又如何？若其中有 40% 的使用者請求端到端耗時突破了 2 秒大關，終端使用者早已失去耐心關閉頁面。單純的吞吐量數字絲毫無法告訴你這套系統在業務層面是否真正可用。

LLM 推論存在多個完全正交的延遲維度，且各維度所對應的系統失效模式截然不同。Prefill 階段受限於運算力，延遲隨 Prompt 長度線性飆升；Decode 階段受限於記憶體頻寬，延遲隨批次並行規模顯著拉長；排隊等待時間反映了排程器在尖峰負載下的調度缺陷；而網路傳輸延遲則取決於實體地理距離。你必須為每個維度分別建立獨立的度量體系，必須全面監控百分位數分佈，更必須將它們提煉為單一複合指標：「使用者究竟有沒有在合規時限內拿到滿意結果」——這正是 Goodput。

## The Concept｜核心概念

### TTFT——首字延遲（Time to First Token）

`TTFT = queue_time + network_request + prefill_time`

當輸入 Prompt 極長時，Prefill 運算耗時將佔據絕對主導地位。在單張 H100 上為 Llama-3.3-70B FP8 處理一段 32k 的 Prompt，需要耗費約 800 ms 純粹的 GPU 密集運算。queue_time 體現了排程器在飽和負載下的排隊行為；network_request 則是包含 TLS 握手在內的實體傳輸時間。TTFT 是終端使用者在螢幕上看到第一個字跳出前所經歷的真實等待。

### TPOT / ITL——Token 間解碼延遲（Inter-token latency）

同一個物理量在業界有多種稱謂。`TPOT`（Time Per Output Token，單輸出 Token 耗時）、`ITL`（Inter-Token Latency，Token 間延遲）、`decode latency per token`——本質完全相同。它度量的是在首字噴出之後，後續相鄰兩個 Token 串流吐出之間的微小時間差。

`TPOT = (decode_forward_time + scheduler_overhead) / tokens_produced`

在配備了分塊 Prefill 的相同 Llama-3.3-70B H100 堆疊上，TPOT 平均值約為 7 ms。然而若未啟用分塊 Prefill，當鄰近序列突然湧入一段超長 Prefill 時，TPOT 會瞬間產生長達 50 ms 的劇烈卡頓抖動。監控時必須緊盯 P99，而非平均值。

### E2E 端到端總延遲（E2E latency）

`E2E = TTFT + TPOT * output_tokens + network_response`

針對長輸出任務（大於 500 Token），端到端耗時由 TPOT 絕對主導。針對短輸出但長 Prompt 的任務（如海量文件摘要），端到端耗時則由 TTFT 絕對主導。呈報結果時，必須按輸出長度區間切片呈報 E2E。

### 吞吐量（Throughput）

`throughput = total_output_tokens / elapsed_time`

這是一項全域聚合指標。它衡量的是整座 GPU 叢集的整體運算利用效率。它絲毫無法反映個別使用者的真實體驗是否健康。

### Goodput——你唯一真正在意的核心指標（Goodput — the metric you actually care about）

`goodput = fraction of requests meeting (TTFT <= a) AND (TPOT <= b) AND (E2E <= c)`

SLO 是一項多維度的邏輯「且」複合約束。單一請求唯有在同時滿足每一項延遲上限時，才被判定為「合格（Good）」。Goodput 即是合格請求佔總請求數的百分比。以 60% 的 Goodput 換取超高吞吐量本質上是災難性的失敗；在維持 99% 以上高 Goodput 的前提下追求極限吞吐，才是工程團隊唯一合法的終極目標。

在 2026 年，Goodput 已全面成為 MLPerf Inference v6.0 正式榜單以及各大 AI 雲端平台內部 SLA 追蹤的官方標準度量。

### 為何平均值是最危險的統計度量（Why mean is the wrong statistic）

大模型推論的延遲分佈呈現嚴重的右偏態（Right-skewed）長尾特徵。一個解碼批次中若混入了一個超長 Prefill 的鄰居，可能導致前 500 個 Token 的 TPOT 穩定在 7 ms，但中途有 20 個 Token 的 TPOT 暴增至 60 ms。此時算術平均 TPOT 僅為看似健康的 9 ms；然而 P99 TPOT 卻高達 65 ms。真實使用者會頻繁遭遇這 65 ms 的肉眼可見停頓——這正是導致使用者流失的元兇。

在任何架構審查會議中，必須強制呈報 (P50, P90, P99) 黃金三元組。在追求極致使用者體驗時，P99 是唯一值得傾注全力最佳化的指標。

### 基準實測數字——TRT-LLM 上的 Llama-3.1-8B-Instruct（2026 年）

- 平均 TTFT：162 ms
- 平均 TPOT：7.33 ms
- 平均 E2E：1,093 ms
- P99 TPOT：依據分塊 Prefill 的配置顆粒度不同，落在 10 至 25 ms 區間。

上述為 NVIDIA 官方發布的權威標準基準。該數值會隨模型規格（70B 模型約為 3 至 5 倍）、底層硬體（B200 相較於 H100 具備約 3 倍提升）以及並行負載程度而動態位移。

### 量測工具定義衝突陷阱（The measurement trap）

2026 年業界最廣泛採用的兩款基準測試工具，在相同測試軌跡下對 TPOT 的計算產生了本質衝突：

- **NVIDIA GenAI-Perf**：在計算 ITL 時嚴格將首字 TTFT 剔除。ITL 僅從第 2 個 Token 開始統計。
- **LLMPerf**：將首字 TTFT 直接納入整體耗時計算分母。ITL 從第 1 個 Token 開始計算。

假設單一請求的 TTFT 為 500 ms，隨後花費 700 ms 解碼產出 100 個 Token（總耗時 1,200 ms）。GenAI-Perf 回報的 `ITL = 700/99 = 7.07 ms`；而 LLMPerf 回報的 `ITL = 1200/100 = 12.00 ms`。工具選型的不同會直接將帳面數字扭曲近一倍。

在呈報任何評測成果時，必須強制註明所使用的工具名稱，並白紙黑字附上其數學計算定義。

### 如何嚴謹建構一套 SLO（Constructing an SLO）

2026 年針對 70B 對話模型的標準消費端產品級 SLO 範例：

- TTFT P99 <= 800 ms。
- TPOT P99 <= 25 ms。
- 針對 300 Token 以內的短文字生成，E2E P99 <= 3 s。
- Goodput 綜合履約率目標 >= 99%。

在企業級內部 API 場景下，通常會將 TTFT 門檻進一步收緊至 200-400 ms，並適度放寬 E2E。核心在於將各維度白紙黑字寫死，持續監控這三者，並將 Goodput 作為唯一的北極星發布閘門。

### 標準實測作業方法（How to measure）

- 注入真實業務流量，或使用高度擬真的分佈生成器（例如 LLMPerf 搭配 `--mean-input-tokens 800 --stddev-input-tokens 300 --mean-output-tokens 150` 參數）。
- 基準壓測必須覆蓋目標峰值並行度的 2 倍壓力。
- 至少連續執行 30 至 50 次獨立試驗，從合併樣本中計算精確的百分位數。
- 發布評測成果時必須強制包含完整上下文：工具名稱、工具版本、受測模型、實體硬體型號、並行度階梯與 Prompt 長度分佈曲線。

```figure
throughput-latency
```

## Use It｜實際應用

`code/main.py` 實作了一套微型 Goodput 計算引擎。自動生成帶有長尾特徵的擬真延遲分佈，注入多維度 SLO 約束，並即時計算出系統的淨 Goodput。同時在完全相同的日誌軌跡上動態展示 GenAI-Perf 與 LLMPerf 對於 TPOT 計算的顯著數值偏差。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-slo-goodput-gate.md`。輸入具體的業務負載特徵與延遲預算，該 Skill 將自動產出可直接整合進 CI/CD 自動化管線的效能評測配置，強制以 Goodput 而非單純的吞吐量作為阻斷發布的唯一硬性閘門。

## Exercises｜練習

1. 執行 `code/main.py`。生成帶有 1% 長尾突波的延遲分佈。當你將 P99 TPOT 的約束門檻從 30 ms 收緊至 15 ms 時，整體的 Goodput 發生了怎樣的劇烈變化？
2. 某雲端服務商向你推銷「在 H100 上運作 Llama 3.3 70B 達到每秒 15,000 Token 吞吐量」。在信任並採購該服務前，列出你必須向其嚴肅質詢的三項關鍵追問。
3. 為何分塊 Prefill 能夠有效守護 P99 TPOT，卻無法顯著提升平均 TPOT？
4. 為一套語音助手系統（使用者是在「聽」聲音而非「看」文字）建構一套標準的消費級 SLO。哪一項延遲指標對使用者體驗的感知最為直接致命？
5. 仔細研讀 LLMPerf 的 GitHub README 與 GenAI-Perf 的官方技術文件。指出除了 TPOT 之外，這兩款工具在指標計算定義上產生分歧的另外三項具體度量。

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| TTFT | "time to first token" | Queue + network + prefill; dominated by prefill at long prompts |
| TPOT | "time per output token" | Memory-bound decode cost per token after first |
| ITL | "inter-token latency" | Same as TPOT in most tools (not all — see GenAI-Perf) |
| E2E | "end to end" | TTFT + TPOT * output_len; response-side network on top |
| Throughput | "tok/s" | Fleet efficiency; useless without latency percentiles |
| Goodput | "SLO-met rate" | Fraction of requests meeting every SLO constraint simultaneously |
| P99 | "tail" | 1-in-100 worst-case latency; the user experience metric |
| SLO multi-constraint | "the joint" | AND of all three latency bounds; a request fails if any one is violated |
| GenAI-Perf vs LLMPerf | "the tool trap" | Tools disagree on whether ITL includes TTFT |

## Further Reading｜延伸閱讀

- [NVIDIA NIM — LLM Benchmarking Metrics](https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html) — TTFT、ITL 與 TPOT 的官方權威定義手冊。
- [Anyscale — LLM Serving Benchmarking Metrics](https://docs.anyscale.com/llm/serving/benchmarking/metrics) — 業界替代定義與量測實踐指南。
- [BentoML — LLM Inference Metrics](https://bentoml.com/llm/inference-optimization/llm-inference-metrics) — 真實正式環境部署中的指標量測實戰。
- [LLMPerf](https://github.com/ray-project/llmperf) — 基於 Ray 打造的開源壓測工具儲存庫。
- [GenAI-Perf](https://github.com/triton-inference-server/perf_analyzer/blob/main/genai-perf/README.md) — NVIDIA Triton 官方出品的高性能推論評測工具。
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) — 廣泛採用 Goodput 作為驗收標準的全球產業聯盟基準測試。
