# 瀏覽器 Agent 與長時程 Web 任務（Browser Agents and Long-Horizon Web Tasks）

> ChatGPT agent（2025 年 7 月）將 Operator 與深度研究（deep research）合而為一，打造出兼具瀏覽器與終端機操作能力的 agent，並在 BrowseComp 創下 68.9% 的 SOTA 紀錄。OpenAI 隨後於 2025 年 8 月 31 日關閉獨立的 Operator——這是產品層級的整併。Anthropic 對 Vercept 的收購，讓 Claude Sonnet 在 OSWorld 上的得分從不到 15% 提升至 72.5%。WebArena-Verified（ServiceNow，ICLR 2026）修復了原始 WebArena 中 11.3 個百分點的偽陰性率，並釋出了包含 258 個任務的 Hard 子集。這些數字是真實的；攻擊表面同樣真實：OpenAI 的準備度主管公開坦承，針對瀏覽器 agent 的間接 prompt 注入「並非能夠被完全修補的 bug」。2025–2026 年文獻記錄的真實攻擊案例包括：Tainted Memories（Atlas CSRF 攻擊）、HashJack（Cato Networks）以及 Perplexity Comet 中的單次點選劫持。

**Type:** Learn
**Languages:** Python (stdlib, indirect prompt-injection attack surface model)
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 01 (Long-horizon agents)
**Time:** ~45 minutes

## The Problem｜問題

瀏覽器 agent 是一種必須讀取不可信外部內容並執行具備實質後果動作的長時程 agent。agent 造訪的每一個網頁，都是非使用者所撰寫的外部輸入。網頁上的每一個表單，都是潛在的外部指令通道。2025–2026 年被披露的真實攻擊語料庫證明這絕非理論假設：Tainted Memories 允許攻擊者透過精心設計的網頁，將惡意指令深植並綁定至 agent 的持久記憶體中；HashJack 則將惡意命令隱藏在 agent 造訪的 URL 片段中；而針對 Perplexity Comet 的劫持更只需使用者進行一次單純的點選。

防禦面的局勢並不樂觀。OpenAI 的準備度主管把話說得很直白：間接 prompt 注入「並非能夠被完全修補的 bug」。這是因為該攻擊存在於 agent「讀取」與「執行」之間的邊界上——這條邊界在架構上天生模糊，模型讀取的每個 token，原則上都可能被解讀為指令。

本課點名這個攻擊表面，梳理基準測試格局（BrowseComp、OSWorld、WebArena-Verified），並模擬一個最小的間接 prompt 注入情境，讓你能在第 14 課與第 18 課中推理真實的防禦機制。

## The Concept｜核心概念

### 2026 年產品版圖一覽

**ChatGPT agent（OpenAI）。** 於 2025 年 7 月推出。將專注於網頁瀏覽的 Operator 與支援數小時長任務的 Deep Research 整合。於 2025 年 8 月 31 日終止獨立的 Operator 服務。在 BrowseComp 上締造 68.9% 的 SOTA 紀錄；並在 OSWorld 與 WebArena-Verified 上取得優異實測結果。

**Claude Sonnet + Vercept（Anthropic）。** Anthropic 收購 Vercept，聚焦於電腦操作能力。這讓 Claude Sonnet 在 OSWorld 上的得分從低於 15% 提升至 72.5%。Claude Computer Use 現在以工具 API 的形式對外提供。

**具備 Browser Use 能力的 Gemini 3 Pro（DeepMind）。** 整合 Browser Use 後提供電腦操作控制；其 FSF v3（2026 年 4 月，詳見第 20 課）專門追蹤機器學習研發領域的自主性。

**WebArena-Verified（ServiceNow，ICLR 2026）。** 修復了一個已有充分記錄的問題：原始 WebArena 存在約 11.3% 的偽陰性率（即實際上已被 agent 解決卻被誤判為失敗的任務）。Verified 版本採用人工策劃的成功判定準則重新計分，並加入了包含 258 個任務的 Hard 子集（ICLR 2026 論文，openreview.net/forum?id=94tlGxmqkN）。

### BrowseComp、OSWorld 與 WebArena 的維度對比

