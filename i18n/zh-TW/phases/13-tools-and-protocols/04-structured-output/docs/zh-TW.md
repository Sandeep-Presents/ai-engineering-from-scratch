# 結構化輸出——JSON Schema、Pydantic、Zod 與語法約束解碼（Structured Output — JSON Schema, Pydantic, Zod, Constrained Decoding）

> 「禮貌懇求大模型回傳 JSON」即使在最頂級旗艦模型上，依然存在 5% 至 15% 的失敗率。結構化輸出（Structured Outputs）透過約束解碼（Constrained Decoding）徹底抹平了這道鴻溝：在解碼階段，模型在數學上被完全禁止輸出任何會違反 Schema 規範的 token。OpenAI 的嚴格模式（Strict Mode）、Anthropic 基於 Schema 約束的工具使用、Gemini 的 `responseSchema`、Pydantic AI 的 `output_type` 以及 Zod 的 `.parse`，本質上皆是同一個底層概念的不同具體形態。本課將親手實作 Schema 校驗器與嚴格模式契約，為每一條正式環境的資料擷取管線奠定堅不可摧的可靠基石。

**Type:** Build
**Languages:** Python (stdlib, JSON Schema 2020-12 subset)
**Prerequisites:** Phase 13 · 02 (function calling deep dive)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 為資料擷取目標撰寫標準的 JSON Schema 2020-12，並配置正確的邊界約束（enum、min/max、required、pattern）。
- 深入解釋嚴格模式與約束解碼相較於「生成後再校驗」在數學保證上的根本不同。
- 嚴格辨析三大核心失效模式：語法解析錯誤、Schema 規範違規、模型主動拒絕執行。
- 交付一條具備具型別錯誤修復與具型別拒答處理能力的生產級資訊擷取管線。

## The Problem｜問題

當 Agent 審讀一封包含採購訂單的電子郵件時，核心任務是將非結構化的自由文字精準轉化為 `{customer, line_items, total_usd}` 結構化物件。工業界歷經了三種處理方案的演進：

**方案一：透過 Prompt 懇求模型輸出 JSON**。「請嚴格以包含 customer、line_items 與 total_usd 欄位的 JSON 格式回覆。」在旗艦模型上約有 85% 到 95% 的成功率。但常遭遇六種典型崩潰：漏括號、末尾多餘逗號、型別錯位、憑空捏造未定義欄位、超出 token 上限截斷、以及洩漏自由文字（如「好的，以下是為您生成的 JSON：」）。

**方案二：生成後再執行外部校驗**。放任模型自由生成，隨後由外部程式解析並對照 Schema 進行校驗，一旦失敗則發起重試。此方案雖然可靠但開銷高昂——每一次重試都需要額外燃燒 API 成本，且截斷性缺陷每次都會平白浪費一整輪 token 預算。

**方案三：語法約束解碼（Constrained Decoding）**。模型提供商直接在底層解碼階段對 Schema 實施強制約束。任何會破壞 Schema 結構的非法 token，在取樣機率分布中皆會被直接遮蓋清零（Mask out）。從數學上保證輸出必定能被解析為合法 JSON，且必定完全符合 Schema 定義。此時，整個系統的失效模式優雅地收斂至唯一的確定性形態：模型拒絕（Refusal，模型判定輸入內容完全無法填入該 Schema）。

2026 年的所有主流前沿提供商，皆全面原生支援了方案三：

- **OpenAI**：配置 `response_format: {type: "json_schema", strict: true}`；若模型拒絕執行，回應中會顯式回傳 `refusal` 欄位。
- **Anthropic**：在 `tool_use` 輸入端強制實施嚴格 Schema 約束；雖然沒有顯式的 `stop_reason: "refusal"` 停止原因，但若模型自發放棄呼叫，會輸出帶有純文字說明的 `end_turn`。
- **Gemini**：在請求最外層配置 `responseSchema`；2026 年的 Gemini 已針對指定型別全面支援 token 等級的語法限制。
- **Pydantic AI**：`output_type=InvoiceModel` 直接輸出強型別至 `InvoiceModel` 的 `RunResult` 物件。
- **Zod（TypeScript）**：執行期型別解析器，與 OpenAI 官方 Node SDK 的 `beta.chat.completions.parse` 深度綁定。

不變的核心哲學：宣告一次 Schema，全流程端到端強制約束。

## The Concept｜核心概念

### JSON Schema 2020-12——通用協定通用語

各大提供商全面遵循標準的 JSON Schema 2020-12 方言。最常運用的核心約束關鍵字：

- `type`：取值限定為 `object`、`array`、`string`、`number`、`integer`、`boolean`、`null`。
- `properties`：定義欄位名稱與對應子 Schema 的映射字典。
- `required`：必須顯式存在的欄位名稱清單。
- `enum`：限定允許的閉合枚舉值集合。
- `minimum` / `maximum`（數值上下限）、`minLength` / `maxLength` / `pattern`（字串長度與正則表達式）。
- `items`：套用於陣列中每個元素的子 Schema 定義。
- `additionalProperties`：設為 `false` 可嚴格禁止模型輸出未宣告的額外欄位。

