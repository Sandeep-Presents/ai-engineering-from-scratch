# 失效模式：Agent 為何會崩潰

> MASFT（柏克萊，2025 年）將多 Agent 系統的 14 種失效模式歸納為 3 大類別。微軟分類白皮書詳盡記錄了既有 AI 缺陷在 Agentic 自主環境下如何被放大。業界一線實戰資料高度收斂於五大反覆出現的典型模式：虛構動作、範疇蔓延、連鎖瀑布失效、脈絡遺忘與工具誤用。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 05 (Self-Refine and CRITIC), Phase 14 · 24 (Observability)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 指出 MASFT 的三大失效類別，以及每個類別中至少四種具體的失效模式。
- 深入解釋為何 Agentic 自主智能架構會顯著放大既有的 AI 缺陷（如偏見、幻覺（hallucination））。
- 掌握業界高頻發生的五大核心失效模式及其對應的工程緩解策略。
- 以純 Python 標準函式庫實作一套自動化偵測器，能為 Agent 執行追蹤日誌標註失效模式標籤。

## The Problem｜問題

許多團隊發布的 Agent 在 90% 的 Trace 上運作正常。然而剩下的 10% 失敗絕非隨機雜訊——它們高度集中於少數幾類反覆重現的結構性失效中。一旦你能為這些失效命名，便能針對性地建立監控告警並動手修復。

## The Concept｜核心概念

### MASFT（柏克萊，arXiv:2503.13657）

多 Agent 系統失效分類法（Multi-Agent System Failure Taxonomy）。將 14 種失效模式聚合為 3 大核心類別。標註人員之間的 Cohen's Kappa 一致性係數高達 0.88——證明這些失效類別可被可靠地區分。

核心論點：**這些失效是多 Agent 系統的根本設計缺陷，而非透過更好的基礎模型就能修復的 LLM 限制。**

### 微軟 Agentic AI 系統失效模式分類體系

- 既有的 AI 缺陷（偏見、幻覺、資料洩漏）在自主 Agent 環境下會被放大。
- 自主性引發的全新系統級失效：大規模非預期動作、工具誤用、任務目標漂移。
- 該白皮書是評估 Agentic 產品風險的風險登記冊。

### Agentic AI 故障特徵化研究（arXiv:2603.06847）

- 系統失效主要源自編排協同調度、內部狀態演進，以及與外部環境的動態互動。
- 絕非單純一句「程式碼有 Bug」或「模型輸出差」就能概括。

### 大型語言模型 Agent 幻覺（hallucination）研究綜述（arXiv:2509.18970）

兩大核心表象：

1. **指令遵循偏離（Instruction-following Deviation）**：Agent 未遵循系統 Prompt 的約束。
2. **長程脈絡誤用（Long-range Contextual Misuse）**：Agent 遺忘或錯誤套用了前幾次回合所建立的上下文事實。

子意圖執行錯誤：遺漏步驟（Omission）、冗餘重複步驟（Redundancy）、步驟順序錯位（Disorder）。

### 業界一線五大高頻失效模式

綜合 Arize、Galileo、NimbleBrain 等機構在 2024–2026 年的實戰調研報告，失效高度聚焦於：

1. **虛構動作（Hallucinated actions）**：Agent 呼叫根本不存在的虛構工具，或憑空捏造參數。
2. **範疇蔓延（Scope creep）**：Agent 擅自擴展任務範圍，做出超出使用者請求的過度操作（擅自多開 PR、亂發額外郵件）。
3. **連鎖瀑布失效（Cascading errors）**：一個前置錯誤會引發下游的連鎖效應。例如幻覺出一個不存在的幽靈 SKU，觸發了後續四次下游 API 呼叫，最終演變為跨系統事件。
4. **脈絡遺忘（Context loss）**：在長路徑任務中，隨時間推移遺忘了最初幾次回合所定義的關鍵約束。
5. **工具誤用（Tool misuse）**：呼叫了正確的工具卻傳入錯誤的參數，或呼叫了完全錯誤的工具。

連鎖瀑布失效最為致命。Agent 難以分辨「我這次呼叫失敗了」與「該任務在客觀上不可行」，往往會在遇到 HTTP 400 報錯時產生虛假成功的幻覺，宣告任務已完成以讓迴圈閉合。

### 緩解之道：步步設防的驗收關卡

在推論鏈的每一步皆設定自動化驗證關卡，對照環境狀態核實事實錨定。具體落地：

