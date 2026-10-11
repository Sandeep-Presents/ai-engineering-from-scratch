# 資料來源血緣與訓練資料治理（Data Provenance and Training-Data Governance）

> 歐盟 AI 法案強制要求通用大模型（GPAI）提供商在 2025 年 8 月前落實機器可讀的退出（Opt-out）標準（依據歐盟著作權指令的文字與資料探勘 TDM 例外條款）。加州 AB 2013 法案（2024 年簽署）——生成式 AI 訓練資料透明度法案強制要求開發者發布包含 12 項法定必備欄位的資料集摘要。2025 年歐洲各國資料保護局（DPA）在「正當利益（Legitimate interest）」法理上達成收斂：愛爾蘭 DPC（2025 年 5 月 21 日）在歐洲資料保護委員會（EDPB）給出意見後，正式接納了 Meta 使用歐盟／歐洲經濟區成年使用者第一方公開資料進行大模型訓練的合規方案；德國科隆高等地方法院（2025 年 5 月 23 日）駁回了針對 Meta 的禁制令申請；漢堡 DPA 撤回了緊急程序以維護全歐法規一致性；英國 ICO（2025 年 9 月 23 日）對 LinkedIn 重啟 AI 訓練的透明度、簡化退出機制等防護措施給予了正面監管回應，並保持持續監督——此非正式免責豁免。巴西國家資料保護局 ANPD（2024 年 7 月 2 日）曾因資訊透明度不足暫停了 Meta 的處理活動；該預防性限制措施在 Meta 提出具體合規方案後於 2024 年 8 月 30 日正式解除。不可逆性死穴：Cookie 隱私授權架構是為即時、可隨時撤銷的追蹤行為量身打造的；然而一旦資料被熔煉進神經網路權重內部，實施精確的手術刀式物理抹除在工程上完全不可能——已訓練完成的神經網路在實質上無法履行 GDPR「被遺忘權（Right to erasure）」。合規驗收的生死窗口唯有在資料採集階段。資料血緣倡議（Data Provenance Initiative，dataprovenance.org，Longpre 等人，《Consent in Crisis》，2024 年 7 月）：大規模實證審計揭示，隨著各家出版商與網站以驚人速度追加 robots.txt 限制，開源 AI 訓練公共語料庫正陷入斷崖式萎縮危機。

**Type:** Learn
**Languages:** Python (stdlib, 12-field California AB 2013 scaffolding generator)
**Prerequisites:** Phase 18 · 24 (regulatory), Phase 18 · 26 (cards)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 熟練掌握加州 AB 2013 法案針對生成式 AI 訓練資料透明度所強制規定的 12 項法定欄位。
- 陳述 2025 年歐洲各國資料保護主管機關（愛爾蘭 DPC、英國 ICO、德國漢堡與科隆）在「正當利益」大模型訓練抗辯上的統一裁決基調。
- 深刻剖析不可逆性困境（Irreversibility problem）：為何 GDPR「被遺忘權」在實體神經網路權重面前缺乏可落地的實務等價物。
- 引用資料血緣倡議（DPI）《Consent in Crisis》研究中關於全球公共語料庫迅速萎縮的核心實證數字。

## The Problem｜問題

訓練資料治理是每一份模型卡（第 18 課第 26 節）與法定合規義務（第 24 節）的最上游發源地。2024 至 2025 年間，全球監管格局高度收斂在三大基石原則之上：機器可讀的退出機制、逐資料集的透明度披露，以及針對公開資料訓練的「正當利益」司法適用。任何未能在資料採集源頭貫徹合規的提供商，在模型訓練完畢後將在物理層面徹底喪失任何補救與修復的可能。

## The Concept｜核心概念

### 加州 AB 2013 法案（California AB 2013）

