# LLaVA 與視覺指令調校（LLaVA and Visual Instruction Tuning）

> LLaVA（2023 年 4 月）堪稱當今地表被借鑑複製最多次的多模態架構。它以極簡的雙層 MLP 取代了 BLIP-2 複雜的 Q-Former，以純粹的 token 拼接（concatenation）取代了 Flamingo 的門控交叉注意力，並完全在由 GPT-4 根據純文字描述生成的 15.8 萬組視覺指令對話上完成訓練。在 2023 至 2026 年間，任何親手打造過 VLM 的工程師，幾乎都曾實作過某種 LLaVA 變體。LLaVA-1.5 引入了 AnyRes；LLaVA-NeXT 大幅推升了影像解析度；LLaVA-OneVision 則將單圖、多圖與影片統一於同一套訓練配方中。本課帶你完整走通這套工程配方、親手實作投影器，並深度剖析「何以極簡終獲全勝」。

**Type:** Build
**Languages:** Python (stdlib, projector + instruction-template builder)
**Prerequisites:** Phase 12 · 02 (CLIP), Phase 11 (LLM Engineering — instruction tuning)
**Time:** ~180 minutes

## Learning Objectives｜學習目標

- 建構雙層 MLP 投影器，將 ViT patch embedding（維度 1024）精確映射至 LLM 的 token embedding 維度（維度 4096）。
- 完整剖析 LLaVA 的兩階段訓練配方：(1) 在 55.8 萬組圖文描述配對上進行投影器特徵對齊，(2) 在 15.8 萬組由 GPT-4 生成的對話輪次上進行視覺指令調校。
- 建構標準 LLaVA 格式 prompt，妥善配置影像 token 佔位符、系統 prompt 以及使用者／助理的多輪對話結構。
- 深入解釋為何儘管 Q-Former 具備顯著的 token 節省優勢，整個開源社群最終依然全面轉向更極簡的 MLP 投影器。

## The Problem｜問題

BLIP-2 的 Q-Former（第 12.03 課）能將一張影像高度壓縮為 32 個 token。優雅、高效且在多項基準評測中表現優異。然而它伴隨著兩大棘手痛點。

首先，Q-Former 雖然可訓練，但其預訓練損失與最終的生成任務存在脫節。第 1 階段訓練的是 ITC、ITM 與 ITG 複合目標；第 2 階段才訓練語言模型損失。Query 向量學習到的是某種中間過渡表徵，LLM 必須費力去解碼適應它。在極致壓縮的資訊瓶頸中，許多細微的視覺特徵不可避免地遺失了。

其次，Q-Former 自身佔用了 1.88 億參數。在 2023 年 LLaVA 誕生之際的技術條件下，你必須為特定的目標 LLM 專屬協同設計它。更換了 LLM，就必須重訓 Q-Former；更換了視覺編碼器，也必須重訓。每一次架構組合都是一個獨立且耗時的研究專案。

LLaVA 給出的解答簡直簡單得令人咋舌：直接取 ViT 的 576 個 patch token，讓每個 token 通過一個樸素的雙層 MLP（`1024 → 4096 → 4096`），隨後毫不客氣地將全數 576 個 token 直接傾倒至 LLM 的輸入序列中！沒有人為瓶頸，沒有複雜古怪的第 1 階段預訓練目標，純粹在標準因果語言模型損失下端到端訓練 MLP。

那麼指令資料從何而來？這正是 LLaVA 的第二項天才洞見：利用純文字版的 GPT-4 來生成視覺指令資料！將 COCO 影像的既有人工文字描述與邊界框（bounding-box）座標餵給 GPT-4，要求它模擬人類生成多輪對話、詳細視覺描述與深度複雜推理問題。一夕之間免費獲得了 15.8 萬組指令—回應對話輪次，全程零人工標註成本。

最終產物驚豔業界：僅需 8 張 A100 訓練短短一天，在 MMMU 評測上便擊敗了龐大的 Flamingo，並開源釋出了極易被社群二創擴展的權重。到了 2023 年底，基於 LLaVA 衍生的衍生模型已超過 50 個。

## The Concept｜核心概念

### 網路架構

