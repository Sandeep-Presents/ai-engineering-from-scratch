# ColPali 與視覺原生文件 RAG（ColPali and Vision-Native Document RAG）

> 傳統的 RAG 管線將 PDF 強制解析為純文字、切分為段落區塊（Chunks）、計算文字 embedding、最後存入向量資料庫。全鏈路的每一個環節都在大量丟失訊號：OCR 遺漏了統計圖表、文字切塊撕裂了表格行、文字 embedding 完全無視任何插圖幾何。ColPali（Faysse 等人，2024 年 7 月）提出了一個直擊靈魂的問題：為什麼一開始非得提取文字不可？直接透過 PaliGemma 將整頁影像編碼為高維向量，採用 ColBERT 風格的後期交互（Late Interaction）進行檢索，完整保留文件天然承載的版面、圖表、字型與所有排版訊號！公開權威基準實測：在高度依賴視覺排版的文件上，其端到端問答準確度比傳統純文字 RAG 高出整整 20% 至 40%。ColQwen2、ColSmol 與 VisRAG 迅速推廣了這一全新範式。本課深入探討視覺原生 RAG 的核心原理，並動手建構微型的類 ColPali 檢索索引器。

**Type:** Build
**Languages:** Python (stdlib, multi-vector indexer + MaxSim scorer)
**Prerequisites:** Phase 11 (LLM Engineering — RAG basics), Phase 12 · 05 (LLaVA)
**Time:** ~180 minutes

## Learning Objectives｜學習目標

- 深入解釋「雙編碼器檢索（每篇文件單一整體向量）」與「後期交互檢索（每篇文件保存多個細粒度向量）」之間的本質架構差異。
- 說明 ColBERT 的 MaxSim 最大相似度運算子，以及 ColPali 如何優雅地將其從文字 token 泛化至影像 patch。
- 動手打造一個微型的類 ColPali 索引器：單頁影像 → 抽取 patch embedding → 針對查詢詞 embedding 計算 MaxSim 分數 → 輸出 Top-k 候選頁面。
- 在商業發票核對與財務報表分析的情境下，深入對比「ColPali + Qwen2.5-VL 生成器」與「傳統文字 RAG + GPT-4」的系統優劣。

## The Problem｜問題

在 PDF 檔案上執行傳統文字 RAG，本質上丟棄了整份文件的大部分核心訊號。財報中的第三季營收成長曲線通常畫在折線圖上；醫療診斷報告的關鍵結論深植於帶註解的超音波影像中；商業法律合約的簽署欄位本質上是版面排版幾何事實，而非單純的文字事實。

傳統文字 RAG 的典型流水線：

1. PDF 檔案 → 透過 OCR 或 pdftotext 強制轉錄為文字。
2. 純文字內容 → 硬性切分為 300 到 500 個 token 的段落區塊（Chunks）。
3. 每個 Chunk → 通過雙編碼器（Bi-encoder）壓縮為單一的 embedding 向量。
4. 使用者發問 → 計算查詢 embedding → 餘弦相似度比對 → 召回 Top-k 個文字區塊。
5. 將檢索出的 Chunks 與問題一同拼入 prompt → 餵給 LLM 解答。

整整五步皆存在不可逆的資訊損耗。統計圖表被徹底無視；結構化表格被跨區塊硬生生截斷；多欄專業排版被降維抹平；插圖旁的標註箭頭徹底蒸發。

ColPali 給出的破局之道：徹底告別前置 OCR，直接為整頁影像計算向量表徵。並引入 ColBERT 風格的後期交互機制，讓模型在查詢檢索瞬間，能夠直接凝視高解析度的局部視覺 patch。

## The Concept｜核心概念

### ColBERT（2020 年）

ColBERT（Khattab 與 Zaharia，arXiv:2004.12832）原先是純文字檢索領域的革命性突破。它徹底顛覆了「每篇文件僅生成單一全域向量」的粗糙做法，改為文件中的「每一個 token 皆各自保留獨立的特徵向量」。在查詢檢索階段：

- 查詢字句的每個 token 各自產生獨立的 embedding（共 N_q 個向量）。
- 文件內容的每個 token 各自具備預先快取的 embedding（共 N_d 個向量）。
- 總相似度分數 = 針對查詢中的每個 token，在文件所有 token 中尋找餘弦相似度最大值，隨後將這些最大值加總求和：Σ_i max_j cos(q_i, d_j)。

這正是著名的 MaxSim 運算。查詢中的每一個關鍵字詞，都會在文件中自主「挑選」與其最匹配的最佳 token，最終分數為所有命中分數的累加。

優勢：檢索召回率極高，能精確捕捉極細粒度的詞彙語意；代價：每篇文件需要儲存 N_d 個實數向量，索引儲存開銷較為龐大。

### ColPali 架構原理