於 2024 年正式簽署成法。對於在 2022 年 1 月 1 日或之後發布的系統，開發者必須在 2026 年 1 月 1 日當天或之前在官方網站公開相關文檔。法案第 3111(a) 條強制要求開發者發布訓練所用資料集的高階摘要，嚴格涵蓋 12 項法定具體項目：
1. 資料集的原始來源或合法所有者。
2. 該資料集如何具體服務於該 AI 系統預期目標的架構說明。
3. 資料集內部的資料點（Data points）總數量（允許給出大致區間；動態增長資料集允許給出合理估算）。
4. 資料點具體型態的詳細描述（標註資料需給出標籤類別；未標註資料需描述通用分佈特徵）。
5. 資料集內部是否包含任何受著作權、商標權或專利權保護的資料，或是否全量屬於公眾領域（Public domain）。
6. 該資料集究竟是出資採購、獲得商業授權，還是無償取得。
7. 資料集內部是否包含個人隱私資訊（依據加州民法典 §1798.140(v) 條款定義）。
8. 資料集內部是否包含聚合消費者資訊（依據加州民法典 §1798.140(b) 條款定義）。
9. 開發者所實施的資料清洗、加工、過濾或其他修改處理，並附帶預期目標。
10. 資料進行採集的時間跨度，若採集仍在進行中必須強制附帶即時告示。
11. 該資料集在演算法研發過程中首次被載入訓練的確切日期。
12. 該系統在訓練中是否採用、或是否持續採用了合成資料生成技術。

第 12 項（合成資料）是相對於 Gebru 等人 2018 年資料集規格書的全新增量。第 7 項（個人隱私資訊）將直接觸發加州隱私權法案（CPRA）的法定約束。法案同時明確豁免了專用於純網路資安防護、飛機航行控制以及聯邦國家安全維度的特定系統（第 3111(b) 條款）。

### 歐盟 AI 法案與 TDM 退出機制

歐盟著作權指令中的文字與資料探勘（Text and Data Mining, TDM）例外條款規定：只要權利人未明確發出保留宣告，演算法即可合法抓取公開網路文字進行訓練。而歐盟 AI 法案 GPAI 實踐準則的「著作權」專章，進一步強制要求所有通用大模型提供商必須在技術底層無條件尊重機器可讀的退出信號（如 robots.txt 標籤、C2PA 的「No AI Training」宣告或 TDM.Reservation 協定）。

### 2025 年歐洲監管機構在「正當利益」上的法律共識

愛爾蘭資料保護委員會（DPC，2025 年 5 月 21 日）：在歐洲資料保護委員會（EDPB）出具權威意見後，正式接納了 Meta 使用歐盟／歐洲經濟區成年使用者第一方公開貼文進行訓練的合規架構。德國科隆高等地方法院（2025 年 5 月 23 日）駁回了民間組織針對 Meta 的禁制令訴求，裁定「提供便捷的退出機制」在法理上已足以構成正當抗辯。漢堡 DPA 隨後撤銷了緊急程序以維護全歐法規協同。英國資訊專員辦公室（ICO，2025 年 9 月 23 日）對 LinkedIn 重啟 AI 訓練的透明度防護措施出具了正面監管回應，並維持後續常態化監督。

收斂的核心法律原則：在嚴格提供清晰退出機制的前提下，大模型提供商可以援引 GDPR 第 6 條「正當利益（Legitimate interest）」作為合法法律依據，抓取公開可見的第一方資料進行訓練，完全無需逐一取得使用者的事前主動同意（Consent）。

### 巴西 ANPD 監管事件（2024 年）

巴西國家資料保護局（ANPD）於 2024 年 7 月曾下令暫停 Meta 在巴西境內的 AI 訓練資料處理，理由是資訊告知透明度不足。這展現出與歐盟完全不同的監管優先級——巴西監管機構將「知情同意與透明度」置於「正當利益可採納性」之上。該預防性禁令在 Meta 提出具體合規整改方案後，已於 2024 年 8 月 30 日獲准撤銷。

### 殘酷的不可逆性困境（The irreversibility problem）

傳統網頁上的 Cookie 隱私授權體系，是專為即時、可隨時單方面撤回的線上追蹤行為設計的。然而神經網路訓練的物理本質截然不同：一旦某些私密資料被反向傳播梯度編碼進數百億個浮點數權重矩陣內部，任何人都無法在數學上實施精準的手術刀式物理抹除。從零重新訓練模型是唯一能百分之百銷毀該資料的手段，但其耗資數千萬美元，在經濟上完全不可行。

學界目前探索的部分緩解手段：
- **機器遺忘（Unlearning）**：近似消除特定樣本的記憶，可透過第 22 節的 MIA 成員推論攻擊來度量其殘留。
- **基於影響函數（Influence functions）的權重定位**：反向定位受該資料影響最大的權重參數並實施局部更新。
- **對齊 fine-tuning 抑制**：透過強化學習訓練模型在接收到相關實體查詢時強制拒答。

上述手段沒有任何一項能在數學上徹底解決問題。合規與隱私的唯一決定性生死窗口，永遠在最前期的資料採集時刻。

### 資料血緣倡議（Data Provenance Initiative）

