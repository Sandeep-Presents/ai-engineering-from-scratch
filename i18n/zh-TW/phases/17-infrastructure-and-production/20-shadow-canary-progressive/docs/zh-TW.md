# 影子流量、金絲雀發布與 LLM 漸進式交付（Shadow Traffic, Canary Rollout, and Progressive Deployment for LLMs）

> 大模型的上線發布融合了軟體工程中最艱難的挑戰：缺乏單元測試、故障模式極其發散瀰漫、線上反饋訊號嚴重滯後。標準落地順序為：(1) 影子模式（Shadow mode）——將正式環境真實流量完整拷貝一份推送給候選模型，純記錄日誌並展開對比，對使用者產生零感知干擾；能有效排查顯著的輸入分佈異常，但絕非品質保證的充分條件；(2) 金絲雀灰度發布（Canary rollout）——將真實使用者流量按 10% → 25% → 50% → 75% → 100% 階梯漸進切換，並在每個階段設立嚴格的發布閘門；全天候緊盯延遲百分位數、單請求成本、錯誤與拒絕回答率、輸出長度分佈以及使用者即時反饋率；(3) 雙盲 A/B 測試——唯有在系統穩定性得到客觀證實後，才針對具備顯著行為差異的候選方案展開 A/B 驗收。不可消除的隨機非確定性（Non-determinism）是全新常態——由於 GPU 浮點數運算不滿足結合律加上動態批次尺寸的隨機性，在完全相同的輸入下跨執行批次仍會產生高達 15% 的準確率波動。推論成本是一項動態變數，絕非固定常數——一個品質提升 20% 的模型，單次呼叫成本可能暴增 3 倍。回滾（Rollback）速度具有決定性意義：若回滾依賴重新編譯與重新部署容器，你的架構便太慢了。路由策略應當長駐於動態 Feature Flags 設定中；模型則長駐於帶有唯讀 SHA Digest 摘要的倉庫中；秒級回滾 = 翻轉動態策略開關 + 還原閾值 + 鎖定舊版本 Digest。

**Type:** Learn
**Languages:** Python (stdlib, toy canary-progression simulator)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 21 (A/B Testing)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 嚴格區分影子模式（零使用者影響的被動對比）、金絲雀灰度發布（真實線上流量的階梯漸進放量）與 A/B 測試（在系統已驗證穩定前提下的行為對比）三者的生命週期邊界。
- 熟練掌握大模型專屬的五大金絲雀關鍵指標（延遲百分位數、單請求成本、錯誤/拒答率、輸出長度分佈、使用者即時反饋）。
- 深刻解釋大模型的不可消除非確定性（高達 15% 波動）如何重新定義了發布過程中的「系統穩定」概念。
- 設計一套能在數秒內極速完成（純策略開關翻轉）、而非耗時數小時（容器重新建置部署）的標準回滾架構。

## The Problem｜問題

你剛剛交付了一款全新的 fine-tuning 大模型。線下評測集顯示其準確率取得了 3% 的穩健增益。你滿懷信心地在正式環境中全量切換上線。在短短 24 小時之內，雲端推論帳單暴增了 40%，使用者點踩（Thumbs-down）比例飆升了 8%，客服信箱收到了三起關於「回答邏輯荒腔走板」的緊急投訴。你匆忙啟動回滾。然而容器的重新打包、映像檔拉取與節點排程整整耗費了 3 個小時。團隊的週末徹底泡湯。

上述災難中的每一個環節，在工程層面皆完全可以避免。若部署了影子模式，早在任何真實使用者看到答案之前，那高達 40% 的 Token 暴漲就已被即時報警攔截。若採用了金絲雀灰度放量，當流量僅切入 10% 且點踩率開始抬頭時，發布閘門便會立即自動凍結阻斷。若導入了基於 Feature Flag 的動態策略回滾，修復故障僅需 30 秒。這套嚴苛的工程發布紀律，正是填補「線下指標看似光鮮」與「線上使用者真正滿意」之間巨大鴻溝的唯一橋樑。

## The Concept｜核心概念

### 影子模式（Shadow mode）

候選新模型接收與正式環境完全相同的真實請求；其產出的輸出內容僅被非同步寫入審查日誌，絕不回傳給終端使用者。使用者體驗受到絕對物理隔離。監控紀錄：

- 輸出文本內容（與當前線上模型逐行比對 Diff）。
- 產出 Token 消耗總量（評估實質成本增量）。
- 端到端延遲表現。
- 拒絕回答率與報錯異常。

