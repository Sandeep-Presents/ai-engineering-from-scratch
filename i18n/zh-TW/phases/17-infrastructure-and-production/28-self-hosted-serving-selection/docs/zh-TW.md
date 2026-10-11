# 自建推論服務選型——硬體與規模的終極適配（Self-Hosted Serving Selection — Matching Engine to Hardware and Scale）

> 推論引擎的選型是底層硬體、並行規模與軟體生態的三維函數——絕非單純閱讀效能排行榜所能決定。2026 年自建推論領域由四大主力引擎統治：llama.cpp、Ollama、vLLM 與 SGLang，而昔日明星 TGI 則落入維護模式。**llama.cpp** 在純 CPU 運算上速度最快——具備最廣泛的模型型錄支援，提供對量化精度與多執行緒的完全控制權。**Ollama** 是個人筆電上一鍵安裝的開發神器，但比原生 llama.cpp 慢約 15% 至 30%（源於 Go + CGo + HTTP 序列化開銷），在類正式環境的高並行負載下吞吐量存在高達 3 倍的鴻溝。**TGI 於 2025 年 12 月 11 日正式轉入維護模式**——未來僅提供錯誤修復，原始吞吐量比 vLLM 慢約 10%，但歷史上擁有頂級的可觀測性與 Hugging Face 原生生態整合。維護模式使其成為高風險的長遠賭注——新專案應當果斷轉向 vLLM 或 SGLang。**vLLM** 是通用正式環境的事實標準——v0.15.1（2026 年 2 月）全面支援 PyTorch 2.10、RTX Blackwell SM120 架構與 H200 極致調優。**SGLang** 則是多輪對話 Agent 與前綴密集型任務的專精之王——在全產業超過 40 萬張正式環境 GPU 上大規模運作（xAI、LinkedIn、Cursor、Oracle、GCP、Azure、AWS）。硬體硬約束：純 CPU 優先 → 首選 llama.cpp；AMD 異質運算 → vLLM 是獲得最強支援的坦途（TRT-LLM 深度綁定 NVIDIA）。2026 年標準流水線範式：開發端 = Ollama，預發測試 Staging = llama.cpp，正式環境 Prod = vLLM 或 SGLang。各引擎吃不同的權重格式——llama.cpp 家族吃 GGUF，GPU 引擎吃 Hugging Face safetensors——在各階段之間通常需要進行格式轉換。

**Type:** Learn
**Languages:** Python (stdlib, engine-decision tree walker)
**Prerequisites:** All Phase 17 lessons covering engines (04, 06, 07, 09, 18)
**Time:** ~45 minutes

## Learning Objectives｜學習目標

- 依據底層硬體（CPU / AMD / NVIDIA Hopper / Blackwell）、並行規模（單人 / 百人 / 萬人）與業務類型（常規聊天 / Agent 多輪 / 超長上下文），精準完成推論引擎選型。
- 深刻理解 TGI 於 2025 年 12 月 11 日進入維護模式的歷史分水嶺，並陳述為何新專案應當堅決導向 vLLM 或 SGLang。
- 熟練描述標準的「開發 → 預發 → 正式」分階流水線架構，並說明 GGUF 轉 safetensors 格式轉換在各階段之間的實體位置。
- 深刻解釋為何「CPU 優先」直接指向 llama.cpp，以及為何「採用 AMD 硬體」會直接一票否決 TRT-LLM。

## The Problem｜問題

你的團隊即將啟動一項私有化自建大模型推論服務。一位工程師強推 Ollama，另一位工程師非 vLLM 不用，第三位工程師則好奇發問「Hugging Face 的 TGI 難道不能開箱即用嗎？」這三種主張放在特定的孤立語境下皆有其道理，但沒有任何一個引擎適用所有情境。

在 2026 年，選型決策樹擁有不可顛倒的優先順序：硬體維度第一、並行規模第二、業務特徵第三。此外，一項發生在 2025 年底的標誌性產業大事件——TGI 於 12 月 11 日正式轉入維護模式——徹底改寫了新創專案的預設起點。

## The Concept｜核心概念

### 五大主流推論引擎（The five engines）

| 推論引擎 | 核心甜蜜點 | 關鍵維運備註 |
|--------|----------|-------|
| **llama.cpp** | 純 CPU / 邊緣端 / 極簡依賴 / 最廣泛模型型錄 | 純 CPU 速度之王，提供底層極致調校 |
| **Ollama** | 開發者本機筆電、單人測試、一鍵安裝 | 效能比 llama.cpp 慢 15-30%；正式環境並行吞吐落後 3 倍 |
| **TGI** | Hugging Face 生態深度綁定、強監管產業 | **已於 2025 年 12 月 11 日正式轉入維護模式** |
| **vLLM** | 通用企業級正式環境、100+ 並行使用者 | 業界通用預設標準；2026 年 2 月釋出 v0.15.1 |
| **SGLang** | 多步驟 Agent、前綴密集型 RAG 業務 | 超過 40 萬張實體 GPU 在正式環境大規模驗證 |