官方網站 dataprovenance.org。Longpre、Mahari、Lee 等人發布的重磅調查報告《Consent in Crisis》（2024 年 7 月）：針對全球 AI 訓練公共語料庫展開了全景式實證審計。核心結論：全球各大頂級網站與出版商正在以指數級速度追加 robots.txt 禁爬限制。全人類原本自由共享的開源資料公共地（Commons）正在以驚人的速度急劇枯竭。僅在 2023 至 2024 年的短短一年間，全球最頂尖的高質量訓練語料來源中，便有約 25% 增加了排他性限制。深遠影響：未來大模型預訓練資料的取得，將不可逆地全面依賴全新範式——商業版權採購授權、高品質合成資料生成，以及具備 Token 激勵的 Web3/開源協同生態。

### 該研究在第 18 階段中的宏觀座標（Where this fits in Phase 18）

第 26 節規範模型層面的對外文檔；第 27 節規範資料集層面的源頭治理；兩者共同築牢了透明度防禦層。隨後的第 28 節將帶領讀者穿透至整個 AI 對齊科研生態系的核心機構（MATS、Redwood、Apollo、METR）。

```figure
an-provenance-oneway
```

## Use It｜實際應用

`code/main.py` 實作了一套加州 AB 2013 宣告式腳手架生成器：針對一套玩具訓練資料集，自動生成包含 12 項法定欄位的標準 Markdown/JSON 揭露文檔。程式會自動標註哪些欄位會觸發後續的著作權或加州隱私法（CPRA）申報義務。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-provenance-check.md`。輸入企業即將投入訓練的資料集清單，該 Skill 將自動逐項稽核：加州 AB 2013 的 12 項欄位完備性、TDM 機器可讀退出協定合規性、各大主權監管機構的「正當利益」抗辯支撐材料，以及端到端的不可逆性風險評估報告。

## Exercises｜練習

1. 執行 `code/main.py`。為一個假想的醫療對話訓練資料集產出一份 12 欄位摘要。精確標註出其中哪些欄位在缺乏實體法務協議支撐時極易引發合規暴雷。
2. 歐盟著作權指令要求 TDM 退出信號必須具備機器可讀性。設計一種標準化的退出格式宣告，並將其與傳統的 robots.txt 以及 C2PA 的「No AI Training」標籤進行優缺點橫向對比。
3. 仔細研讀資料血緣倡議（DPI）2024 年 7 月發布的《Consent in Crisis》研究報告。指出在全網範圍內追加限制最為迅猛的前三大內容類別，並深入論述其對未來大模型研發帶來的深遠商業衝擊。
4. 2025 年歐洲監管機構全面接納以「正當利益」作為抓取公開資料進行訓練的法律基礎。建構一個在法理上「正當利益」絕對無法成立的特殊業務情境，並指明此時大模型提供商必須改採何種法律依據？
5. 起草一份能將加州 AB 2013 的 12 項法定欄位與 C2PA 密碼學數位簽名鏈深度咬合的資料血緣資訊清單草案。列出落實該草案所面臨的一項實體技術障礙與一項法律司法障礙。

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| AB 2013 | "the California law" | Generative AI training-data transparency; 12 mandated fields |
| TDM exception | "text-and-data-mining" | EU Copyright Directive training-data exception with opt-out |
| Legitimate interest | "the EU basis" | GDPR Article 6 basis that may justify training on public content |
| Opt-out signal | "machine-readable no-train" | robots.txt, C2PA "No AI Training," TDM.Reservation |
| Irreversibility | "cannot un-train" | Data in model weights is not surgically removable |
| Unlearning | "approximate removal" | Post-training interventions to reduce model dependence on specific data |
| Consent in Crisis | "the DPI audit" | July 2024 finding of accelerating robots.txt restrictions |

## Further Reading｜延伸閱讀

- [California AB 2013](https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2013) — 生成式 AI 訓練資料透明度官方立法條文。
- [EU AI Act + GPAI Code of Practice (Lesson 24)](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) — 歐盟著作權專章與實踐準則。
- [Longpre, Mahari, Lee et al. — Consent in Crisis (dataprovenance.org, July 2024)](https://www.dataprovenance.org/consent-in-crisis-paper) — DPI 全球訓練資料公共地枯竭審計報告。
- [IAPP — EU Digital Omnibus GDPR amendments (2025)](https://iapp.org/news/a/eu-digital-omnibus-amendments-to-gdpr-to-facilitate-ai-training-miss-the-mark) — 歐洲隱私法規演進前沿解析。