以 130 億參數的 LLaVA-1.5（13B）為例：
- 視覺編碼器：CLIP ViT-L/14 @ 336（在第 1 階段凍結，第 2 階段可選擇性解凍）。
- 投影器（Projector）：帶有 GELU 活化函數的雙層 MLP，結構為 `1024 → 4096 → 4096`。
- 語言模型（LLM）：Vicuna-13B（後續升級為 Llama-3.1-8B）。

針對一張影像與文字 prompt 的前向傳播流程如下：

```
img -> ViT -> 576 patches of dim 1024
patches -> MLP -> 576 tokens of dim 4096
prompt: system + "<image>" placeholder + user question
replace <image> token with the 576 projected tokens
feed the full sequence to the LLM
decode response
```

影像在 LLM 的 context 視窗中精確佔據 576 個 token。在早期 2048 token 的視窗中，這仍留有 1472 個 token 供文字發揮；而在現代動輒 32k 甚至更長的 context 視窗中，576 個 token 的開銷幾乎可以忽略不計。

### 第 1 階段：投影器對齊

凍結 ViT，凍結 LLM。僅訓練該雙層 MLP 投影器。資料集：55.8 萬組圖文描述配對（篩選自 LAION-CC-SBU）。損失函式：以投影後的影像 token 為條件，針對圖片說明文字計算標準語言模型生成損失。

在批次大小 128 的設定下僅需訓練一個 epoch，數小時內即可完成。投影器在此階段學會了將 ViT 的視覺特徵空間平滑映射至 LLM 的文字 embedding 空間。不涉及任何特定下游任務的監督訊號。

### 第 2 階段：視覺指令調校

解凍投影器（維持可訓練狀態）。解凍 LLM 本體（通常進行全參更新，亦可採用 LoRA）。在 15.8 萬組視覺指令對話資料上展開訓練。

其指令資料的建構管線極具啟發性。Liu 等人透過以下步驟全自動合成：
1. 選取一張 COCO 影像。
2. 提取其既有的文字描述（包含 5 條人類撰寫的 caption 與物件邊界框清單）。
3. 傳送至純文字版 GPT-4，搭配三種 prompt 模板：
   - 自由對話（Conversation）：「模擬使用者與助理圍繞這張影像展開來回多輪對話。」
   - 詳細描述（Detailed description）：「給出一段豐富且具備空間細節的影像描述。」
   - 複雜推理（Complex reasoning）：「提出一個需要對影像進行深度因果或空間推理的問題，並給出詳細解答。」
4. 將 GPT-4 的生成文字解析為標準的（指令, 回應）對話格式。

整個資料生成過程完全無需 GPT-4 直接「看」到影像，純粹依賴豐富的文字描寫。GPT-4 藉由文字補全幻化出極具真實感的視覺場景細節。儘管帶有些許雜訊，但實驗證明：僅僅 15.8 萬輪高質量對話，便足以徹底解鎖開源大模型的多模態對話與推理能力。

### 為何開源社群集體擁抱此架構

- 無需調校任何複雜的第 1 階段對比損失，全生命週期貫穿純粹的語言模型損失（LM loss）。
- 投影器訓練速度極快，僅需數小時而非數天。
- 語言模型極易熱插拔替換（如 LLaVA-Llama2、LLaVA-Mistral、LLaVA-Llama3），更換底座後只需重新對齊投影器即可。
- 視覺指令資料生成管線完全依賴現成的 GPT-4 API，針對任何垂直領域（如醫療、工業檢測）皆能極低成本快速重現。

### LLaVA-1.5 與 LLaVA-NeXT

LLaVA-1.5（2023 年 10 月）帶來關鍵升級：
- 在指令調校資料中混入傳統學術任務資料集（VQA、OKVQA、RefCOCO）。
- 最佳化系統 prompt 模板。
- 將 context 支援從 2048 大幅拓展至 32k。

