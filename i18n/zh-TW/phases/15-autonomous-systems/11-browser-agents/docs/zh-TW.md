# 瀏覽器 Agent 與長時程 Web 任務（Browser Agents and Long-Horizon Web Tasks）

> ChatGPT agent（2025 年 7 月）將 Operator 與深度研究（deep research）合而為一，打造出兼具瀏覽器與終端機操作能力的 agent，並在 BrowseComp 創下 68.9% 的 SOTA 紀錄。OpenAI 隨後於 2025 年 8 月 31 日正式關閉獨立的 Operator——這是在產品層級進行的深度整併。Anthropic 對 Vercept 的收購，讓 Claude Sonnet 在 OSWorld 上的得分從不到 15% 飆升至 72.5%。WebArena-Verified（ServiceNow，ICLR 2026）修復了原始 WebArena 中高達 11.3 個百分點的偽陰性率，並釋出了包含 258 個任務的 Hard 子集。這些亮眼數字是真實的；然而伴隨而來的攻擊表面也是不容忽視的殘酷現實：OpenAI 的準備度主管公開坦承，針對瀏覽器 agent 的間接 prompt 注入「並非能夠被完全修補的 bug」。2025–2026 年文獻記錄的真實攻擊案例包括：Tainted Memories（Atlas CSRF 攻擊）、HashJack（Cato Networks）以及 Perplexity Comet 中的單次點選劫持。

**Type:** Learn
**Languages:** Python (stdlib, indirect prompt-injection attack surface model)
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 01 (Long-horizon agents)
**Time:** ~45 minutes

## The Problem｜問題

瀏覽器 agent 是一種必須讀取不可信外部內容並執行具備實質後果動作的長時程 agent。agent 造訪的每一個網頁，都是非使用者所撰寫的外部輸入。網頁上的每一個表單，都是潛在的外部指令通道。2025–2026 年被披露的真實攻擊語料庫證明這絕非理論假設：Tainted Memories 允許攻擊者透過精心設計的網頁，將惡意指令深植並綁定至 agent 的持久記憶體中；HashJack 則將惡意命令隱藏在 agent 造訪的 URL 片段中；而針對 Perplexity Comet 的劫持更只需使用者進行一次單純的點選。

防禦陣營所面臨的局勢極其嚴峻。OpenAI 的準備度主管直接道出了殘酷的真相：間接 prompt 注入「不是一個可以被徹底修補的 bug」。這是因為該攻擊深植於 agent「讀取」與「執行」之間的架構邊界上——在底層架構上，這條界線天生是模糊不清的，模型讀取的每一個 token，在原理上都可能被解讀為一條可執行的指令。

本課將全面剖析這個攻擊表面，梳理權威基準測試格局（BrowseComp、OSWorld、WebArena-Verified），並模擬最小可行間接 prompt 注入情境，以便你在第 14 課與第 18 課中能夠針對真實防禦機制進行理性架構推演。

## The Concept｜核心概念

### 2026 年產品版圖一覽

**ChatGPT agent（OpenAI）。** 於 2025 年 7 月正式推出。將專注於網頁瀏覽的 Operator 與支援數小時長任務的 Deep Research 深度整合。於 2025 年 8 月 31 日正式終止獨立的 Operator 服務。在 BrowseComp 上締造 68.9% 的 SOTA 紀錄；並在 OSWorld 與 WebArena-Verified 上取得優異實測結果。

**Claude Sonnet + Vercept（Anthropic）。** Anthropic 收購 Vercept 旨在全面攻克電腦操作能力。這讓 Claude Sonnet 在 OSWorld 上的得分從低於 15% 躍升至 72.5%。Claude Computer Use 現在以正式的工具 API 形式對外提供。

**具備 Browser Use 能力的 Gemini 3 Pro（DeepMind）。** 深度整合 Browser Use 提供全方位的電腦操作控制能力；其 FSF v3（2026 年 4 月，詳見第 20 課）專門鎖定並追蹤機器學習研發領域的極限自主性。

**WebArena-Verified（ServiceNow，ICLR 2026）。** 徹底修復了學界公認的歷史瑕疵：原始 WebArena 存在約 11.3% 的偽陰性率（即實際上已被 agent 解決卻被誤判為失敗的任務）。Verified 版本採用由人類專家精心策劃的成功判定準則重新計分，並加入了包含 258 個任務的 Hard 子集（ICLR 2026 論文，openreview.net/forum?id=94tlGxmqkN）。