OpenAI 嚴格模式（Strict Mode）額外施加了三條硬性鐵律：properties 中定義的每一個欄位皆必須顯式列入 `required` 清單中；全域所有物件層級皆必須顯式宣告 `additionalProperties: false`；嚴禁包含未解析的 `$ref`。一旦違反上述任一規則，API 會在請求發起時直接拋出 400 錯誤。

### Pydantic：Python 生態的強型別綁定

Pydantic v2 能透過 `model_json_schema()` 自動自 Python 資料類別中導出合法的 JSON Schema。Pydantic AI 將其進一步封裝，開發者只需宣告：

```python
class Invoice(BaseModel):
    customer: str
    line_items: list[LineItem]
    total_usd: Decimal
```

Agent 框架便會在邊緣端自動將其轉譯為 OpenAI 嚴格模式、Anthropic `input_schema` 或 Gemini `responseSchema` 的專屬格式。模型輸出的結構化資料會被直接實例化為強型別的 `Invoice` 物件；若發生校驗違規，則拋出帶有精確欄位路徑的 `ValidationError`。

### Zod：TypeScript 生態的強型別綁定

Zod（`z.object({customer: z.string(), ...})`）是 TypeScript 生態的對等實踐。OpenAI 官方 Node SDK 提供的 `zodResponseFormat(Invoice)` 能直接將 Zod Schema 轉譯為符合 API 規範的 JSON Schema 酬載。

### 拒絕執行（Refusals）機制

即使在嚴格模式下，我們也無法強迫大模型無中生有。若輸入內容本質上完全無法匹配目標 Schema（例如傳入的電子郵件是一首十四行詩，而非任何商業發票），模型會主動輸出 `refusal` 欄位並附帶拒絕理由。在工程程式碼中，必須將其視為一等公民的合規結果，而非程式崩潰例外。此外，拒絕機制亦是一道極佳的安全感測器：若使用者惡意要求模型從機密郵件中擷取信用卡號，模型會自發回傳附帶安全拒絕理由的 refusal 物件。

### 開源生態中的約束解碼實踐

開源權重模型在本地端推論時，通常仰賴三種技術實現語法約束：

1. **基於文法狀態機的受限解碼**（如 `outlines`、`guidance`、`lm-format-enforcer`）：將目標 Schema 預先編譯為確定性有限狀態機（FSM）；在生成的每一個時間步，利用遮罩將所有會違反 FSM 狀態轉移的候選 token 的 logit 直接置為負無窮大。
2. **結合 JSON 解析器的 Logit 動態遮蓋**：讓串流 JSON 解析器與大模型解碼器保持同步步進，在每一步動態計算當前允許出現的合法 token 候選集合。
3. **基於校驗器的投機解碼**：由輕量級草稿模型並行預測候選 token，由嚴格校驗器直接強制把關。

商業大模型提供商在雲端後台正是採用了上述機制之一。在 2026 年的技術條件下，對於簡短的結構化輸出，約束解碼的生成速度甚至快於無約束的自由文字生成。

### 三大核心失效模式

1. **語法解析錯誤（Parse error）**：輸出端甚至不是合法的 JSON。在嚴格模式下在數學上絕無可能發生；但在非嚴格提供商上依然偶發。
2. **Schema 規範違規（Schema violation）**：輸出是合法的 JSON，但型別錯位、漏填必填欄位或超出數值範圍。嚴格模式下絕無可能發生；非嚴格模式下極為常見。
3. **主動拒絕執行（Refusal）**：模型宣告輸入無法匹配目標結構。必須作為合法的強型別回傳結果予以優雅處理。

### 智慧重試策略

在未支援嚴格約束解碼的環境中（如部分自建模型或舊版 API），工業級的容錯補救管線如下：

```
generate -> parse -> validate -> if fail, inject error and retry, max 3x
```

通常單次重試即可修復大多數偶然缺陷；三次重試足以覆蓋較弱模型的多數隨機抖動。若超過三次重試依然失敗，極可能意味著 Schema 本身設計不良：目標 Schema 在某些極端輸入下根本無法被滿足，此時應當修正 prompt 描述或放寬 Schema 約束。

### 小尺寸模型的逆襲

約束解碼對小尺寸模型具備立竿見影的點石成金效果。一個具備狀態機文法約束的 3B 開源小模型，在結構化資訊擷取任務上的可靠度，能夠徹底擊潰僅依賴自由 Prompt 提示的 70B 龐大模型。這正是結構化輸出在工業界的最核心價值：將系統的「結構確定性」與大模型的「參數量大小」徹底解耦。

```figure
constrained-decoding
```

## Use It｜實際應用

`code/main.py` 以純 Python 標準函式庫實作了一套最小化的 JSON Schema 2020-12 校驗器（支援 types、required、enum、min/max、pattern、items、additionalProperties）。它封裝了一個 `Invoice` 商業發票 Schema，並模擬傳入三組測試輸出，完整演示了語法錯誤、Schema 違規與主動拒絕執行的三種路徑。在正式生產中，只需將假輸出替換為真正的模型 API 回應即可。

