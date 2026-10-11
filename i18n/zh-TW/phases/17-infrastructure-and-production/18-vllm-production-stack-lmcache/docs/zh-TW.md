# 正式環境推論服務堆疊——KV 卸載與快取感知路由（Production Serving Stack — KV Offloading and Cache-Aware Routing）

> 一套工業級的正式環境推論服務堆疊，能將智慧路由器、多個推論引擎與全鏈路可觀測性緊密咬合進單一 Kubernetes 部署體系——並將 KV 快取視為一種能夠隨時跨出 GPU 顯示記憶體邊界的共享資源。KV 快取卸載（KV Offloading）技術將 KV 快取從昂貴的 GPU 顯示記憶體中即時析出，並在跨請求與跨推論引擎之間重複利用（優先溢流至主機 CPU DRAM，隨後落盤至本機磁碟或 Ceph 分散式儲存）。vLLM 官方推出的 production-stack 是該架構的權威參考實作；LMCache 則是其中的核心卸載中樞。vLLM 0.11.0 推出的 KV Offloading Connector（2026 年 1 月）藉由 Connector API（v0.9.0+）使該機制徹底實現非同步化與隨插即用。卸載路徑在常規情況下被優雅隱藏於請求鏈路背後，但快取未命中與提升搬移仍可能微幅影響端到端延遲。即便在缺乏長前綴共享的業務中，LMCache 依然價值連城——當某張 GPU 遭遇突發 GPU 顯示記憶體耗盡時，被搶佔（Preempted）的在途請求可直接從 CPU 主記憶體中極速還原，而無需在 GPU 上狼狽重新運算完整的 Prefill。在跨 4 台 a3-highgpu-4g 實體機、共 16 張 H100（80GB HBM）上的官方評測證實：當 KV 快取總體積超越 GPU 實體顯示記憶體上限時，原生 CPU 卸載與 LMCache 皆能實質巨幅提升吞吐量；而在 KV 佔用極微小時，所有配置表現與基準線完全一致，僅引入微小的額外開銷。

