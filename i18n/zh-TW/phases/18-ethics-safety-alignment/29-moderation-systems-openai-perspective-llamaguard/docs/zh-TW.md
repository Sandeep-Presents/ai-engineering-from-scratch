# 內容審查系統——OpenAI、Perspective、Llama Guard（Moderation Systems — OpenAI, Perspective, Llama Guard）

> 正式環境中的內容審查系統，是將第 12 至 16 節定義的安全策略落實至線上生產的第一道防線。**OpenAI 內容審查 API**：以 GPT-4o 為基底打造的 `omni-moderation-latest`（2024 年發布）能在單次網路呼叫中同時審查文字與影像；在多語言測試集上的表現比前代提升 42%；回應資料結構回傳 13 項布林值危害類別——騷擾、帶威脅的騷擾、仇恨言論、帶威脅的仇恨言論、違法行為、暴力違法行為、自殘、自殘意圖、自殘指引、露骨色情、涉及未成年人的色情、暴力、血腥暴力；對絕大多數開發者完全免費開放。多層縱深防禦架構：前置輸入審查（生成前過濾）、後置輸出審查（交付前過濾）與業務自定義審查（領域規則）。在單一層次內部並行併發多個分類器可掩蓋網路延遲；在觸發安全警報時回傳預設的暫用回應。**Llama Guard 3/4**（第 16 節）：涵蓋 MLCommons 14 項危害大類、程式碼直譯器濫用檢測，支援 8 種語言（v3），且 v4 支援多張影像輸入。**Perspective API**（Google Jigsaw 出品）：早於「LLM 充當審查員」浪潮問世（2020 年前）的傳統毒性評分系統；主打單一毒性（TOXICITY）基準分數並附帶極端毒性、侮辱、褻瀆等子維度；是學術界內容審查研究的經典對照基準。架構退役變遷：Azure Content Moderator 於 2024 年 2 月正式宣告棄用，將於 2027 年 2 月徹底除役，全面由基於大模型的 Azure AI Content Safety 取代。

**Type:** Build
**Languages:** Python (stdlib, three-layer moderation harness)
**Prerequisites:** Phase 18 · 16 (Llama Guard / Garak / PyRIT)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 深入描述 OpenAI 內容審查 API 的分類體系，並剖析其與 Llama Guard 3 的 MLCommons 14 大類別之間的異同與映射關係。
- 掌握三層審查防護模式（輸入審查、輸出審查、自定義業務審查），並為每一層指出一種失效模式。
- 理解 Perspective API 作為前大模型時代基準線的歷史地位，以及為何當代學術評測依然廣泛使用它。
- 掌握微軟 Azure 內容審查服務的官方棄用與退役時間表。

## The Problem｜問題

第 12 至 16 節系統性梳理了各類攻擊向量與紅隊工具鏈。而第 29 節則聚焦於終端使用者直接碰觸產品介面的最前端：真實正式環境中的即時內容審查體系。三層防護縱深架構是 2026 年工業級落地的標準預設。

## The Concept｜核心概念

### OpenAI 內容審查 API

`omni-moderation-latest`（2024 年發布）。以 GPT-4o 作為後台驅動核心。支援在單次 API 請求中並行對文字與圖片實施安全審查。對絕大多數 API 開發者完全免費提供。

官方回應 Schema 中的 13 項布林值類別：
- harassment（騷擾）、harassment/threatening（帶威脅的騷擾）
- hate（仇恨言論）、hate/threatening（帶威脅的仇恨言論）
- self-harm（自殘）、self-harm/intent（自殘意圖）、self-harm/instructions（自殘指引教學）
- sexual（露骨色情）、sexual/minors（涉及未成年人的性內容）
- violence（暴力）、violence/graphic（血腥暴力描寫）
- illicit（違法犯罪）、illicit/violent（暴力違法犯罪）

