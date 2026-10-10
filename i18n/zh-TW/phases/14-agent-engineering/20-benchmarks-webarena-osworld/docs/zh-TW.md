# 基準評測：WebArena 與 OSWorld

> WebArena 橫跨四套本機私有部署的 Web 應用程式評測網頁 Agent 能力；OSWorld 則橫跨 Ubuntu、Windows 與 macOS 實體作業系統評測桌面端操作能力。在發布之初（2023–2024 年），兩者皆揭示了頂尖 Agent 與人類專家之間的巨大鴻溝。如今差距正在迅速縮小，然而底層的核心失效模式卻從未改變。

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 19 (SWE-bench, GAIA)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 描述 WebArena 的四套本機私有部署應用程式，以及為何「基於實體執行的評測（Execution-based evaluation）」至關重要。
- 深入解釋為何 OSWorld 堅持採用真實作業系統的 1920×1080 螢幕截圖，而非單純依賴無障礙輔助 API（Accessibility APIs）。
- 指出 OSWorld 的兩大核心失效模式：GUI 像素錨定定位（GUI grounding）與系統操作經驗知識（Operational knowledge）。
- 總結 OSWorld-G 與 OSWorld-Human 在基礎基準之上所額外賦予的關鍵評測維度。

## The Problem｜問題

全能通用型 Agent 能夠順暢呼叫工具。然而，它們能否自主操控瀏覽器跨越 20 次點選順利完成電商結帳？它們能否僅憑鍵盤與滑鼠，在實體 Linux 主機上完成一項複雜的系統配置？這正是 WebArena 與 OSWorld 致力於解答的核心命題。

## The Concept｜核心概念

### WebArena（Zhou 等人，ICLR 2024）

- 涵蓋橫跨四套本機私有部署 Web 應用的 812 個長路徑任務：電商購物網站、技術論壇、類 GitLab 的開發協同工具、企業 CMS 內容管理系統。
- 配套輔助工具：地圖、計算機、便籤記事本。
- 評測採用基於 Gym API 的實體執行驗收——訂單是否確實被建立？Issue 是否確實被關閉？CMS 頁面是否確實被更新？
- 發布時的實測結果：最強的 GPT-4 Agent 成功率僅為 14.41%，而人類專家高達 78.24%。

私有本機部署的架構設定至關重要——該基準完全免於因外部真實網站動態改版而引發的偶發波動（Flakiness），所有目標應用程式皆版本鎖定且百分之百可重現。

### 延伸進階評測

- **VisualWebArena**：專門考驗視覺錨定的進階任務，成敗取決於對圖片內容的理解（螢幕截圖作為一等公民觀察資料）。
- **TheAgentCompany**（2024 年 12 月）：追加了 Terminal 命令列與程式撰寫環境，更逼近真實工程師的遠端工作場景。

### OSWorld（Xie 等人，NeurIPS 2024）

- 橫跨 Ubuntu、Windows、macOS 三大作業系統的 369 個真實電腦操作任務。
- 透過自由形式的鍵盤與滑鼠完全控制真實桌面應用程式。
- 以 1920×1080 的原始螢幕截圖作為唯一的視覺觀察輸入。
- 發布時的實測結果：最強模型成功率僅為 12.24%，而人類專家高達 72.36%。

### 兩大核心失效模式

1. **GUI 像素錨定定位（GUI grounding）**：像素到介面元素的對映。模型在 1920×1080 的高解析度畫布中，難以穩定且精準地定位微小的 UI 元件座標。
2. **系統操作經驗知識（Operational knowledge）**：某項特定設定究竟藏在哪個子選單、對應哪組鍵盤快捷鍵、應當開啟哪個系統偏好設定面板。這是人類在多年操作中自然沉澱的長尾經驗知識。

### 後續重要衍生研究

- **OSWorld-G**：包含 564 個樣本的專門錨定評測集 + Jedi 訓練集。將「介面定位」與「邏輯規劃」兩大能力徹底解耦，便於分別獨立度量。
- **OSWorld-Human**：由人工專家精心錄製的黃金標準動作軌跡（Gold Trajectories）。實測揭示了頂尖 Agent 往往耗費比人類多 1.4 至 2.7 倍的多餘步驟（暴露了嚴重的軌跡執行效率差距）。

### 為何這對工程實踐至關重要

Claude Computer Use、OpenAI CUA 以及 Gemini 2.5 Computer Use（第 21 課），全數是在與 WebArena 及 OSWorld 形態高度相似的合成負載上訓練出來的。這兩大基準評測正是產業界演進的靶心；而各大廠商發布的生產級模型則是交出的具體答卷。

### 評測實踐中的常見盲區