能有效排查：成本失控暴增、輸出長度異常膨脹、安全防護欄誤殺導致的拒答率飆升，以及底層崩潰硬報錯。無法排查：使用者肉眼可見的真實主觀語義滿意度。影子模式本質上是一場冒煙測試（Smoke test），絕非終極的品質保證。

### 金絲雀灰度發布（Canary rollout）

配備多道自動化閘門的階梯式流量遞進切換。經典放量步長：1% → 10% → 25% → 50% → 75% → 100%。在每一個流量台階上，系統自動對照五大黃金指標進行硬性驗收：

1. **延遲百分位數（Latency percentiles）**——全面監控 P50、P95 與 P99。違規條件：金絲雀通道的 P99 延遲超過基準線上線的 1.5 倍。
2. **單請求成本（Cost per request）**——平均綜合費用（美元/請求）。違規條件：比基準線成本高出 20% 以上。
3. **錯誤與拒答率（Error / refusal rate）**——包含 5xx 服務端錯誤以及模型顯式吐出的拒答模板。違規條件：超過基準線的 2 倍。
4. **輸出長度分佈（Output length distribution）**——監控均值與 P99 長尾長度。違規條件：出現顯著的長度分佈漂移。
5. **使用者即時反饋率（User-feedback rate）**——點踩頻率與客服客訴工單量。違規條件：超過基準線的 1.5 倍。

### 非確定性是全新的隨機變異數（Non-determinism is the new variance）

在深度學習推論中，完全相同的輸入無法保證產出百分之百相同的輸出。根因在於：

- GPU 浮點數運算不滿足結合律（在高度並行環境下，求和歸約 Reduction 的物理順序隨批次動態變化）。
- 批次尺寸隨機變異數（相同的 Prompt 處於 128 個並行批次中與處於 16 個並行批次中，數值截斷微誤差不同）。
- 採樣隨機性（溫度係數 Temperature > 0）。

實測證實：在完全相同的評測集上多次執行，得分會產生高達 15% 的天然隨機波動。在金絲雀放量中，「系統穩定」的定義絕非指標與歷史完全分毫不差，而是指標穩定收斂在預期的噪聲容差範圍之內。在配置發布閘門時，閾值必須設定在底層物理噪聲基準線之上。

### 成本是變數，絕非固定常數（Cost is a variable）

一個宣稱準確率提升了 20% 的模型，其單次呼叫的實質成本可能高達原先的 3 倍。單請求成本是五大核心閘門中不可妥協的硬約束。發布一個雖然聰明、但徹底摧毀單位經濟效益（Unit economics）的模型，本身就屬於必須立即回滾的嚴重事故。

### 秒級回滾是唯一的自衛武器（Rollback is the weapon）

- **策略開關（Policy flag，動態功能標記系統）**：直接在配置中秒級翻轉流量切分比例；耗時僅需數秒。
- **模型版本鎖定（Model pinning，儲存庫 Digest 摘要）**：嚴格鎖定不可變的二進位 Digest 雜湊，堅決杜絕任何自動隱式升級。
- 秒級回滾實務 = 翻轉動態策略開關 + 將鎖定的 Digest 立即指向歷史前一個穩定版本。耗時以秒計算，絕非耗費數小時重新部署。

若你目前的技術堆疊在遭遇事故時依然要求重新編譯或重啟 Pod 才能完成回滾，在啟動任何發布之前，請先徹底修復該架構缺陷。

### 工具鏈生態（Tooling）

**Argo Rollouts** / **Flagger**——Kubernetes 雲原生漸進式交付控制器。與 Istio / Linkerd 等服務網格深度整合，實現權重導流。

**Istio 加權路由（Weighted routing）**——在服務網格層級實現精確的百分比流量切分。

**KServe / Seldon Core**——專為大模型推論設計的雲原生服務框架，內建金絲雀調度原語。

**功能開關系統（Feature flags）**——LaunchDarkly、Flagsmith、Unleash。在業務邏輯與策略層級實現零部署的秒級開關翻轉。

### 指標觀測節奏（Metrics cadence）

金絲雀閘門的評估週期通常設定為 5 至 15 分鐘，深度取決於實體流量規模。在每分鐘僅有 10 次請求的小流量系統中，1% 的灰度切分在單個窗口內僅能收集到 50 至 150 個資料點——這足以評估基礎延遲，但對於使用者點踩等稀疏訊號而言充斥著劇烈噪聲。切換至 10% 則能獲得 10 倍樣本。在每個流量台階上必須強制停留足夠的觀測時間，累積充足的統計樣本量。