多模態圖片審查支援 `violence`、`self-harm` 與 `sexual`，但不支援 `sexual/minors`；其餘類別為純文字審查。

在 `code/main.py` 的教學演練程式碼中，為了教學結構的清晰性，我們將 `/threatening`、`/intent`、`/instructions` 與 `/graphic` 等子類別折疊合併至其父類別中；正式環境生產程式碼則應當完整接收全部 13 項明細。

在多語言測試集上的表現相較於前代端點提升了 42%。API 也會回傳每個類別的分數；應用程式可自行設定閾值。

### Llama Guard 3/4

詳見第 18 課第 16 節。基於 MLCommons AILuminate 的 14 項標準危害大類（與 OpenAI 的 13 項布林值類別在劃分維度上略有不同）。v3 支援 8 種主流語言；2025 年 4 月發布的 Llama Guard 4 則是 12B 原生多模態大模型。

兩套體系高度互補但邊界迥異。例如 OpenAI 將各類犯罪統包於「illicit」單一大類中；而 Llama Guard 則嚴格細分為「暴力犯罪」與「非暴力犯罪」。企業應當依據自身法務與合規偏好選用對應的分類器。

### Perspective API（Google Jigsaw）

早於大模型充當審查員浪潮的傳統毒性評分系統（2020 年前建立）。核心分類維度：TOXICITY（一般毒性）、SEVERE_TOXICITY（極端毒性）、INSULT（侮辱謾罵）、PROFANITY（髒話褻瀆）、THREAT（威脅人身安全）、IDENTITY_ATTACK（身分偏見攻擊）。以單一的主毒性標量得分作為核心，附帶各子維度的細化分數。

被廣泛用作內容審查學術研究的權威基準線，因為其 API 表現極其穩定、文件高度透明，且累積了長達數年的海量校準資料。對於現代複雜大模型業務而言，Llama Guard 或 OpenAI Moderation 通常能提供更具語義深度的上下文防護。

### 三層縱深防禦架構（The three-layer pattern）

1. **前置輸入審查（Input moderation）**。在將 Prompt 送入大模型生成之前先行審查。一旦命中違規直接拒絕。延遲開銷：一次分類器網路請求。
2. **後置輸出審查（Output moderation）**。在大模型吐出文字之後、將回應串流給使用者之前實施審查。一旦命中違規，將文字替換為標準的拒絕模板。延遲開銷：大模型生成完畢後的一次分類器請求。
3. **自定義業務審查（Custom moderation）**。特定垂直領域的私有商業規則（正規表示式敏感詞、特定行業白名單、企業專屬合規邊界）。可靈活掛載於輸入端或輸出端。

前置輸入審查必須在生成前完成，後置輸出審查則在生成後執行；自定義審查可在輸入端或輸出端執行。不過，在單一層次內部，多個分類器（例如同時並行呼叫 OpenAI Moderation + Llama Guard + Perspective）可以完全非同步並行執行，從而將各分類器的延遲完全重疊掩蓋。作為可選最佳化，可在輸入審查完成期間顯示佔位回應（「請稍候，正在進行內容審查……」），並延後 token-1 串流。標記後的處理方式可設定為拒絕、清理或升級至人工審核。

### 依賴單一層次的經典失效模式

- **僅部署輸入審查**：無法防範大模型自身的幻覺輸出（第 12 至 14 節的編碼攻擊會繞過輸入分類器）。
- **僅部署輸出審查**：允許任何惡意 Prompt 毫無阻礙地打入大模型深處；不僅平白燃燒昂貴的 GPU 推論算力，且會向攻擊者暴露內部推理。
- **僅部署自定義正則規則**：跨語義範疇的防禦韌性極差；硬編碼的正規表示式極易被同義詞替換或空格插入輕易繞過。

分層是預設做法。

### 微軟 Azure 服務退役公告