### 第一維度：硬體決定起點（Hardware-first decision）

**純 CPU 優先** → 堅決選用 llama.cpp。Ollama 雖然也能跑但速度明顯滯後。其餘任何開源推論引擎在純 CPU 環境下皆毫無競爭力。

**AMD GPU 叢集** → vLLM 是目前支援度最高的路徑（支援 AMD ROCm）。SGLang 亦支援 AMD。而 TRT-LLM 由於深度綁定 NVIDIA，在此被一票否決出局。

**NVIDIA Hopper 架構（H100 / H200）** → vLLM、SGLang 與 TRT-LLM 皆屬頂級梯隊。三者皆能充分釋放第四代 Tensor Core 的強悍潛力。

**NVIDIA Blackwell 架構（B200 / GB200）** → TRT-LLM 在吞吐量上領先（第 17 課第 07 節）。vLLM 與 SGLang 緊隨其後。

**Apple Silicon（M 系列晶片）** → llama.cpp（底層調用 Metal GPU）。Ollama 本質上是對其進行了外層包裝。

### 第二維度：並行規模決定拓撲（Scale-second decision）

**單人 / 本機開發測試** → 果斷選用 Ollama。單行指令拉起，數秒內輸出第一個字。

**10 至 100 位並行使用者 / 中小微團隊內部工具** → vLLM 單 GPU。

**100 至 10,000 位並行使用者 / 商業化正式環境** → vLLM production-stack（第 17 課第 18 節）或 SGLang。

**10,000 以上超大規模並行 / 跨國巨頭** → vLLM production-stack + Prefill/Decode 物理拆解（第 17 課第 17 節） + LMCache 叢集快取（第 17 課第 18 節）。

### 第三維度：業務負載決定專精（Workload-third decision）

**常規開放式對話 / 簡短問答** → vLLM 憑藉其最全面的通用調校穩操勝券。

**多輪對話 Agent 智慧代理（頻繁工具呼叫、動態規劃、記憶檢索）** → SGLang 的 RadixAttention 基數樹快取（第 17 課第 06 節）表現突出。

**前綴高度重複的巨型 RAG 檢索** → 毫無懸念首選 SGLang。

**程式碼自動補全與生成** → vLLM 表現優秀；SGLang 在專屬快取加持下略勝一籌。

**超長上下文推論（128k+）** → vLLM 搭配分塊 Prefill；SGLang 搭配階梯式分層 KV 快取。

### TGI 維護模式陷阱（The TGI maintenance trap）

Hugging Face 官方於 2025 年 12 月 11 日正式宣告 TGI 轉入維護模式——未來僅提供錯誤修正，實質停止功能演進。在歷史上，TGI 曾擁有頂級的可觀測性指標與無可挑剔的 Hugging Face 生態深度咬合，原始吞吐量僅略微落後於 vLLM。

但在 2026 年啟動新專案時：應當堅決避開 TGI。既有的遺留 TGI 叢集固然可繼續平穩服役，但長遠來看必須著手規劃遷移。SGLang 與 vLLM 是較安全的預設選項。

### 漸進式流水線模式（The pipeline pattern）

開發環境（Ollama） → 預發布測試環境（llama.cpp） → 正式環境（vLLM / SGLang）。不同引擎吃完全不同的二進位權重格式——llama.cpp 家族使用量化封裝後的 GGUF，而現代 GPU 推論引擎使用原生 Hugging Face safetensors 格式——因此跨階段時，工程管線中可能需要安排格式轉換。工程師在筆電上極速開發；測試環境精確映射正式環境的量化行為；正式環境全額釋放 GPU 算力。

### Ollama 的邊界警示（Ollama caveat）

Ollama 在個人開發測試階段體驗堪稱完美。但它絕非為多租戶共享的正式環境高並行而生：外層的 Go HTTP 網路傳輸引入了顯著延遲開銷，內部並行佇列管理機制遠比 vLLM 簡陋，且對 OpenTelemetry 等分散式遙測標準的支援嚴重滯後。在它最擅長的單人一鍵環境中盡情使用它；而在邁向正式環境時，堅決切換至 vLLM。

### 自建 vs 託管是一項獨立決策（Self-hosted vs managed is a separate decision）