核心閱讀重點：

- 校驗器失敗時會回傳強型別的 `[ValidationError]` 錯誤清單，精確指出出錯的欄位路徑與原因。這正是建構智慧重試 Prompt 時所需注入的核心資訊。
- 面對模型的 refusal 拒絕路徑時，系統**絕不**發起盲目重試，而是完整記錄日誌並作為合規結果向外交付。Phase 14 · 09 正是利用拒絕機制建構安全防線。
- 在惡意測試資料中注入多餘欄位時，`additionalProperties: false` 會精確觸發攔截，展示嚴格模式如何徹底封死模型「幻覺虛構未定義欄位」的漏洞。

## Ship It｜交付成果

本課產出 `outputs/skill-structured-output-designer.md`。給定任意非結構化自由文字擷取目標（如商業發票、客服工單、求職履歷），該技能將產出一份具備嚴格模式相容性的標準 JSON Schema 2020-12 定義，以及一份完全對齊的 Pydantic 模型，並內建強型別拒答處理與自動重試機制的標準程式碼骨架。

## Exercises｜練習

1. 運行 `code/main.py`。新增第四個測試案例，使其 `total_usd` 金額為負數。驗證校驗器是否能精確捕捉到該違規，並透過 `minimum` 約束路徑予以拒絕。

2. 擴充校驗器以支援帶有鑑別器（Discriminator）的 `oneOf` 聯合型別。典型業務情境：發票中的 `line_item` 必須是「實體商品」或「專業服務」兩者之一，並由 `kind` 欄位進行標記。嚴格模式對此類語法有精細規定，請參考 OpenAI 官方結構化輸出指南。

3. 將相同的 Invoice Schema 以 Pydantic 的 BaseModel 重新實作，並比對 `model_json_schema()` 輸出的 JSON 與你手寫的 Schema。指出 Pydantic 預設自動生成、但手寫版本中通常會主動省略的某一個額外欄位。

4. 測量模型真實拒絕率。構造十組本質上絕對無法被擷取的極端輸入文字（一首抒情歌詞、一段幾何數學證明、一封空白郵件），在嚴格模式下傳入真實大模型 API。統計模型輸出 refusal 與強行虛構幻覺的次數對比。

5. 從頭到尾精讀 OpenAI 官方結構化輸出指南。找出在標準 JSON Schema 中完全合法、但在 OpenAI 嚴格模式中被明文明確禁止的某一項特定語法。設計一份在業務上本來非本質依賴該禁止語法的 Schema，並將其重構為完全符合嚴格模式相容標準的優雅規範。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際意義 |
|------|----------------|------------------------|
| JSON Schema 2020-12 | 「Schema 規範標準」 | 當前所有主流模型提供商共同遵循的 IETF 結構約束方言標準 |
| Strict mode | 「保證嚴格合法」 | OpenAI 提供的專屬旗標，透過語法約束解碼強制模型輸出絕對符合宣告規範 |
| Constrained decoding | 「Logit 遮罩約束」 | 在模型解碼的每一個時間步，動態將不符合語法的非法 token 機率直接清零的技術 |
| Refusal | 「模型合規拒答」 | 當輸入內容完全無法填入目標結構時，模型輸出的強型別確定性拒絕執行物件 |
| Parse error | 「JSON 語法崩潰」 | 模型輸出甚至無法被解析為合法 JSON；在嚴格模式下數學上保證絕不可能發生 |
| Schema violation | 「型別結構違規」 | 雖然是合法 JSON，但出現了型別錯位、漏填必填或超出範圍；嚴格模式下保證不發生 |
| `additionalProperties: false` | 「嚴禁虛構多餘欄位」 | 嚴格禁止輸出任何未預先定義的雜項欄位；為 OpenAI 嚴格模式的強制要求項 |
| Pydantic BaseModel | 「Python 型別物件」 | 能自動導出標準 JSON Schema 並在執行期對輸入進行強型別校驗的 Python 類別 |
| Zod schema | 「TypeScript 型別規範」 | TypeScript 生態中的執行期型別解析器，負責驗證模型輸出的結構合法性 |
| Grammar enforcement | 「開源狀態機約束」 | 在本地開源模型上，基於有限狀態機（FSM）實施的 Logit 動態遮蓋約束技術 |

## Further Reading｜延伸閱讀

- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) ——嚴格模式、拒絕機制與 Schema 約束鐵律官方指南
- [OpenAI — Introducing structured outputs](https://openai.com/index/introducing-structured-outputs-in-the-api/) ——2024 年 8 月發布的約束解碼底層數學原理詳解
- [Pydantic AI — Output](https://ai.pydantic.dev/output/) ——能自動序列化至各提供商的強型別 output_type 綁定手冊
- [JSON Schema — 2020-12 release notes](https://json-schema.org/draft/2020-12/release-notes) ——官方標準規範指南
- [Microsoft — Structured outputs in Azure OpenAI](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) ——企業級雲端部署與嚴格模式避坑指南
