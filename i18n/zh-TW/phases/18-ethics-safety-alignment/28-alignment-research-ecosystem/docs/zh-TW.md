# 對齊科研生態系——MATS、Redwood、Apollo、METR（Alignment Research Ecosystem — MATS, Redwood, Apollo, METR）

> 五個機構構成了 2026 年非實驗室端（Non-lab）的 AI 對齊研究生態。**MATS（機器學習對齊與理論學者計畫）**：自 2021 年底以來已有 527 名以上研究者，發表 180 篇以上學術論文，總引用量突破 1 萬次，h-index 達到 47；2024 年夏季正式註冊為美國 501(c)(3) 非營利組織，單屆擁有約 90 名學者與 40 位導師；2025 年前的校友中有 80% 從事安全與資安工作，200 多人遍布於 Anthropic、DeepMind、OpenAI、英國 AISI、蘭德智庫（RAND）、Redwood、METR 與 Apollo。**Redwood Research**：由 Buck Shlegeris 創立的應用對齊實驗室；開創了 AI 控制（AI Control，第 18 課第 10 節）學術流派；持續與英國 AISI 聯合推進控制安全論證。**Apollo Research**：專門為前沿實驗室提供上線前謀劃行為評測；撰寫了《In-Context Scheming》（第 08 節）與《Towards Safety Cases for AI Scheming》。**METR（模型評估與威脅研究機構）**：專精於基於真實任務的能力評測與自主任務時間跨度研究；其《前沿 AI 安全政策的共通要素》是橫向對比各大實驗室治理框架的文獻。**Eleos AI Research**：專精於大模型福祉的上線前評測（第 19 節）；完成了 Claude Opus 4 的模型福祉評估。

**Type:** Learn
**Languages:** none
**Prerequisites:** Phase 18 · 01-27 (prior Phase 18 lessons)
**Time:** ~45 minutes

## Learning Objectives｜學習目標

- 梳理實驗室外對齊研究生態系中的五個組織及其核心產出。
- 描述 MATS 的培育規模（研究員數量、論文產出、h-index）及其作為全球頂尖安全人才培育途徑的關鍵樞紐地位。
- 掌握 Redwood Research 的 AI 控制體系及其與英國國家級 AISI 的戰略合作模式。
- 掌握 METR 基於真實長程任務的能力評測方法論。

## The Problem｜問題

前沿實驗室（第 18 課）在內部進行安全評估，並選擇性公布結果。實驗室外的生態系統可驗證這些評估、首先發現新的失效模式，並培育人才。了解這個生態系統，有助於理解哪些研究發現受到哪些人的信任。

## The Concept｜核心概念

### MATS（機器學習對齊與理論學者計畫）

於 2021 年底發起。這是一項研究導師計畫：學者與資深研究者針對特定對齊問題合作 10 至 12 週。

2026 年最新量化規模：
- 自成立以來累計培養 527 名以上專業研究員。
- 發表 180 篇以上論文。
- 累計學術引用量突破 1 萬次大關。
- MATS 的 h-index 為 47。
- 2024 年夏季：單期匯聚 90 名學者與 40 位導師；正式法人化為 501(c)(3) 非營利實體。

人才走向：2025 年前畢業的校友中，約 80% 從事 AI 安全或資安相關工作。200 多名校友目前在 Anthropic、DeepMind、OpenAI、英國 AISI、RAND、Redwood、METR 與 Apollo。

### Redwood Research

應用對齊實驗室。由 Buck Shlegeris 創始領導。引入了 AI Control 議程（第 10 課）。與英國 AISI 合作研究控制安全論證。就 DeepMind 與 Anthropic 的評估設計提供建議。

標誌性論文：Greenblatt、Shlegeris 等人的《AI Control》（arXiv:2312.06942，ICML 2024）；與 Anthropic 聯合發表的《Alignment Faking》（Greenblatt、Denison、Wright 等人，arXiv:2412.14093）。

科研風格：極具資安工程學硬派特色，預設最壞情況的惡意對手，打造在極限對抗施壓下仍可被嚴格檢驗的具體工程協定。

### Apollo Research

為前沿實驗室提供部署前的謀劃行為評估。主導撰寫了《In-Context Scheming》（第 08 節，arXiv:2412.04984）。2025 年與 OpenAI 深度合作開展審思反謀劃訓練。發布了《Towards Safety Cases for AI Scheming》（2024 年）。

科研風格：評估可能出現欺騙的自主 Agent 情境；確立了謀劃行為的三大支柱（目標背離、目標導向性、情境感知）。

### METR（模型評估與威脅研究機構）

以任務為基礎進行能力評估。深入研究模型自主完成超長程複雜任務所需的時間跨度（Time-horizon）。其發布的《前沿 AI 安全政策的共通要素》（metr.org/common-elements，2025 年）比較各實驗室的框架。

與 Apollo 聯合起草了 AI 謀劃安全論證架構草案。