**Type:** Learn
**Languages:** Python (stdlib, toy KV-spill simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 17 · 06 (SGLang/RadixAttention)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 精準繪製 vLLM production-stack 架構圖：智慧路由器、推論引擎 Worker、KV 卸載層與可觀測性面板。
- 深刻解釋 KV Offloading Connector API（v0.9.0+）的架構規範，以及 0.11.0 非同步路徑如何掩蓋卸載過程中的 I/O 延遲。
- 量化分析何時將 KV 卸載至 CPU-DRAM 具備壓倒性優勢（KV 總量 > HBM 顯示記憶體），以及何時它僅會徒增系統開銷（KV 極小可全量裝載於 HBM）。
- 在給定具體部署拓撲與維運複雜度約制下，在原生 vLLM CPU 卸載與 LMCache 連接器之間做出理性抉擇。

## The Problem｜問題

你的 vLLM 推論服務監控顯示：每當線上並行量稍微攀升，GPU 的 HBM 顯示記憶體便直接被打滿至 100%，群集頻繁爆發請求搶佔（Preemption）事件。大量進行中的在途請求被迫慘遭驅逐、重新排隊；排程器在一分鐘內對完全相同的 2k Token 輸入 Prompt 連續執行了 4 次昂貴的重複 Prefill。寶貴的 GPU 運算力全被無情耗損在毫無意義的重複運算中；系統的真實有效吞吐量（Goodput）被遠遠打壓在理論值之下。

單純採購更多 GPU 會讓硬體帳單線性失控。而為既有 GPU 物理擴充更多 HBM 顯示記憶體更是不可能。然而主機端的 CPU DRAM 卻極其廉價——單個 CPU 插槽即可輕鬆插滿 512 GB 以上的主記憶體；雖然其存取頻寬相較於 HBM 低了數個數量級，但作為暫時放置「溫熱」KV 快取的溢流池卻再合適不過。

LMCache 正是負責將 KV 快取動態提取並溢流至 CPU DRAM 的中樞，使被搶佔的請求能以極低代價極速復活，並讓多個推論引擎之間無縫共享公共前綴，徹底終結重複 Prefill 的悲劇。

## The Concept｜核心概念

### vLLM 正式環境技術堆疊（vLLM production-stack）

開源專案 `github.com/vllm-project/production-stack` 是官方出品的 Kubernetes 參考實作：

- **智慧路由器（Router）**——具備 KV 快取感知能力（第 17 課第 11 節），即時消費快取變更事件。
- **推論引擎 Worker（Engines）**——底層 vLLM 工作節點。按單卡或張量/流水線平行組獨立劃分。
- **KV 快取卸載層（KV cache offload）**——LMCache 專屬伺服器群集或原生連接器。
- **可觀測性體系（Observability）**——Prometheus 指標抓取、Grafana 儀表板與 OTel 全鏈路追蹤。
- **控制平面（Control plane）**——微服務發現、宣告式配置同步與無感滾動升級。

官方直接以 Helm Chart 搭配專屬 Operator 交付。

### KV 卸載連接器 API（The KV Offloading Connector API, v0.9.0+）

vLLM 自 0.9.0 版本起正式引入了隨插即用 Connector API，用以解耦底層各類異質 KV 快取後端。推論引擎負責將 Block 區塊非同步推送給 Connector；Connector 負責將其安全持久化（主記憶體 RAM、本機 NVMe 磁碟、S3 物件儲存或 LMCache 伺服器）。當後續請求命中時，Connector 極速將其回填至 GPU 顯示記憶體。

vLLM 0.11.0（2026 年 1 月）進一步引入了全非同步卸載路徑——卸載操作在背景無感執行，在常規情境下推論引擎的吐字管線完全無需阻塞等待。然而端到端延遲與整體吞吐量依然深度取決於業務負載曲線、KV 快取命中率與全域系統壓力；vLLM 官方備忘錄特別警示：在快取命中率極低時，自定義核心的卸載可能反向拖慢吞吐量，且非同步排程與推測解碼（Speculative Decoding）在當前版本中存在已知的協同邊界問題。

### 原生 CPU 卸載 vs LMCache 群集快取（Native CPU offload vs LMCache）

**原生 vLLM CPU 卸載**：單引擎本機隔離。直接將 KV Block 溢流至當前節點的主機 RAM 中。實作極其簡單迅速，零額外跨機網路跳轉。缺點是無法跨多個推論引擎節點共享。

**LMCache 專屬連接器**：全群集規模共享。將 KV Block 統一儲存在獨立的 LMCache 快取伺服器網格中（支援 CPU DRAM + Ceph/S3 階梯式儲存）。所有推論引擎皆可透明存取其中的任何區塊。官方已公布在 16 張 H100 上的完整評測報告。

選型標準：若僅僅是單個獨立推論節點面臨暫態 HBM 顯示記憶體告警，選原生 CPU 卸載即可。若存在多個推論節點且跨請求共享大量公共前綴（如多租戶 RAG、具備統一 System Prompt 的問答管線），果斷選用 LMCache。

### 基準測試實測表現（Benchmark behavior）

在橫跨 4 台 a3-highgpu-4g 機型、共 16 張 H100（80 GB HBM）的實測結果：

- 低 KV 佔用（短 Prompt、低並行）：所有方案表現與官方基準線無異，LMCache 額外引入約 3% 至 5% 的微弱系統負擔。
- 中等佔用：LMCache 透過跨節點的前綴複用，開始展現出正向效能收益。
- KV 總量大幅超越 HBM 顯示記憶體：原生 CPU 卸載與 LMCache 皆展現出爆發性的吞吐量增長；其中 LMCache 憑藉跨節點的快取共享能力斬獲了最巨大的領先優勢。

### 何時 LMCache 具備決定性優勢（When LMCache is decisive）

- 多租戶大模型服務，且跨租戶之間共享標準化長 System Prompt。
- 企業級 RAG 檢索管線，相同的文件區塊被多個終端使用者反覆檢索命中。
- 圍繞同一個 Base 模型並行掛載大量 LoRA 適配器，Base 模型的公共 KV 複用能消滅大量冗餘計算。
- 頻繁遭遇顯示記憶體告警與搶佔的高並行系統：從 CPU DRAM 還原顯示記憶體的代價遠遠低於重新執行一遍 Prefill。

### 何時絕不應開啟（When NOT to enable）

- 顯示記憶體空間極度充裕、幾乎從不觸發搶佔的微負載——開啟只會平白承擔 3% 至 5% 的管理開銷。
- 超短上下文業務（小於 1k Token）——網路與匯流排傳輸開銷大於重新執行 Prefill。
- 每個請求 Prompt 皆完全隨機、毫無公共前綴可言的單租戶孤島任務。

### 與拆解式推論架構的深度聯動（Integration with disaggregated serving）

第 17 課第 17 節的 Prefill/Decode 物理拆解與 LMCache 能夠產生完美的乘數效應：從 Prefill 資源池傳遞至 Decode 資源池的 KV 快取若未被立即消費，會自動降級沈澱至 LMCache 中；後續的相似查詢直接從 LMCache 秒級拉取。第 17 課第 11 節的快取感知路由器，能同時依據本地顯示記憶體或 LMCache 共享快取的命中分佈，做出最完美的調度決策。

### 務必銘記的核心數字指標（Numbers you should remember）

- vLLM 0.9.0：正式釋出隨插即用 Connector API。
- vLLM 0.11.0（2026 年 1 月）：引入全非同步卸載路徑；端到端延遲影響取決於負載分佈、快取命中率與排隊壓力。
- 16x H100 官方基準測試：當 KV 快取總需求超越 HBM 顯示記憶體容量時，LMCache 開始展現統治級效能。
- 顯示記憶體負載偏低情境下啟用 LMCache：平白引入約 3% 至 5% 的純系統開銷。

```figure
zero-sharding
```

## Use It｜實際應用

`code/main.py` 模擬了一套在頻繁觸發顯示記憶體搶佔的高並行業務環境下，開啟與未開啟 LMCache 的推論服務。終端機即時輸出所成功規避的重複 Prefill 總次數、全域有效吞吐量增益，以及 LMCache 開始產生淨正向收益的關鍵 HBM 顯示記憶體負載平衡點。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-vllm-stack-decider.md`。輸入具體業務流量特徵曲線與現有 vLLM 群集規模，該 Skill 將自動為你推導出究竟該選用原生本機 CPU 卸載、LMCache 群集快取，還是保持裸機狀態。

## Exercises｜練習

1. 執行 `code/main.py`。在 HBM 顯示記憶體利用率達到多少百分比以上時，LMCache 帶來的吞吐量收益才開始全面覆蓋其系統開銷？
2. 某租戶在一個長達 6k Token 的系統 Prompt 下每小時發起 200 次查詢。精確計算為該單一租戶導入 LMCache 所能帶來的理論算力節省。
3. LMCache 伺服器在架構上存在單點故障（SPOF）風險。為其設計一套標準的高可用（HA）容錯方案（多副本容災、自動降級回退至原生本機 CPU 卸載）。
4. 假設 LMCache 將冷資料儲存至傳統機械硬碟上的 Ceph 儲存池。針對 70B FP8 模型下 4k Token 的輸入（產生約 500 MB KV 快取），從 Ceph 讀取該快取所需的物理時間與在 GPU 上重新執行一遍 Prefill 相比，孰優孰劣？
5. 深入辯論 vLLM 0.11.0 的全非同步路徑究竟是否完全「免費」——在極限高並行壓力下，其系統開銷究竟悄悄轉移到了何處？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| Production-stack | 「參考部署」 | vLLM 的 Kubernetes Helm chart 與 operator |
| Connector API | 「KV 後端介面」 | vLLM 0.9.0+ 可插拔的 KV 儲存介面 |
| Native CPU offload | 「引擎本機溢出」 | 將 KV 儲存在同一引擎的主機 RAM |
| LMCache | 「群集 KV 快取」 | 位於 CPU DRAM 與磁碟、供多個引擎共用的 KV 快取伺服器 |
| 0.11.0 async | 「非阻塞卸載」 | 在引擎串流背後執行卸載 |
| Preemption | 「騰出空間時逐出」 | HBM 滿載時搬移 KV 快取區塊 |
| Prefix reuse | 「相同系統 prompt」 | 多個查詢共用開頭，因此命中快取 |
| Ceph tier | 「磁碟層」 | 快取階層中位於 DRAM 下方的持久性儲存 |

## Further Reading｜延伸閱讀

- [vLLM Blog — KV Offloading Connector (Jan 2026)](https://blog.vllm.ai/2026/01/08/kv-offloading-connector.html) — 官方架構發布長文。
- [vLLM Production Stack GitHub](https://github.com/vllm-project/production-stack) — 官方 Helm Chart 與 K8s Operator 開源專案。
- [LMCache for Enterprise-Scale LLM Inference (arXiv:2510.09665)](https://arxiv.org/html/2510.09665v2) — 企業級推論快取奠基論文。
- [LMCache GitHub](https://github.com/LMCache/LMCache) — 連接器開源核心實作。
- [vLLM 0.11.0 release notes](https://github.com/vllm-project/vllm/releases) — 非同步路徑技術規格細節。
