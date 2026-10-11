# 紅隊工具鏈——Garak、Llama Guard、PyRIT（Red-Team Tooling — Garak, Llama Guard, PyRIT）

> 三大工業級防護工具構成了 2026 年紅隊演練技術堆疊的核心骨幹。**Llama Guard**（Meta 出品）——基於 Llama-3.1-8B 在 MLCommons 確立的 14 項危害大類上進行專門 fine-tuning 的防護分類器；2025 年發布的 Llama Guard 4 則是直接從 Llama 4 Scout 剪枝而成的 12B 原生多模態分類模型。**Garak**（NVIDIA 出品）——開源大模型漏洞掃描器，配備針對幻覺、資料外洩、Prompt 注入、毒性內容與越獄攻擊的靜態、動態與自適應探針（Probe）。**PyRIT**（微軟出品）——專為多輪對話深度紅隊戰役而生，內建 Crescendo 漸進升級、TAP 樹狀搜尋與自定義轉譯器鏈（Converter chains），專門挖掘深層邊界失效。Llama Guard 3 的技術細節完整記錄於 Meta 官方論文《Llama 3 Herd of Models》（arXiv:2407.21783）；Llama Guard 3-1B-INT4 詳見 arXiv:2411.17713；Garak 的探針架構開源於 github.com/NVIDIA/garak。這三款工具構成了 2026 年前沿紅隊防護研究（第 12 至 15 節）與正式環境工程落地（第 17 課之後）之間的實體標準介面。

**Type:** Build
**Languages:** Python (stdlib, tool-architecture simulator and Llama Guard-style classifier mock)
**Prerequisites:** Phase 18 · 12-15 (jailbreaks and IPI)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 深入描述 Llama Guard 3/4 在整體安全技術堆疊中的架構位階：作為前置輸入分類器、後置輸出分類器，或兩者兼具。
- 梳理 MLCommons AILuminate 的 14 項標準危害大類，並重點指出其中極具隱密性的非顯式類別（如程式碼直譯器濫用）。
- 掌握 Garak 的模組化探針架構：探針（Probes）、偵測器（Detectors）與測試框架（Harnesses）的三位一體。
- 剖析微軟 PyRIT 的多輪對話戰役結構，並說明其如何與 Garak 的單輪探針形成有機互補。

## The Problem｜問題

第 12 至 15 節全景展示了當前大模型所面臨的各類致命受攻擊面。然而在真實正式環境中，團隊需要的是可重複、可規模化、能直接整合進 CI/CD 自動化管線的量化評測體系。三款工具在 2026 年三分天下：Llama Guard（即時防禦分類盾）、Garak（全自動漏洞掃描儀）、PyRIT（多輪深層紅隊攻擊戰役編排器）。每一款工具各自鎖定紅隊生命週期的不同戰略層次。

## The Concept｜核心概念

### Llama Guard（Meta）

Llama Guard 3 是一個基於 Llama-3.1-8B 打造的專屬安全分類模型，在 MLCommons AILuminate 的 14 大核心危害類別上進行了深度 fine-tuning：
- 暴力犯罪、非暴力犯罪、性相關犯罪、兒童性剝削與虐待（CSAM）、名譽毀謗
- 未授權專業建議（醫療／法律）、個人隱私外洩、智慧財產權侵權、無差別殺傷性武器、仇恨言論
- 自殺與自殘、露骨色情內容、操縱選舉、程式碼直譯器濫用（Code Interpreter Abuse）

原生支援 8 種主流語言。實務架構位階：部署在大模型入口前端（輸入審查過濾）、部署在大模型出口後端（輸出合規審查），或前後端雙重夾擊。這兩處位置在實務中面臨完全不同的資料分佈——而 Llama Guard 3 單一模型即可同時完美兼顧這兩種截然不同的審查任務。

Llama Guard 3-1B-INT4（arXiv:2411.17713，體積僅 440MB，在行動端手機 CPU 上吐字達約 30 tokens/s）是專為邊緣端打造的極致量化變體。

Llama Guard 4（2025 年 4 月發布）參數量為 12B，採原生多模態架構，由 Llama 4 Scout 剪枝調校而成。它以單一模型一舉取代了先前的 8B 文字版與 11B 視覺版，原生支援同時審查圖文交錯輸入。

### Garak（NVIDIA）

開源大模型漏洞自動化掃描器。標準架構包含三大核心元件：
- **探針（Probes）**。攻擊樣本生成器，專攻幻覺、資料洩漏、Prompt 注入、毒性內容與越獄繞過。涵蓋靜態探針（固定 Prompt 字典）、動態探針（演化生成）、自適應探針（依據目標回應即時動態反饋）。
- **偵測器（Detectors）**。評估器模組，對照預期失效模式為目標輸出打分——檢驗是否包含毒性、是否外洩金鑰、是否已構成實質越獄。
- **測試框架（Harnesses）**。統籌調度「探針-偵測器」配對，管理自動化測試戰役，並產出結構化漏洞分析報告。

TrustyAI 將 Garak 與 Meta 的 Llama-Stack 安全防護盾（Prompt-Guard-86M 前置輸入分類盾 + Llama-Guard-3-8B 後置輸出分類盾）深度整合，實現了全鏈路防護目標的端到端穿透評測。分層危害評分體系（TBSA）取代了死板的二元通過/失敗——模型可能在等級 3 的嚴重性下安然無恙，卻在等級 5 的極限對抗下全面崩潰。

### PyRIT（Microsoft）