科研風格：長程複雜任務評測、實證能力邊界度量、跨機構治理框架綜合提煉。

### Eleos AI Research

專精於大模型福祉（Model Welfare）的上線前評測機構。進行了 Claude Opus 4 的模型福祉評估，相關內容記錄於系統卡第 5.3 節。為本課第 19 節關於模型主觀體驗的相關論述提供了堅實的外部方法論查驗。

### 全球對齊人才與智力流向閉環

MATS 培訓研究人員。畢業生加入 Anthropic、DeepMind、OpenAI 的實驗室安全團隊，或加入 Redwood、Apollo、METR、Eleos 等外部評估機構。外部評估者與各實驗室及 UK AISI／CAISI 合作。研究成果回饋至生態系統，供 MATS 培訓下一屆研究人員。

### 為何這層獨立機構至關重要

單一來源的自查自評天生缺乏公信力：大模型生產商在評估自家產品時存在無可避免的商業利益衝突。外部評估者能提出並驗證實驗室可能低報的失效模式。2024 年的休眠代理刺客（第 07 節）是 Anthropic 攜手 Redwood 共同完成的；虛假對齊偽裝（第 09 節）同樣由兩家聯合署名；上下文內謀劃（第 08 節）由 Apollo 獨立攻克；反謀劃訓練則由 Apollo 與 OpenAI 聯合實施。多機構架構提供品質控管。

### 該研究在第 18 階段中的宏觀座標

第 07 至 11 節大量引用了 Redwood 與 Apollo 的開創性研究；第 18 節直接依託 METR 的跨實驗室框架橫向對比；第 19 節深度對接 Eleos 的方法論。第 28 節正是為全書讀者提供一份清晰的學術組織導航地圖，完整展現支撐本階段所有前沿結論背後的實體科研共同體。

```figure
sae-features
```

## Use It｜實際應用

本課不設程式碼。閱讀 METR 的《前沿 AI 安全政策的共通要素》（Common Elements of Frontier AI Safety Policies），了解外部綜整如何為實驗室內部的政策工作增添價值。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-ecosystem-map.md`。輸入一項對齊主張或評估，該 Skill 將辨識其所屬組織、發表刊物與方法論風格，並與已知的對應組織交叉查核。

## Exercises｜練習

1. 從第 07 至 15 節中任選一篇代表性論文，完整梳理其所有共同作者所屬的實體機構。交叉核對作者是否為 MATS 校友，以及其目前所屬的生態系機構。
2. 研讀 METR 的《前沿 AI 安全政策的共通要素》白皮書。列出其著重強調的三大跨實驗室治理共識，以及分歧最大的兩處核心領域。
3. MATS 校友中約有 80% 從事 AI 安全防護工作。深入辯論這一強烈的從業選擇偏向究竟是一種「為行業定向培育稀缺人才的良性適應」，還是一種「過度篩選、排斥異端思想的智力回音室」？
4. Redwood 與 Apollo 皆長期深耕於控制與謀劃研究，但兩者的工程風格大相徑庭。挑選一項具體的安全失效模式，具體描述這兩家機構會分別採取何種不同的方法論路徑展開排查。
5. Eleos AI 是唯一專注於模型福祉的組織。虛擬構思第二個聚焦於不同福祉相關問題（如大模型認知自由、具身機器人物理痛苦感知）的組織，並撰寫其核心研究方法論大綱。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| MATS | 「研究導師計畫」 | ML Alignment & Theory Scholars；自 2021 年以來培養 527 位以上研究者 |
| Redwood Research | 「控制研究機構」 | 應用對齊研究；AI Control 論文作者；UK AISI 合作夥伴 |
| Apollo Research | 「謀劃評測機構」 | 為前沿實驗室進行部署前謀劃評測 |
| METR | 「任務時間範圍評測機構」 | 以任務為基礎的能力評估與框架綜整 |
| Eleos AI | 「福祉研究機構」 | 部署前的模型福祉評估 |
| Talent pipeline | 「MATS 到實驗室的人才流向」 | MATS 畢業生進入 Anthropic、DM、OpenAI、Redwood、Apollo 與 METR |
| External evaluation | 「實驗室外的檢查」 | 非模型製造者執行的評估，可增加可信度 |

## Further Reading｜延伸閱讀

- [MATS (ML Alignment & Theory Scholars)](https://www.matsprogram.org/) — 全球頂級對齊學者培養計畫官方主頁。
- [Redwood Research](https://www.redwoodresearch.org/) — 應用對齊與 AI 控制研究實驗室。
- [Apollo Research](https://www.apolloresearch.ai/) — 大模型謀劃評測先鋒機構。
- [METR — Common Elements of Frontier AI Safety Policies](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) — 跨大廠前沿政策綜合評析。
- [Eleos AI Research](https://www.eleosai.org/research) — 模型福祉評估方法論手冊。