### BrowseComp、OSWorld 與 WebArena 的維度對比

| Benchmark | What it measures | Horizon |
|---|---|---|
| BrowseComp | Finding specific facts on the open web under time pressure | minutes |
| OSWorld | Agent operating a full desktop (mouse, keyboard, shell) | tens of minutes |
| WebArena-Verified | Transactional web tasks in simulated sites | minutes |
| Hard subset | WebArena-Verified tasks with multi-page state transitions | tens of minutes |

它們衡量的是截然不同的能力維度。在 BrowseComp 上取得高分，意味著 agent 擅長在開放網路上精準檢索事實；但這絕不代表它能夠自主預訂一張機票。OSWorld 的得分則更貼近「它能否在我的桌面作業系統上正常工作」。WebArena-Verified 則專注於「它能否完整跑通一個交易型業務流程」。任何正式環境的技術決策，都必須精準對齊符合真實業務任務分布的基準測試。

### 攻擊表面剖析

1. **間接 Prompt 注入（Indirect prompt injection）。** 不可信的網頁內容中夾帶了惡意指令。agent 讀取了該內容。agent 順從地執行了該指令。公開知名案例包括：2024 年 Kai Greshake 等人的先驅研究、2025 年的 Tainted Memories 論文，以及 2026 年由 Cato Networks 揭露的 HashJack。
2. **URL 片段／查詢字串注入（URL fragment / query injection）。** 爬取的 URL 中的 `#fragment` 或查詢參數中夾帶了惡意命令。這些內容從未被視覺化渲染出來；但它們卻完完整整地進入了 agent 的上下文視窗中。
3. **記憶體綁定攻擊（Memory-binding attacks）。** 網頁指示 agent 將特定惡意資訊寫入持久化記憶體（第 12 課探討持久化狀態）。在未來的下一個 session 中，該記憶體會在毫無外部徵兆的情況下觸發惡意酬載。
4. **針對已認證 Session 的類 CSRF 攻擊。** 屬於 Tainted Memories 範疇：agent 在某服務中處於登入狀態；攻擊者的網頁發起狀態變更請求，agent 便攜帶著使用者的真實 Cookie 執行了該動作。
5. **單次點選劫持（One-click hijack）。** 一個外表看似完全無害的按鈕，背後附帶了引導 agent 進入惡意邏輯的連鎖酬載。典型代表為 Comet 類型的劫持。
6. **Agent 主機環境中的內容安全政策（CSP）破口。** 網頁渲染層與工具執行層本身都可能成為攻擊媒介；在瀏覽器 agent 中巢狀運作瀏覽器的技術堆疊具有極寬廣的受攻擊面。

### 為什麼這屬於「無法被完全修補」的缺陷

這種攻擊與 agent 自身的核心能力是完全同構的。agent 必須讀取不可信的外部內容才能完成其工作職責。agent 所讀取的任何內容，在原理上都可能包含引導性指令。而 agent 所遵循的任何外部指令，都有可能與使用者最初的真實請求產生嚴重偏離。現有的所有防禦架構（信任邊界、分類器、工具白名單、針對具實質後果動作引入人工確認）都只能提高發起攻擊的代價並限縮爆炸半徑，卻無法在根本上徹底消滅這整個漏洞類別。

這與勒布定理（第 8 課）所體現的邏輯本質完全相通：agent 無法向自身證明下一個 token 是絕對安全的；它唯一能做的，是建立一套讓不安全 token 展現出更強烈可偵測特徵的縱深防禦體系。

### 真實正式環境採用的防禦態勢

