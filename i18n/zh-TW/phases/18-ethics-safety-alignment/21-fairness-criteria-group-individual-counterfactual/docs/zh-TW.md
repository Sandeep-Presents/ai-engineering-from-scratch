# 公平性準則——群體、個體與反事實（Fairness Criteria — Group, Individual, Counterfactual）

> 三大流派建構了現代公平性研究的完整架構體系。群體公平（Group fairness）：人口統計均等（demographic parity）、均等化賠率（Equalized odds）、條件使用準確度均等（Conditional use accuracy equality）——核心要求受保護群體在統計均值上的各項機率相等。個體公平（Individual fairness，Dwork 等人，2012）：相似的個體應當獲得相似的決策裁定；在數學上表現為決策映射函數滿足李普希茨連續性條件（Lipschitz condition）。反事實公平（Counterfactual fairness，Kusner 等人，2017）：若某個體在因果世界模型中將其敏感屬性反事實替換後其決策結果保持不變，則該決策對其公平。2024 年重大理論突破（NeurIPS 2024）：反事實公平與預測準確度之間存在固有的取捨；提出了一套模型無關方法，能以有界的準確度損失，將最優但不公平的預測器轉換為反事實公平預測器。溯因反事實（Backtracking counterfactuals，arXiv:2401.13935，2024 年 1 月）：開闢了新範式，避免了對受法律保護屬性進行干預的法律疑慮。哲學調和（ICLR Blogposts 2024）：在明確因果有向無環圖（DAG）的前提下，滿足特定群體公平指標在實質上隱含並導向了反事實公平。

**Type:** Learn
**Languages:** Python (stdlib, three-criteria comparison)
**Prerequisites:** Phase 18 · 20 (bias), Phase 02 (classical ML)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 精確陳述三大群體公平性準則（人口統計均等、均等化賠率、條件使用準確度均等），並深刻理解著名的不可能定理（Impossibility theorem）。
- 掌握 Dwork 等人 2012 年基於李普希茨（Lipschitz）連續條件形式化定義的個體公平性。
- 描述反事實公平性（Counterfactual fairness）的數學內涵，及其對因果有向無環圖（Causal DAG）的深層依賴。
- 剖析溯因反事實（Backtracking counterfactuals），並說明其如何繞過「在反歧視法理上不得對敏感屬性實施實體干預」的法律障礙。

## The Problem｜問題

第 18 課第 20 節聚焦於如何量化測量偏見。而第 21 節則深入到本質層面：定義度量指標背後所應當追求的「公平性標準」。三大流派給出了在數學結構上完全迥異的標準體系——一個模型完全可以做到群體公平卻極度違背個體公平，或做到反事實公平卻在群體層面呈現出嚴重的不平等。挑選何種公平性定義，本質上是一項嚴肅的公共政策與公司治理決策；沒有任何單一數學標準能在全場景下絕對最優。

## The Concept｜核心概念

### 群體公平（Group fairness）