LLaVA-NeXT（2024 年 1 月）進一步引入：
- AnyRes 任意動態解析度：將高解析度影像依長寬比例動態切割為 2×2 或 1×3 的 336×336 網格區塊，外加一張全景縮圖。每個切片各轉化為 576 個 token；每張影像總計約 2880 個視覺 token。在 OCR 與圖表辨識任務上取得飛躍性突破。
- 引入 ShareGPT4V 高品質密集標註資料（由 GPT-4V 生成的精細圖片說明）。
- 採用更強大的開源底座 LLM（Mistral-7B、Yi-34B）。

### LLaVA-OneVision

第 12.08 課將深入剖析 OneVision。簡要而言：它沿用相同的簡潔投影器架構，但在訓練策略上設計了精心調配的課綱，將單張影像、多圖比較與長影片理解完美收斂於單一模型之中，並共用統一的視覺 token 預算管理機制。

### 與 Q-Former 的架構對比

| 比較維度 | Q-Former（BLIP-2） | MLP 投影器（LLaVA） |
|---|---|---|
| 每張影像的視覺 Token 數 | 32 個 | 576 個（基礎版）或 2880 個（AnyRes） |
| 可訓練參數量 | 1.88 億 + LLM | 4000 萬 + LLM |
| 第 1 階段訓練損失 | ITC + ITM + ITG 複合損失 | 純因果語言模型損失（LM only） |
| 抽換底座 LLM 的彈性 | 需重新訓練完整 Q-Former | 僅需重訓輕量級投影器即可無縫抽換 |
| 多圖支援彈性 | 結構繁複不易擴展 | 極其天然（直接依序拼接 token） |
| 視訊處理能力 | 跨幀協同較繁瑣 | 極其天然（逐幀投影後依序拼接） |
| Token 預算負擔 | 極低 | 較重 |

MLP 在系統簡潔度與 token 語意保真度上全面勝出；Q-Former 則僅在嚴苛的 token 數量預算上保有優勢。到了 2023 年底，隨著各大 LLM 的 context 視窗普遍擴充至 32k–128k 以上，token 數量不再是致命瓶頸，極簡的 MLP 路線因而奠定了絕對的統治地位。

### Prompt 格式規範

```
A chat between a curious human and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the human's questions. USER: <image> Describe this image in detail. ASSISTANT: The image shows ...
```

其中 `<image>` 為特殊的佔位符 token。在文字進行真正的 token 化之前，它會被預先投影好的 576 個視覺 token（在 AnyRes 下為 2880 個）直接就地替換。Tokenizer 會看見一串比原先訓練時稍長的序列，但 LLM 能夠毫無阻礙地解讀它，因為第 1 階段的投影器對齊已教會了它這兩種模態的語意映射。

### 參數經濟學

LLaVA-1.5-7B 的參數組成剖析：
- 視覺編碼器：CLIP ViT-L/14 @ 336 佔 3.03 億參數（第 1 階段凍結，第 2 階段常維持凍結或部分解凍）。
- 雙層線性投影器：約 2200 萬可訓練參數。
- 語言模型：Llama-7B 佔 70 億參數。
- 全系統總計：約 73 億參數。在第 2 階段實際參與梯度更新的為 70 億 LLM 加上 2200 萬投影器。

第 2 階段的訓練耗時：在單台配備 8 張 A100 的伺服器節點上僅需約 20 小時。這正是關鍵數字——「一天之內、單一節點、百分之百可重現」。這正是 LLaVA 能夠席捲全球開源社群的最核心動力。

```figure
mm-llava-projector
```

## Use It｜實際應用

`code/main.py` 完整實作了：

1. 雙層 MLP 投影器（為展示玩具規模，設定維度為 16 → 32 → 32），以純 Python 撰寫。
2. Prompt 建構管線：組合系統提示（system prompt）+ 將 `<image>` 替換為 N 個投影後的視覺 token + 使用者發問 + 助理回答佔位符。
3. 視覺化檢驗 576 個視覺 token 在 LLM context 中的空間佔比（在 2k / 32k / 128k 等不同 context 視窗下所消耗的百分比）。

## Ship It｜交付成果

本課產出 `outputs/skill-llava-vibes-eval.md`。給定任一 LLaVA 家族檢查點，它將自動運行包含 10 組精心設計 prompt 的啟發式質性評測套件（3 組圖文說明、3 組 VQA 問答、2 組空間複雜推理、2 組安全拒絕回答），並輸出清晰的人類可讀評分卡。這並非學術標準基準，而是一個極速驗證投影器與 LLM 是否成功接通且未發生特徵崩潰的冒煙測試（smoke test）。