| 基準測試 | 衡量內容 | 時程 |
|---|---|---|
| BrowseComp | 在時間壓力下，於開放網路上找出特定事實 | 數分鐘 |
| OSWorld | Agent 操作完整桌面（滑鼠、鍵盤、shell） | 數十分鐘 |
| WebArena-Verified | 模擬網站中的交易型網頁任務 | 數分鐘 |
| Hard 子集 | 具有多頁面狀態轉換的 WebArena-Verified 任務 | 數十分鐘 |

它們衡量的是不同的能力維度。在 BrowseComp 上取得高分，意味著 agent 擅長在開放網路上檢索事實；但這不代表它能夠自主預訂一張機票。OSWorld 的得分則更貼近「它能否在我的桌面作業系統上正常工作」。WebArena-Verified 則專注於「它能否完成一個交易型業務流程」。任何正式環境的技術決策，都必須採用與真實業務任務分布相符的基準測試。

### 攻擊表面剖析

1. **間接 prompt 注入（Indirect prompt injection）。** 不可信的網頁內容中夾帶了惡意指令。agent 讀取了該內容，並執行了該指令。公開案例包括：2024 年 Kai Greshake 等人的研究、2025 年的 Tainted Memories 論文，以及 2026 年由 Cato Networks 揭露的 HashJack。
2. **URL 片段／查詢字串注入（URL fragment / query injection）。** 爬取的 URL 中的 `#fragment` 或查詢參數中夾帶了惡意命令。這些內容從未被視覺化渲染出來；但它們仍會進入 agent 的上下文視窗中。
3. **記憶體綁定攻擊（Memory-binding attacks）。** 網頁指示 agent 將特定惡意資訊寫入持久化記憶體（第 12 課探討持久化狀態）。在之後的工作階段（session）中，該記憶體會在沒有可見觸發的情況下啟動惡意酬載。
4. **針對已認證工作階段的類 CSRF 攻擊。** 屬於 Tainted Memories 範疇：agent 在某服務中處於登入狀態；攻擊者的網頁發起狀態變更請求，agent 便攜帶使用者的 Cookie 執行了該動作。
5. **單次點選劫持（One-click hijack）。** 一個外表看似無害的按鈕，背後附帶了引導 agent 進入惡意邏輯的連鎖酬載。典型代表為 Comet 類型的劫持。
6. **Agent 主機環境中的內容安全政策（CSP）破口。** 網頁渲染層與工具執行層本身都可能成為攻擊媒介；在瀏覽器 agent 中巢狀運作瀏覽器的技術堆疊，受攻擊面相當寬廣。

### 為什麼這屬於「無法被完全修補」的缺陷

這種攻擊與 agent 自身的核心能力是同構的。agent 必須讀取不可信的外部內容才能完成其工作職責。agent 所讀取的任何內容，在原理上都可能包含引導性指令。而 agent 所遵循的任何外部指令，都有可能與使用者最初的請求產生偏離。現有的所有防禦架構（信任邊界、分類器、工具白名單、針對具實質後果動作引入人工確認）都只能提高發起攻擊的代價並限縮爆炸半徑，卻無法關閉這整個漏洞類別。

這與勒布定理（第 8 課）所體現的邏輯本質相通：agent 無法向自身證明下一個 token 是安全的；它能做的，是建立一套讓不安全的 token 更容易被偵測的體系。

### 真實正式環境採用的防禦態勢

- **劃分「讀取／寫入」邊界（Read / write boundary）。** 單純的讀取本身不會產生實質外部後果。任何寫入行為（送出表單、發布內容、呼叫帶有副作用的工具），若其觸發內容來自信任邊界之外，則需要人類重新核准。
- **任務級別的工具白名單。** agent 擁有瀏覽網頁的權限；但除非該任務被明確授權，否則它沒有權限發起銀行轉帳。第 13 課將深入探討動作預算。
- **工作階段隔離（session isolation）。** 瀏覽器 agent 的工作階段僅使用最小權限範圍的憑證運作。不掛載正式環境身分認證，也不存取個人電子郵件。所有發出的 HTTP 請求日誌皆需留存，以供稽核。
- **內容淨化過濾器（Content sanitizer）。** 抓取的原始 HTML 在被串接進模型上下文之前，必須剝除已知的惡意模式與隱藏標籤。（能防禦簡單攻擊；但無法阻擋精心設計的複雜酬載。）
- **針對具實質後果動作引入人工介入（HITL）。** 遵循第 15 課探討的「先提議後確認寫入（propose-then-commit）」模式。
- **記憶體金絲雀 token（Canary tokens）。** 一旦特定記憶體項目被觸發，使用者會看到（詳見第 14 課）。