ColPali（Faysse 等人，arXiv:2407.01449）極富創意地將 ColBERT 典範完全套用於真實影像之上。

- 每一個文件頁面皆透過 PaliGemma（ViT 視覺塔 + 語言大腦）直接編碼為二維 patch embedding 集合：每頁輸出 N_p 個向量。
- 使用者輸入的文字查詢，直接編碼為查詢 token embedding 集合：共 N_q 個向量。
- 相關性分數 = Σ_i max_j cos(q_i, p_j)，即在「查詢文字 token」與「文件頁面影像 patch」之間直接計算 MaxSim 矩陣！
- 依據加總後的最終得分，高精確度召回 Top-k 個相關頁面。

在文件知識庫入庫階段：以 PaliGemma 為每一頁 PDF 影像計算 embedding，並保存其所有 patch 向量集合。在線上檢索階段：為使用者查詢生成向量，並針對所有儲存的頁面向量矩陣計算 MaxSim，迅速篩選出最佳候選頁面。

核心優勢：在高度依賴視覺排版的文件集上，其端到端表現比傳統文字 RAG 暴增 20% 至 40%！每一個 patch 向量皆完整承載了當地的局部排版幾何、色彩與文字訊號。

工程挑戰：每頁 N_p 個 patch × 4 位元組浮點數 × D 維度向量，儲存量增長迅速。實務上透過乘積量化（PQ）或最佳化乘積量化（OPQ）技術進行數倍壓縮。

### ColQwen2 與 ColSmol

ColQwen2（illuin-tech，2024–2025 年）：將底層的 PaliGemma 視覺編碼器升級為更強悍的 Qwen2-VL。基礎表徵能力更優異，檢索召回精度進一步拔高。

ColSmol 則是專為本地端與邊緣裝置量身打造的輕量化版本。參數量僅約 10 億（1B），可在消費級家用顯示卡上流暢運行。

### VisRAG

VisRAG（Yu 等人，arXiv:2410.10594）代表了另一種權衡取態：它不採用微觀 patch 層級的 MaxSim 運算，而是利用多模態 VLM 將整頁影像直接池化壓縮為「單一頁面向量」，隨後沿用傳統雙編碼器進行高速檢索。建庫速度更快、儲存空間極小，但微觀局部細節的召回率略遜一籌。

兩者取捨：追求極致精度選 ColPali；追求億級海量規模選 VisRAG。

### M3DocRAG

M3DocRAG（Cho 等人，arXiv:2411.04952）將多模態檢索進一步拓展至「跨多頁、跨多文件」的複雜推理場景。它能在跨越多份龐大文件庫中檢索出分散的多個關鍵頁面，並為後端 VLM 組織出結構化的多頁綜合輸入 context。

### ViDoRe——視覺文件檢索評測基準

ColPali 團隊專門伴隨發布的權威評測基準：ViDoRe（Visual Document Retrieval Evaluation）。測試集全量覆蓋財務年報、學術論文、政府公文、醫療病歷與工程技術手冊。核心衡量指標為 nDCG@5。

實測結果：ColPali-v1 在 ViDoRe 上的 nDCG@5 分數高達約 80%；而傳統文字 RAG 在同一批文件上的表現僅落在 50% 到 60% 區間。

### 端到端視覺原生 RAG 完整管線

現代視覺原生 RAG 的標準工程實務：

1. 知識入庫：PDF 檔案 → 逐頁彩現為圖片 → PaliGemma 編碼 → 索引並持久化所有 patch embedding 向量。
2. 線上檢索：使用者輸入文字發問 → 生成查詢 token embedding → 對全庫頁面計算 MaxSim 分數 → 精準召回 Top-k 張原頁點陣圖。
3. 答案生成：將 Top-k 張高畫質頁面影像連同原始問題，直接餵入前沿多模態大模型（Qwen2.5-VL 或 Claude）→ 直接輸出最終解答。

全生命週期完全無需前置 OCR 引擎介入。統計圖表、流程箭頭、特殊字型與版面幾何，毫無損耗地直接流淌至最終答案中。

### 儲存空間數學精算

以一份包含 50 頁、每頁切分 729 個 patch、embedding 維度為 128 的財務報表為例：

- ColPali 視覺原生方案：50 頁 × 729 個 patch × 128 維 × 4 位元組 = 約 18 MB 未壓縮實數資料；套用 PQ 量化後可壓縮至約 4 MB。
- 傳統純文字 RAG：50 個文字區塊 × 768 維 × 4 位元組 = 約 150 KB。

ColPali 在單份文件的原始儲存開銷上約為傳統文字 RAG 的 30 倍。在海量規模下，藉由 OPQ / PQ 等向量量化壓縮演算法，可將儲存代價控制在 5 到 10 倍的可接受工業範圍內。