- **僅依賴截圖評測的狹隘性**：OSWorld 完全由截圖驅動；若將依賴 DOM 樹或無障礙 API 的 Agent 放到 OSWorld 上評測，將徹底錯失其最核心的視覺定位挑戰。
- **忽視軌跡執行步數**：僅看最終成功率，會徹底掩蓋 OSWorld-Human 所揭露的 1.4 到 2.7 倍步驟膨脹浪費。
- **私有部署應用版本漂移**：WebArena 的各項應用鎖定了特定版本；若在未經重新驗證的情況下擅自升級底層應用版本，將徹底摧毀橫向評測的基準可比性。

```figure
ae-agent-human-gap
```

## Build It｜動手實作

`code/main.py` 以純 Python 標準函式庫實作了一套極簡的 Web Agent 測試控端：

- 極簡「電商購物應用」狀態機：包含 list_items、add_to_cart、checkout 等狀態；
- 3 個具體任務的黃金標準軌跡（Gold trajectories）；
- 嘗試執行各項任務的腳本化 Agent；
- 基於實體執行的驗收器（核驗最終狀態）與軌跡執行效率指標（實體步驟數 / 黃金步驟數）。

運行實驗：

```
python3 code/main.py
```

輸出會展示：各任務的成功率以及軌跡執行效率倍數，精確重現了 OSWorld-Human 的核心評測方法論。

## Use It｜實際應用

- **WebArena Verified**：在企業內部私有叢集上本地部署，作為網頁 Agent 的持續整合（CI）回歸評測。
- **OSWorld**：於專屬的虛擬機（VM）叢集中運行，專門評測桌面操作 Agent。
- **Computer-Use 專用 Agent（第 21 課）**：Claude、OpenAI CUA、Gemini——全數在此類基準負載上完成調校。
- **企業自有業務流評測**：為你自家產品最核心的 Top 20 業務流程錄製黃金標準軌跡，每週對內部 Agent 進行自動化迴歸驗收。

## Ship It｜交付成果

`outputs/skill-web-desktop-harness.md` 能為任何 Web 或桌面 Agent 建立標準的測試控端，內建基於實體狀態的驗收卡點與軌跡執行效率量測指標。

## Exercises｜練習

1. 為教學測試控端擴充第二個應用程式（技術論壇）。為其編寫 3 個新任務以及對應的黃金標準軌跡。
2. 為每個任務新增軌跡執行效率報告。在你的教學模型中，Agent 的步數相比於黃金標準是 1 倍、2 倍還是 3 倍？
3. 實作一個「干擾項（Distractor）」工具——黃金軌跡從未使用過的誘餌工具。觀察腳本化 Agent 是否會受到干擾？
4. 研讀 OSWorld-G 論文。在你的自訂評測中，你會如何將「介面定位失敗」與「邏輯規劃失敗」清晰解耦分開統計？
5. 研讀 WebArena 應用程式的 README 文檔。若擅自升級了其中一個鎖定的底層應用版本，會引發何種系統破壞？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| WebArena | 「網頁 Agent 基準」 | 橫跨 4 套本機私有部署 Web 應用的 812 個長路徑任務；Gym 風格狀態驗收 |
| VisualWebArena | 「視覺版 WebArena」 | 專注於視覺錨定的評測版本；螢幕截圖為第一等公民觀測資料 |
| OSWorld | 「桌面 Agent 基準」 | 橫跨真實 Ubuntu / Windows / macOS 實體作業系統的 369 個操作任務 |
| GUI grounding | 「介面像素錨定」 | 模型將語意元素精確定位映射至 1920×1080 畫布上特定像素座標的能力 |
| Operational knowledge | 「系統操作經驗」 | 具體設定位於哪個選單、對應哪組快捷鍵或控制台面板的深層經驗知識 |
| OSWorld-G | 「純錨定評測集」 | 包含 564 個樣本的純介面定位測試集與專用訓練資料庫 |
| OSWorld-Human | 「專家黃金軌跡」 | 人工專家操作錄製的最小必要動作序列，用以衡量執行的額外步驟浪費 |
| Trajectory efficiency | 「軌跡執行效率」 | Agent 實際執行的步數除以人類專家的黃金步數之比值 |

## Further Reading｜延伸閱讀

- [Zhou et al., WebArena (arXiv:2307.13854)](https://arxiv.org/abs/2307.13854) ——四應用 Web 評測奠基論文
- [Xie et al., OSWorld (arXiv:2404.07972)](https://arxiv.org/abs/2404.07972) ——跨作業系統桌面 Agent 評測論文
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) ——Claude Computer Use 官方發布技術說明
- [OpenAI, Computer-Using Agent](https://openai.com/index/computer-using-agent/) ——OSWorld 與 WebArena 的最新評測表現