### A/B 測試是可選的進階步驟（The A/B step is optional）

若候選模型與線上模型存在本質上的行為斷層（語氣風格迥異、成本曲線不同、推理範式劇變），在金絲雀完全驗證系統穩定後，應當在 50% 的流量上維持一段時期的長期 A/B 測試。但若新模型僅僅是經過微小修復與對齊的常規改良版本，一旦金絲雀全量閘門順利通關，可直接長驅直入推進至 100% 全量。

### 務必銘記的核心數字指標（Numbers you should remember）

- 標準金絲雀放量階梯：1% → 10% → 25% → 50% → 75% → 100%。
- 模型非確定性天花板：在相同輸入下跨次執行存在高達 15% 的天然準確率波動。
- 五大金絲雀守護閘門：延遲百分位數、單請求成本、錯誤與拒答率、輸出長度、使用者即時反饋。
- 成本警報閾值：單請求成本超出基準線 20% 即觸發自動熔斷阻斷。
- 合格回滾標準耗時：必須在數秒內完成，絕不可耗費數小時。

```figure
i4-canary-ramp
```

## Use It｜實際應用

`code/main.py` 模擬了一套在主動注入各類回歸缺陷（成本突增、長尾延遲惡化、拒答率飆升）的高壓情境下，執行金絲雀灰度放量的自動化控制器。即時輸出放量流程在何種具體階梯被硬性熔斷中斷，以及具體是哪一項指標閘門被觸發。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-rollout-runbook.md`。輸入候選新模型規格、線上基準指標與風險容忍度，該 Skill 將自動為你推導並產出完整的 影子模式 → 金絲雀放量 → 100% 全量發布 標準作業程序（SOP）與應急回滾 Runbook。

## Exercises｜練習

1. 執行 `code/main.py`。主動注入一項增加 25% 的成本回歸缺陷。金絲雀控制器會在放量的哪一個具體百分比階梯強制終止發布？
2. 你的新模型在線下評測中展現出 3% 的準確率提升，但正式環境單請求成本相應增加了 18%。這項改動究竟是否應當被允許發布上線？立足於具體公司商業模式給出正反雙向論述。
3. 設計一套能在 60 秒以內全自動完成的端到端回滾架構方案。完整枚舉所需的底層基礎設施與依賴元件。
4. 由於底層非確定性，你的驗證集在相同條件下展現出 ±7% 的正常波動。在此物理現實下，你該如何科學設定金絲雀發布閘門的容差係數，以避免引發頻繁的假警報？
5. 影子模式在正式放量前成功攔截了一次潛在的 40% 成本暴漲事故。為影子通道撰寫標準的自動化警報觸發規則與監控運算式。

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Shadow mode | "duplicate to new" | Zero-impact send-to-candidate for logging |
| Canary | "progressive traffic" | Gradual user-exposed rollout with gates |
| Gates | "rollout checks" | Metric thresholds that block progression |
| Non-determinism | "LLM variance" | Irreducible run-to-run differences |
| Policy flag | "flag flip rollback" | Config-level rollback, seconds not hours |
| Model pin | "registry digest" | Immutable reference to a model version |
| Argo Rollouts | "K8s progressive" | Kubernetes-native canary/rollback controller |
| KServe | "inference K8s" | Model serving with canary primitives |
| Istio weighted | "mesh split" | Service-mesh traffic splitter |

## Further Reading｜延伸閱讀

- [TianPan — Releasing AI Features Without Breaking Production](https://tianpan.co/blog/2026-04-09-llm-gradual-rollout-shadow-canary-ab-testing) — 在不破壞正式環境的前提下平穩發布 AI 功能。
- [MarkTechPost — Safely Deploying ML Models](https://www.marktechpost.com/2026/03/21/safely-deploying-ml-models-to-production-four-controlled-strategies-a-b-canary-interleaved-shadow-testing/) — 四大受控受限發布策略詳解。
- [APXML — Advanced LLM Deployment Patterns](https://apxml.com/courses/mlops-for-large-models-llmops/chapter-4-llm-deployment-serving-optimization/advanced-llm-deployment-patterns) — 進階大模型交付架構模式。
- [Argo Rollouts docs](https://argo-rollouts.readthedocs.io/) — 雲原生漸進式發布控制器官方文件。
- [Flagger docs](https://docs.flagger.app/) — Kubernetes 漸進式交付手冊。