Azure Content Moderator：已於 2024 年 2 月正式宣告棄用（Deprecated），將於 2027 年 2 月徹底關停除役（Retired）。全面由基於大模型技術打造、深度整合進 Azure OpenAI 的 Azure AI Content Safety 取代。這項遷移是所有基於微軟雲端體系建構的推論架構在 2024 至 2027 年間的必做功課。

### 該研究在第 18 階段中的宏觀座標

第 16 節探討紅隊演練情境下的審查工具；第 29 節落地正式環境對外服務的審查架構；第 30 節將作為全階段大收官，為讀者呈現全球前沿大模型在軍民兩用致命能力維度的最新實證證據鏈。

```figure
an-moderation-layers
```

## Use It｜實際應用

`code/main.py` 實作了一套完整的微型三層審查架構：輸入審查器（基於關鍵字與分類特徵評分）、輸出審查器（在生成端執行相同的安全校驗），以及自定義業務審查器（領域私有正則規則）。你可以將多種輸入注入該流水線，清晰觀察每一層防線究竟分別攔截了哪些特定攻擊。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-moderation-stack.md`。輸入一套大模型線上業務產品規格說明書，該 Skill 將為你建議三層審查技術堆疊配置：輸入端配置何種分類器、輸出端配置何種防護盾、需要補齊哪些領域專屬規則，以及邊界案例應採用哪種判定器。

## Exercises｜練習

1. 執行 `code/main.py`。分別將良性文字、處於灰色邊界的模糊文字以及明確惡意的攻擊文字送入管線。記錄並呈報每一條測試樣本具體是在哪一層防線被觸發攔截。
2. 為該微型架構擴充一個 Perspective API 風格的毒性評分模組。在特定類別上對比該分數與常規分類器得分在閾值設定上的敏感度差異。
3. 仔細研讀 OpenAI 內容審查 API 文件與 Llama Guard 3 的危害類別清單。嘗試將 OpenAI 的 13 項布林類別對應至最接近的 Llama Guard 類別。指出其中哪三項類別在語義邊界上完全無法清晰對齊。
4. 為一款企業級程式碼輔助助手（如 GitHub Copilot）量身設計一套三層審查技術堆疊。明確指出哪些常規審查類別在此高度相關、哪些類別無關緊要，並起草三條專屬於軟體工程的自定義業務審查規則。
5. 微軟 Azure Content Moderator 將於 2027 年 2 月徹底除役。為一家基於該服務維運的大型跨國企業起草一份平滑遷移至 Azure AI Content Safety 的技術路線圖。標定出整個遷移過程中風險最高的核心環節。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| OpenAI Moderation | 「omni-moderation-latest」 | 基於 GPT-4o 的 13 類別文字分類器，可處理文字並支援部分多模態內容 |
| Perspective API | 「Google Jigsaw 毒性評分」 | LLM 出現前的毒性評分基準 |
| Llama Guard | 「MLCommons 14 類別」 | Meta 的危害分類器（v3：8B 文字版、支援 8 種語言；v4：12B 多模態） |
| Input moderation | 「生成前過濾器」 | 呼叫模型前，對使用者 prompt 執行分類的分類器 |
| Output moderation | 「生成後過濾器」 | 交付前，對模型輸出執行分類的分類器 |
| Custom moderation | 「領域規則」 | 依部署情境設定的規則（regex、允許清單、策略） |
| Layered moderation | 「全部三層」 | 正式環境的標準部署模式 |

## Further Reading｜延伸閱讀

- [OpenAI Moderation API docs](https://platform.openai.com/docs/api-reference/moderations) — omni-moderation 官方端點技術文件。
- [Meta PurpleLlama + Llama Guard](https://github.com/meta-llama/PurpleLlama) — Llama Guard 開源儲存庫與權威模型。
- [Google Jigsaw Perspective API](https://perspectiveapi.com/) — 毒性評分系統官方主頁。
- [Azure AI Content Safety](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/) — 微軟 Azure 新一代內容安全服務。