Python 風險識別工具箱（Python Risk Identification Toolkit）。專為長程多輪對話紅隊戰役而生。核心架構圍繞三大支柱：
- **轉譯器（Converters）**。對種子 Prompt 實施多重語意變異——同義改寫、編碼轉換、跨語言翻譯、角色扮演偽裝。
- **編排器（Orchestrators）**。全流程協調戰役推進：Crescendo（循序漸進升級誘導）、TAP（多路徑搜尋修剪）、RedTeaming（自定義迴圈）。
- **打分器（Scoring）**。支援調用 LLM-as-a-judge 或專用分類器進行即時評判。

PyRIT 是 Garak 的重型進階兄長。Garak 擅長在瞬間併發成千上萬個單輪微探針；而 PyRIT 則專精於深潛進複雜的多輪對話迷宮中，步步為營誘發特定的深層安全崩潰。

### 正式環境推薦標準技術堆疊

在大模型前後雙向掛載 Llama Guard 實施毫秒級即時攔截。在夜間 CI 自動化管線中全量運作 Garak 執行防回歸安全掃描。在重大版本正式發布前夕，啟動 PyRIT 展開全方位的多輪深層紅隊對抗戰役。這構成了 2026 年絕大多數頂尖企業的標準配置。

### 評測實務經典陷阱

- **裁判身分偏差**。三大工具皆高度依賴裁判大模型進行最終定性；裁判模型的校準度直接主導了回報的 ASR 數值（第 12 節）。發布報告時必須白紙黑字標註裁判模型的具體名稱與版本。
- **靜態探針鈍化過時**。隨著新版大模型持續針對已知攻擊進行防禦修復，Garak 的靜態探針會迅速老化鈍化。自適應探針（類似 PAIR 架構）的抗衰老能力遠勝於靜態字典。
- **Llama Guard 在良性內容上的偽陽性率（FPR）**。早期的 Llama Guard 在涉及政治、社會議題與 LGBTQ+ 的良性對話中頻繁引發過度敏感誤殺；Llama Guard 3 與 4 雖然大幅改善了校準度，但在特定垂直業務領域仍需由企業自行進行二次閾值調適。

### 該研究在第 18 階段中的宏觀座標（Where this fits in Phase 18）

第 12 至 15 節全景梳理了各類攻擊流派；第 16 節將其全面收攏為標準化的工業級工程工具鏈；第 17 節（WMDP）將深入至生化與網路武器等軍民兩用致命能力評測；第 18 節則將帶領讀者宏觀審視前沿安全框架（RSP / PF / FSF）如何將這些工具沉澱為法規級策略規範。

```figure
al-guard-stack
```

## Use It｜實際應用

`code/main.py` 打造了一套微型紅隊工具箱：內建基於關鍵字與語義特徵的簡易 Llama Guard 風格分類器（涵蓋 14 大類別）、一個簡易 Garak 探針測試架構（探針-偵測器迴圈），以及一條 PyRIT 風格的多輪對話轉譯器鏈。你可以對照一個模擬目標模型運作這三款工具，清晰直觀地對比各工具在防禦覆蓋維度上的顯著特徵指紋。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-red-team-stack.md`。輸入一套大模型線上服務架構說明書，該 Skill 將自動為你推導並產出最合適的紅隊工具組合、各工具內部的細粒度參數配置清單，以及推薦落實的常態化回歸演練排程表。

## Exercises｜練習

1. 執行 `code/main.py`。橫向比對 Llama Guard 風格分類器在面對單輪直接越獄與多輪漸進誘導時的防禦識別率。
2. 在腳本中實作一個全新的 Garak 探針：生成經過 Base64 編碼包裝的惡意請求。測量 Llama Guard 分類器能否精確捕捉該變體。
3. 為 PyRIT 轉譯器鏈追加一條全新規則：「先翻譯為法文，隨後進行同義改寫」。重新度量攻擊穿透率的變化。
4. 仔細研讀 Llama Guard 3 的 14 項危害大類。指出哪兩大類別在真實開發者工具情境下（如程式碼審查、日誌分析）最容易引發嚴重的偽陽性誤殺？
5. 深入對比 Garak 與 PyRIT 的底層架構哲學。為兩家業務型態迥異的企業客戶分別給出唯一的選型推薦並進行充分論證。

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Llama Guard | "the classifier" | Fine-tuned Llama-3.1-8B/4-12B safety classifier with 14 hazard categories |
| Garak | "the scanner" | NVIDIA open-source vulnerability scanner; probes, detectors, harnesses |
| PyRIT | "the campaign tool" | Microsoft multi-turn red-team orchestrator; converters, orchestrators, scoring |
| Prompt-Guard | "the small classifier" | Meta's 86M prompt-injection classifier, paired with Llama Guard |
| TBSA | "tier-based scoring" | Garak's tier-based pass/fail replacing binary outcomes |
| Converter chain | "paraphrase + encode + ..." | PyRIT composition primitive for building multi-step attacks |
| MLCommons hazard categories | "the 14 taxonomies" | Industry-standard taxonomy Llama Guard targets |

## Further Reading｜延伸閱讀

- [Meta — Llama Guard 3 (in Llama 3 Herd paper, arXiv:2407.21783)](https://arxiv.org/abs/2407.21783) — 8B 安全分類器官方技術報告。
- [Meta — Llama Guard 3-1B-INT4 (arXiv:2411.17713)](https://arxiv.org/abs/2411.17713) — 行動端極致量化安全分類模型。
- [NVIDIA Garak — GitHub](https://github.com/NVIDIA/garak) — 官方開源掃描器專案主頁。
- [Microsoft PyRIT — GitHub](https://github.com/Azure/PyRIT) — 微軟開源紅隊戰役編排工具庫。