## Exercises｜練習

1. 計算結構為 `1024 → 4096 → 4096` 的雙層 MLP 投影器的可訓練參數量。包含 GELU 活化函數與 bias 偏置項，它在全體 LLaVA-13B 模型中佔多少比例？

2. 為「安全拒絕回答」場景設計一個 LLaVA prompt——例如影像中包含個人隱私面孔。寫出預期的助理合規回應。為什麼 LLaVA 應該在零樣本下主動拒絕回答此問題？需要何種訓練資料來強化這類拒答行為？

3. 閱讀 LLaVA-NeXT 技術部落格中的 AnyRes 章節。計算一張尺寸為 1344×672 的影像在 AnyRes 切割策略下所產生的總視覺 token 數。並與 336×336 基礎解析度下的 576 個 token 進行對比。

4. LLaVA 第 1 階段的投影器是在圖片說明文字上以語言模型損失訓練的。若完全跳過第 1 階段，直接進入第 2 階段視覺指令調校，會發生什麼現象？引用 Prismatic VLMs 消融實驗論文（arXiv:2402.07865）的結論來回答。

5. LLaVA-Instruct-150k 利用 GPT-4 搭配 COCO 文字描述合成指令資料。針對全新的特定領域（如醫療 X 光片或高解析度衛星空拍圖），請設計一個包含四個步驟的專用領域指令生成資料管線。並指出每個步驟可能遭遇的資料品質陷阱。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際意義 |
|------|----------------|------------------------|
| Projector | 「MLP 模態橋樑」 | 帶有 GELU 活化函數的雙層 MLP，負責將 ViT 特徵維度精確映射至 LLM 維度 |
| Image token | 「<image> 佔位符」 | Prompt 中的標記標籤，在進入推論前被 N 個投影後的視覺 token 就地替換 |
| Visual instruction tuning | 「LLaVA 第 2 階段」 | 在由 GPT-4 生成的（影像, 指令, 回應）三元組對話資料上進行的監督式調校 |
| Stage 1 alignment | 「投影器預訓練對齊」 | 凍結 ViT 與 LLM，僅訓練投影器在圖文描述上最小化語言模型預測損失 |
| AnyRes | 「多格切片動態解析度」 | 將高解析度影像依比例裁切為網格拼圖，並將各切片與縮圖的視覺 token 依序拼接 |
| LLaVA-Instruct | 「GPT-4 擬真合成資料」 | 巧妙利用 COCO 人工文字描述引導 GPT-4 合成的 15.8 萬組多輪指令問答資料集 |
| Vision encoder freeze | 「鎖死視覺骨幹」 | 在第 1 階段完全不更新 CLIP 權重，在第 2 階段亦經常維持凍結狀態 |
| ShareGPT4V | 「高畫質精細圖片說明」 | 利用 GPT-4V 生成的 100 萬條高密度富語意圖片說明資料集，用於更高階的對齊訓練 |
| VQA | 「視覺問答」 | 針對輸入影像進行自由形式文字提問與解答的經典核心多模態任務 |
| Prismatic VLMs | 「多模態架構消融研究」 | Karamcheti 於 2024 年發表的里程碑論文，系統性實證測試了各種投影器與資料配比 |

## Further Reading｜延伸閱讀

- [Liu et al. — Visual Instruction Tuning (arXiv:2304.08485)](https://arxiv.org/abs/2304.08485) ——LLaVA 原創奠基論文
- [Liu et al. — Improved Baselines with Visual Instruction Tuning (arXiv:2310.03744)](https://arxiv.org/abs/2310.03744) ——LLaVA-1.5 架構升級
- [Chen et al. — ShareGPT4V (arXiv:2311.12793)](https://arxiv.org/abs/2311.12793) ——高密度視覺圖片說明資料集
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865) ——視覺語言模型的設計空間消融研究
- [Li et al. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326) ——統一單圖、多圖與影片的大一統訓練範式