### 傳統文字 RAG 依然佔優的邊界

- 毫無視覺排版價值的純文字文檔（如維基百科純文字詞條、程式碼日誌記錄、聊天對話紀錄）：文字 RAG 更加輕巧經濟。
- 包含數億頁超大規模的極致海量歷史歸檔庫，此時儲存與記憶體成本是壓倒一切的決定因素。
- 法律強制要求在檢索結果中必須同步附帶高確定性可溯源 OCR 文字文本的受規管業務。

除上述特定邊界之外，在 2026 年的絕大多數企業級真實文件場景中——財務報表、學術論文、商業合約、醫療檢驗單與 UI 設計手冊——視覺原生 RAG 皆展現出壓倒性的精準度優勢。

```figure
mm-maxsim
```

## Use It｜實際應用

`code/main.py` 完整實作了：

- 玩具 patch 編碼器原型：將虛擬的「文件頁面」（局部特徵二維矩陣）映射為 patch embedding 集合。
- 核心 MaxSim 計算引擎：精準實作 ColBERT 風格的「查詢 token 集合 vs 頁面 patch 集合」最大相似度加總演算法。
- 索引 5 個玩具文件頁面、執行 3 組不同查詢，並依相關性得分精確輸出 Top-k 檢索結果。

## Ship It｜交付成果

本課產出 `outputs/skill-vision-rag-designer.md`。給定具體的文件檢索專案規格（文件視覺豐富度、文檔總頁數、推論延遲上限、儲存硬體預算），它能在 ColPali、ColQwen2、VisRAG 與傳統純文字 RAG 之間給出清晰的技術選型與精確的向量儲存空間精算表。

## Exercises｜練習

1. 一份長達 200 頁的企業年度報告，在每頁 729 個 patch、128 維度 embedding、4 位元組單精度浮點數的設定下，精確計算其原始未壓縮的向量儲存大小，以及經過 8 倍 PQ 量化壓縮後的實體儲存空間。

2. MaxSim 的數學公式為 Σ_i max_j cos(q_i, p_j)。請深入解釋：相較於將所有向量簡單取平均再計算餘弦相似度，MaxSim 額外捕捉到了何種至關重要的微觀語意資訊？

3. ColPali 以影像 patch 作為最細粒度的索引單元。若我們仿照 ColBERT 的做法，改在 OCR 辨識出的單詞層級建立多向量索引，系統會產生何種得失權衡？

4. 針對一個包含 100 萬頁文件的企業資料庫，要求端到端查詢延遲嚴格限制在 500 毫秒以內。請在 ColQwen2 與 VisRAG 之間做出抉擇，並給出完整的技術論證。

5. 閱讀 M3DocRAG 論文（arXiv:2411.04952）。說明其跨多頁注意力模式的運作機理，並剖析它與 ColPali 單頁獨立檢索相比的核心技術突破。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際意義 |
|------|-----------------|------------------------|
| Late interaction | 「後期交互機制」 | 不將文件壓縮為單一向量，而是保留全量 token/patch 向量，在查詢時計算 MaxSim |
| MaxSim | 「最大相似度求和」 | 針對查詢中的每個 token，在文件中尋找最相似的目標並加總；ColBERT 與 ColPali 的靈魂 |
| Bi-encoder | 「雙編碼器單向量」 | 將整篇文件壓縮為單一向量的傳統做法；檢索極速但徹底丟失微觀細節 |
| Multi-vector | 「多向量索引架構」 | 為每篇文件或頁面保存多個向量；儲存開銷提升數倍，但檢索精度與召回率大幅躍升 |
| Patch embedding | 「影像切片特徵向量」 | VLM 視覺編碼器為每個空間 patch 產出的高維向量；以集合形式快取於向量庫中 |
| ViDoRe | 「視覺文件檢索權威基準」 | ColPali 團隊推出的標準評測集，專門評估在富視覺版面文件上的跨模態檢索表現 |
| PQ quantization | 「乘積量化壓縮」 | 在維持向量內積相似度保真度的前提下，將向量儲存開銷壓縮約 8 倍的高效演算法 |

## Further Reading｜延伸閱讀

- [Faysse et al. — ColPali (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449) ——視覺原生 RAG 開山之作
- [Khattab & Zaharia — ColBERT (arXiv:2004.12832)](https://arxiv.org/abs/2004.12832) ——後期交互檢索機制奠基論文
- [Yu et al. — VisRAG (arXiv:2410.10594)](https://arxiv.org/abs/2410.10594) ——單向量頁面級視覺 RAG
- [Cho et al. — M3DocRAG (arXiv:2411.04952)](https://arxiv.org/abs/2411.04952) ——多頁跨文件多模態檢索架構
- [illuin-tech/colpali GitHub](https://github.com/illuin-tech/colpali) ——官方開源實作倉庫