- 逐步驟安全分類器（第 21 課）；
- 工具呼叫參數二次防禦驗證（第 06 課）；
- 將外部檢索取得的內容與已知事實進行交叉對比驗證（第 05 課——CRITIC）；
- 透過重新探測環境狀態以戳破虛假成功幻覺（例如：檢查檔案是否真的被成功建立？）。

### 監控實踐中的常見盲區

- **僅僅監控系統崩潰 Crash**：絕大多數 Agent 失效產出的輸出外觀看似正常且語言流暢。必須深入實施內容層級的深層檢驗。
- **缺乏基準線 Baseline**：行為漂移偵測必須依據已知正常的歷史基準線；否則你根本無從斷言「系統正在變糟」。
- **警報疲勞過度發送**：每次偶發失敗皆發送即時呼叫器警報。必須對異常實施聚合分群與頻率限制。

```figure
failure-cascade
```

## Build It｜動手實作

`code/main.py` 以純 Python 標準函式庫實作了一套失效模式標註器：

- 覆蓋五大核心模式的合成追蹤資料集；
- 針對每種模式的特徵偵測函式（匹配工具呼叫特徵、輸出異常與重複動作模式）；
- 為每條 Trace 打上失效標籤並匯總分布報表的標註器。

執行實驗：

```
python3 code/main.py
```

輸出會呈現逐 Trace 的標籤與全域模式分布，是 Phoenix 追蹤鏈分群（Trace clustering）功能的低成本重現。

## Use It｜實際應用

- **Phoenix**：正式環境行為漂移分群與異常偵測（第 24 課）。
- **Langfuse**：工作階段重播與人工審查標註。
- **自建偵測器**：針對你的垂直業務領域特徵，捕捉通用平台無法識別的私有失效模式。

## Ship It｜交付成果

`outputs/skill-failure-detector.md` 能為特定業務領域產出專屬的失效模式偵測器，並掛載至追蹤儲存庫中。

## Exercises｜練習

1. 為系統新增「虛假成功幻覺」偵測器：Agent 回傳成功訊息，但底層目標狀態未發生改變。
2. 為你自家產品收集的 100 條真實 Trace 進行標註。哪種模式佔據主導地位？修復該問題的工程成本如何？
3. 實作「連鎖級聯半徑（Cascade radius）」量測指標：當第 N 步發生故障時，精確計算其向後污染了多少個下游步驟。
4. 研讀 MASFT 論文中的 14 種失效模式。挑選與你業務最相關的三種，為其撰寫專屬偵測器。
5. 將偵測器整合進 CI 自動化管線中：若有 >=5% 的 Trace 命中特定失效模式，即阻斷建置。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| MASFT | 「多 Agent 系統失效分類法」 | 柏克萊提出的 14 種多 Agent 失效模式分類體系 |
| Cascading error | 「連鎖瀑布失效」 | 早期單一錯誤在後續 N 個步驟中層層放大蔓延 |
| Context loss | 「遺忘前置約束」 | 長路徑多回合任務中，遺失了早期回合所定義的關鍵事實 |
| Tool misuse | 「工具呼叫錯誤」 | 呼叫了合法工具卻傳入錯誤參數，或呼叫了完全錯誤的工具 |
| Success hallucination | 「虛假完成幻覺」 | Agent 在遭遇 HTTP 400 等報錯時，在狀態未改變下自稱成功 |
| Scope creep | 「越權範疇蔓延」 | Agent 自作主張執行超出使用者要求的操作 |
| Instruction-following deviation | 「指令偏離違規」 | 忽略系統 Prompt 或使用者設定的約束 |
| Sub-intention errors | 「規劃步驟缺陷」 | 規劃執行過程中的遺漏步驟、多餘重複或執行順序錯位 |

## Further Reading｜延伸閱讀

- [Cemri et al., MASFT (arXiv:2503.13657)](https://arxiv.org/abs/2503.13657) ——14 種多 Agent 失效模式論文
- [Microsoft, Taxonomy of Failure Mode in Agentic AI Systems](https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/microsoft/final/en-us/microsoft-brand/documents/Taxonomy-of-Failure-Mode-in-Agentic-AI-Systems-Whitepaper.pdf) ——微軟風險登記白皮書
- [Arize Phoenix](https://docs.arize.com/phoenix) ——行為漂移分群實踐
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) ——何時較簡單的模式能完全避開失效模式