```figure
injection-boundary
```

## Use It｜實際應用

`code/main.py` 模擬了一個微型瀏覽器 agent 針對三個合成網頁的執行過程。第一個網頁是正常良性頁面；第二個網頁在可見文本中夾帶了一段直接的 prompt 注入惡意文字；第三個網頁則帶有 URL 片段注入（外觀不可見，但進入了 agent 上下文）。該程式檔案展示：(a) 天真的 agent 會做出什麼失控行為、(b) 讀取／寫入邊界能攔截什麼、(c) 內容淨化器能過濾什麼，以及 (d) 哪些複雜威脅是兩者皆會遺漏的。

## Ship It｜交付成果

`outputs/skill-browser-agent-trust-boundary.md` 能協助你為所提議的瀏覽器 agent 部署進行範圍界定：梳理其觸及的信任區域、明確其可寫入的權限邊界，以及在首次執行前必須到位的各項防禦。

## Exercises｜練習

1. 執行 `code/main.py`。指出哪一項攻擊能被內容淨化器捕獲但無法被讀取／寫入邊界攔截，又有哪一項攻擊唯有依賴讀取／寫入邊界才能遏止。

2. 擴充內容淨化器，使其能夠偵測特定類型的 HashJack 風格 URL 片段注入。在帶有正常合法片段的良性 URL 樣本上測量其偽陽性率。

3. 挑選一個你熟悉的真實瀏覽器 agent 工作流程（例如「預訂一張機票」）。列出其涉及的每一次讀取與每一次寫入操作。標註哪些寫入行為需要 HITL 確認，並說明具體原因。

4. 閱讀 WebArena-Verified 的 ICLR 2026 論文。指出原始 WebArena 在哪一類任務上的評分不可靠，並說明 Verified 子集是如何解決此問題的。

5. 為瀏覽器 agent 環境設計一套記憶體金絲雀機制。你會在何處儲存什麼樣的標記？而觸發告警的確切條件又是什麼？

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|---|---|---|
| 間接 prompt 注入 | 「有問題的網頁文字」 | agent 讀取的網頁中，不可信內容夾帶了 agent 會執行的指令 |
| Tainted Memories | 「記憶體攻擊」 | agent 將攻擊者提供的指令寫入持久記憶體；於下一個工作階段觸發 |
| HashJack | 「URL 片段攻擊」 | 隱藏在 URL 片段或查詢字串中的酬載會進入 agent 上下文，卻不會被可見地渲染 |
| 單次點選劫持 | 「有問題的按鈕」 | 可見的操作介面會帶出 agent 執行的後續酬載 |
| BrowseComp | 「網頁搜尋基準測試」 | 在開放網路上找出特定事實；時程以分鐘計 |
| OSWorld | 「桌面基準測試」 | 完整作業系統控制；多步驟的 GUI 任務 |
| WebArena-Verified | 「修正後的網頁任務基準測試」 | ServiceNow 重新計分的 WebArena，並含 Hard 子集 |
| 讀取／寫入邊界 | 「副作用閘門」 | 讀取不產生後果；若內容來自信任範圍之外，寫入需要重新核准 |

## Further Reading｜延伸閱讀

- [OpenAI — Introducing ChatGPT agent](https://openai.com/index/introducing-chatgpt-agent/) — Operator 與深度研究的深度整併；BrowseComp SOTA。
- [OpenAI — Computer-Using Agent](https://openai.com/index/computer-using-agent/) — Operator 的演進譜系及其演變為 ChatGPT agent 的底層架構。
- [Zhou et al. — WebArena](https://webarena.dev/) — 原始基準測試官方網站。
- [WebArena-Verified (OpenReview)](https://openreview.net/forum?id=94tlGxmqkN) — ICLR 2026 驗證子集修正論文。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 探討電腦操作 agent 攻擊表面的內容。