第 17 課第 01 節（超大規模雲端託管）與第 02 節（新興推論算力平台）已完整剖析了託管服務的經濟學。本課的所有決策建立在「團隊已出於商業或法規考量決定私有化自建」的基礎之上。推動自建的核心驅動力：嚴苛的境內資料落地隱私限制、極致客製化的私有 fine-tuning 模型、超大規模流量下自建展現出的極致 TCO 總體擁有成本優勢，或是垂直領域專用模型在公共雲端市集中無法取得。

### 務必銘記的核心數字指標（Numbers you should remember）

- TGI 轉入維護模式官方時間：2025 年 12 月 11 日。
- vLLM v0.15.1 里程碑：2026 年 2 月釋出；原生支援 PyTorch 2.10 與 Blackwell SM120 架構。
- SGLang 全球正式環境部署規模：超過 40 萬張實體 GPU。
- Ollama 與原生 llama.cpp 效能差距：慢 15% 至 30%；在正式環境高壓下吞吐量存在高達 3 倍落差。

```figure
data-parallel
```

## Use It｜實際應用

`code/main.py` 實作了一套基於決策樹演算法的自動化選型推導引擎：輸入硬體架構、目標並行規模與業務負載特徵，程式將自動推導出唯一的推薦引擎，並給出詳盡的架構原理解析。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-engine-picker.md`。輸入當前伺服器資產清單、預期 QPS 負載曲線與應用程式型態，該 Skill 將自動產出最權威的推論服務引擎選型評估報告，並附帶一套完整的平滑遷移計畫書。

## Exercises｜練習

1. 執行 `code/main.py`。依據你所在團隊的真實硬體資產、並行規模與業務型態輸入參數。推導出的引擎選型是否與你的架構直覺完全吻合？
2. 你的基礎架構有 12 張 H100 和 8 張 AMD MI300X。應選哪個引擎？為什麼 TRT-LLM 不適用？
3. 團隊內部有工程師提議在新專案中繼續沿用 TGI，理由是「我們過去最熟悉它」。撰寫一份標準的技術架構評審意見書，論證為何必須啟動向 vLLM 或 SGLang 的全面技術遷移。
4. 梳理從「Ollama 開發環境」向「vLLM 正式環境」邁進時的全流程架構變更清單：涵蓋權重格式量化、引擎啟動配置以及分散式可觀測性埋點。
5. 針對 P99 輸入前綴達到 8k Token、且跨租戶之間存在高頻重複命中特徵的企業級 RAG 檢索產品，挑選最適推論引擎，並結合第 17 課第 11 節與第 18 節的技術給出複合架構藍圖。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| llama.cpp | 「CPU 專用」 | 支援的模型最廣，在 CPU 上速度最快 |
| Ollama | 「筆電用」 | 一個指令即可安裝，吞吐量適合開發用途 |
| TGI | 「HF 的推論服務」 | 自 2025 年 12 月起進入維護模式 |
| vLLM | 「預設選項」 | 2026 年通用的正式環境基準方案 |
| SGLang | 「agent 專用」 | 適合前綴密集型工作負載，採用 RadixAttention |
| TRT-LLM | 「綁定 NVIDIA」 | Blackwell 吞吐量領先，僅支援 NVIDIA |
| GGUF | 「llama.cpp 格式」 | 封裝多種 K-quant 變體 |
| Production-stack | 「vLLM Kubernetes」 | 第 17 課第 18 節的參考部署 |
| Pipeline pattern | 「開發→預備→正式」 | Ollama → llama.cpp → vLLM；各引擎使用不同權重格式 |

## Further Reading｜延伸閱讀

- [AI Made Tools — vLLM vs Ollama vs llama.cpp vs TGI 2026](https://www.aimadetools.com/blog/vllm-vs-ollama-vs-llamacpp-vs-tgi/) — 2026 四大推論引擎深度對比。
- [Morph — llama.cpp vs Ollama 2026](https://www.morphllm.com/comparisons/llama-cpp-vs-ollama) — 雙雄架構底層差異解析。
- [n1n.ai — Comprehensive LLM Inference Engine Comparison](https://explore.n1n.ai/blog/llm-inference-engine-comparison-vllm-tgi-tensorrt-sglang-2026-03-13) — 全球推論引擎權威評測報告。
- [PremAI — 10 Best vLLM Alternatives 2026](https://blog.premai.io/10-best-vllm-alternatives-for-llm-inference-in-production-2026/) — 2026 年頂級 vLLM 替代方案全覽。
- [TGI maintenance announcement](https://github.com/huggingface/text-generation-inference) — Hugging Face 官方發布的轉入維護模式公告。
- [vLLM v0.15.1 release notes](https://github.com/vllm-project/vllm/releases) — 官方版本發布手冊。