- **嚴格劃分「讀取／寫入」邊界（Read / write boundary）。** 單純的讀取絕不允許產生任何實質外部後果。任何寫入行為（送出表單、發布內容、呼叫帶有副作用的工具），若其觸發內容源自於信任邊界之外，則必須強制要求人類進行即時確認。
- **任務級別的工具白名單。** agent 擁有瀏覽網頁的權限；但除非該任務被明確授權，否則它絕對沒有權限發起銀行轉帳。第 13 課將深入探討動作預算。
- **嚴密的 Session 隔離。** 瀏覽器 agent 的 session 僅使用最小權限範圍的憑證運作。嚴禁掛載正式環境身分認證，嚴禁存取個人電子郵件。所有發出的 HTTP 請求日誌皆必須完整留存以供事後稽核。
- **內容淨化過濾器（Content sanitizer）。** 抓取的原始 HTML 在被串接進模型上下文之前，必須徹底剝除已知的惡意模式與隱藏標籤。（能防禦簡單攻擊；但無法阻擋精心設計的複雜攻擊語句。）
- **針對具實質後果動作引入人工介入（HITL）。** 嚴格遵循第 15 課探討的「先提議後確認寫入（propose-then-commit）」模式。
- **記憶體金絲雀 Token（Canary tokens）。** 一旦特定記憶體項目被喚醒並執行，使用者必須能在介面上即時收到明確警示（詳見第 14 課）。

```figure
injection-boundary
```

## Use It｜實際應用

`code/main.py` 模擬了一個微型瀏覽器 agent 針對三個合成網頁的執行過程。第一個網頁是正常良性頁面；第二個網頁在可見文本中夾帶了直接 prompt 注入惡意程式碼；第三個網頁則帶有 URL 片段注入（外觀不可見，但進入了 agent 上下文）。該腳本具體展示：(a) 毫無防備的單純 agent 會做出什麼失控行為、(b) 讀取／寫入邊界能精準攔截什麼、(c) 內容淨化器能過濾什麼，以及 (d) 哪些複雜威脅是兩者皆會遺漏的。

## Ship It｜交付成果

`outputs/skill-browser-agent-trust-boundary.md` 能協助你為所提議的瀏覽器 agent 部署進行完整的範圍界定：精準梳理其觸及的信任區域、明確授權其寫入的權限邊界，以及在首次正式執行前必須配置到位的各項防禦清單。

## Exercises｜練習

1. 執行 `code/main.py`。指出哪一項攻擊能被內容淨化器捕獲但無法被讀寫邊界攔截，又有哪一項攻擊唯有依賴讀寫邊界才能成功遏止。

2. 擴充內容淨化器，使其能夠偵測特定類型的 HashJack 風格 URL 片段注入。在帶有正常合法片段的良性 URL 樣本上測量其偽陽性率。

3. 挑選一個你熟悉的真實瀏覽器 agent 工作流程（例如「預訂一張機票」）。列出其涉及的每一次讀取與每一次寫入操作。精確標註哪些寫入行為必須強制引入 HITL 確認及其具體原因。

4. 閱讀 WebArena-Verified 的 ICLR 2026 論文。指出原始 WebArena 在哪一類任務上的評分極不可靠，並說明 Verified 子集是如何解決此問題的。

5. 為瀏覽器 agent 環境設計一套記憶體金絲雀機制。你會在何處儲存什麼樣的標記？而觸發告警的確切條件又是什麼？

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|---|---|---|
| Indirect prompt injection | "Bad page text" | Untrusted content in a page the agent reads contains instructions the agent executes |
| Tainted Memories | "Memory attack" | Agent writes an attacker-supplied instruction to durable memory; triggered next session |
| HashJack | "URL fragment attack" | Payload hidden in URL fragment / query string is in the agent's context but not visibly rendered |
| One-click hijack | "Bad button" | Visible affordance rides a follow-on payload the agent executes |
| BrowseComp | "Web search benchmark" | Finding specific facts on the open web; minute-scale horizon |
| OSWorld | "Desktop benchmark" | Full OS control; multi-step GUI tasks |
| WebArena-Verified | "Fixed web-task benchmark" | ServiceNow's regraded WebArena with Hard subset |
| Read/write boundary | "Side-effect gate" | Reading never consequential; writing requires fresh approval if content is out-of-trust |

## Further Reading｜延伸閱讀

- [OpenAI — Introducing ChatGPT agent](https://openai.com/index/introducing-chatgpt-agent/) — Operator 與深度研究的深度整併；BrowseComp SOTA。
- [OpenAI — Computer-Using Agent](https://openai.com/index/computer-using-agent/) — Operator 的演進譜系及其演變為 ChatGPT agent 的底層架構。
- [Zhou et al. — WebArena](https://webarena.dev/) — 原始基準測試官方網站。
- [WebArena-Verified (OpenReview)](https://openreview.net/forum?id=94tlGxmqkN) — ICLR 2026 驗證子集修正論文。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 深入探討電腦操作 agent 攻擊表面的權威分析。