- **人口統計均等（demographic parity）**：P(Y=1 | A=a) = P(Y=1 | A=a') 對所有群體嚴格成立。要求跨群體的絕對正向獲批率相等。
- **均等化賠率（Equalized odds）**：P(Y=1 | Y*=y, A=a) = P(Y=1 | Y*=y, A=a')。要求跨群體的真陽性率（TPR）與偽陽性率（FPR）同時相等。
- **條件使用準確度均等（Conditional use accuracy equality）**：P(Y*=y | Y=y, A=a) = P(Y*=y | Y=y, A=a')。要求跨群體的陽性預測值（PPV）與陰性預測值（NPV）完全一致。

**不可能定理（Chouldechova 2017，Kleinberg-Mullainathan-Raghavan 2017）**：當群體的基礎率（Base rates）不相等時，上述三項群體公平準則無法同時滿足。

### 個體公平（Individual fairness）

Dwork 等人於 2012 年確立。若一個決策映射函數 f 相對於特定任務下的相似度度量空間 d 滿足 |f(x) - f(x')| <= L * d(x, x')（其中 L 為李普希茨常數），則該決策具備個體公平性。核心原則：相似的個體應當獲得相似的對待。

工程死穴在於：如何科學定義距離度量 d。這本質上是一項充滿價值觀判斷的社會政策抉擇，而非單純的統計學問題。

### 反事實公平（Counterfactual fairness）

Kusner 等人於 2017 年提出。在給定全域人群因果模型的前提下，若某個體 i 在其敏感屬性（如性別、種族）被反事實虛擬改變時，模型對其產出的決策輸出依然分毫不差，則該決策對個體 i 具備反事實公平性。

需要因果有向無環圖（Causal DAG）。DAG 本身是建模選擇；反事實公平有多合理，取決於該 DAG 有多合理。

### 反事實公平與模型精度之間固有的取捨

NeurIPS 2024 理論研究證實：反事實公平與預測準確度之間存在固有的取捨。該研究提出一套模型無關方法，能將最優但不公平的預測器轉換為反事實公平預測器，且準確度成本有界。折損的大小直接取決於敏感屬性在原始不公模型中的權重係數絕對值。

### 溯因反事實（Backtracking counterfactuals）

arXiv:2401.13935（2024 年 1 月）。傳統反事實分析強制對敏感屬性實施直接干預——「若這個人原本是另一種性別，系統的決策是否會改變？」在法律上這是有疑慮的：分類法規不允許對受保護屬性進行這類干預。

溯因反事實巧妙翻轉了推理方向：不再對先天屬性實施虛擬干預，而是向後反推——「這個人實際具備的哪些特徵組合會產生該反事實結果？」這項數學視角的反轉可避開這項法律疑慮。

### 哲學調和（Philosophical reconciliation）

ICLR Blogposts 2024 系列專文指出：給定因果圖，滿足某些群體公平指標會蘊含反事實公平。三大流派並非彼此毫不相干；它們是同一底層因果結構的不同面向。

這並未解決不可能定理（基礎率不相等時仍無法同時滿足群體公平準則），但顯示「群體」與「個體／反事實」之間表面上的對立，部分是未明確說明因果模型所造成的。

### 該研究在第 18 階段中的宏觀座標

第 20 節專攻偏見度量；第 21 節專攻公平性規範定義；第 22 節跨入差分隱私；第 23 節深入數位浮水印。這些研究共同築牢了面向實體人類福祉的社會公平防線。

```figure
an-fairness-trilemma
```

## Use It｜實際應用

`code/main.py` 建構了一套帶有敏感屬性且各群體基礎率不相等的微型二元分類資料集。在簡單分類器上計算人口統計均等、均等化賠率與條件使用準確度均等三項指標，觀察這些指標彼此不一致。隨後套用針對人口統計均等的樣本重加權方法，觀察它對另外兩項指標的影響。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-fairness-criterion.md`。輸入一項企業對外的公平性宣告或合規政策草案，該 Skill 將自動嚴審：該政策究竟採用了哪一套具體的數學定義？在非對稱的群體基礎機率下該承諾是否在數學上自相矛盾？以及其宣告背後究竟預設了怎樣的因果有向無環圖（DAG）結構。

## Exercises｜練習

1. 執行 `code/main.py`。在預設測試資料下記錄三大群體公平性指標的具體數值。套用以「人口統計均等」為導向的重加權演算法後重新測量。詳細對比另外兩項指標發生的劇烈波動。
2. 採用非敏感特徵上的 L2 歐幾里得幾何距離，動手實作 Dwork 等人 2012 年的個體公平性度量函數。統計在常數 L=1 的約束下，資料集中共有多少對個體直接違反了李普希茨連續條件？
3. 仔細研讀 Kusner 等人（2017）原著論文。為一個自動化履歷篩選系統手繪一張包含兩個特徵的簡易因果有向無環圖（DAG），並寫出該圖所隱含的反事實公平性約束方程。
4. 2024 年的溯因反事實技術徹底規避了對法定受保護屬性的直接虛擬干預。描述一個這項技術對法律合規有影響的情境。
5. ICLR 2024 的調和論文主張群體與反事實公平是同一因果結構的不同切面。從 `code/main.py` 的三項準則中任選兩項，寫出能使這兩項指標在數學上完全等價所需的因果架構先驗假設。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| Demographic parity | 「各群體比率相等」 | 各群體的 P(Y=1 | A=a) 相等 |
| Equalized odds | 「TPR／FPR 相等」 | 各群體的真陽性率與偽陽性率相等 |
| Conditional use accuracy | 「PPV／NPV 相等」 | 各群體的預測值相等 |
| Individual fairness | 「Lipschitz 條件」 | 相似的個體得到相似的決策 |
| Counterfactual fairness | 「對因果屬性變更保持不變」 | 在反事實情境下變更屬性，決策仍保持不變 |
| Backtracking counterfactual | 「從實際特徵反向解釋」 | 從結果往回推理反事實，而非從屬性往前推理 |
| Impossibility theorem | 「三項準則彼此衝突」 | Chouldechova／KMR（2017）：基礎率不相等時，群體公平準則彼此互斥 |

## Further Reading｜延伸閱讀

- [Dwork et al. — Fairness through Awareness (arXiv:1104.3913)](https://arxiv.org/abs/1104.3913) — 個體公平性奠基之作。
- [Kusner, Loftus, Russell, Silva — Counterfactual Fairness (arXiv:1703.06856)](https://arxiv.org/abs/1703.06856) — 反事實公平性開山論文。
- [Chouldechova — Fair prediction with disparate impact (arXiv:1703.00056)](https://arxiv.org/abs/1703.00056) — 不可能定理經典證明。
- [Backtracking Counterfactuals (arXiv:2401.13935)](https://arxiv.org/abs/2401.13935) — 溯因反事實最新範式。
