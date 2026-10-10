# MCP 模型輸入：Sampling 遷移與無狀態 MRTR（MCP Model Input: Sampling Migration and Stateless MRTR）

> MCP 2026-07-28 規範正式廢棄了針對新設計的 Sampling 機制，並徹底移除了由伺服器向用戶端發起逆向請求的通道。若既有工作流程依然需要調用用戶端的大模型，伺服器改為回傳 `input_required` 結果，並由用戶端攜帶模型輸出重新重試最初的請求。此舉使整個推理迴圈在協定層面變得清晰顯式、嚴格受限且絕對無狀態。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 10 (resources and prompts)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 解釋為何 Sampling 機制在 MCP 2026-07-28 中被正式宣告廢棄，並為新伺服器優先選用直接對接模型提供商的標準架構。
- 實作向下相容的工作流程，將既有的 `sampling/createMessage` 呼叫平滑遷移至多輪往返請求（MRTR）架構。
- 為每一個請求的 `_meta` 物件精確配置協定修訂版本與用戶端能力宣告。
- 回傳 `resultType: "input_required"`，並以全新的 JSON-RPC 請求 ID 重新發起最初的方法呼叫。
- 為 `requestState` 建立防篡改完整性保護，並將其嚴格綁定至當前主體、方法名稱、原始引數以及有效過期時間。
- 透過能力校驗閘門、使用者審核確認、回應資料校驗與最大輪次上限，為模型輔助迴圈建立嚴密的防護邊界。

## The Decision Before the Protocol｜協定之前的架構決策

類似 `summarize_repo` 的複合工具，本質上需要承擔兩類完全相異的工作：

1. 確定性工作：遍歷檔案清單、讀取允許存取的內容、校驗路徑合法性，並將資料進行組裝。
2. 模型智慧工作：挑選具代表性的關鍵檔案，並綜合歸納產出結構化摘要。

如今你有兩種完全合法的架構路線可供抉擇：

### 新建伺服器：直接整合模型提供商 API

這是當前的標準首選路線。伺服器自身全權擁有模型選型、憑證管理、呼叫配額預算、自動重試與全鏈路可觀測性。它向 MCP 用戶端回傳一次性的常規 `tools/call` 終態成果。

當伺服器本身已經是託管雲端服務，或當可預測的模型行為與確定性品質高於「復用呼叫端宿主模型」時，果斷選用此方案。

### 既有 Sampling 工作流：平滑遷移至 MRTR

Sampling 依然處於其淘汰過渡期之內。宣告遵循 2026-07-28 規範的伺服器，無法再直接向用戶端推送即時的 `sampling/createMessage` 逆向請求。取而代之的是將該請求安全封裝於 `InputRequiredResult` 中向外回傳。

唯有當「深度利用呼叫端既有的模型憑證與配額」屬於強硬的產品業務需求時，方可選用此向下相容路徑。必須同步擬定長期的退場計畫，因為全新實作絕不應當盲目採納已廢棄的舊機制。

## The Stateless Contract｜無狀態協定契約

2026 年 7 月的最新修訂版中，徹底抹去了 `initialize` 交握、`notifications/initialized` 確認通知以及 `Mcp-Session-Id` 標頭。過去隱藏在連線交握中的關鍵資訊，現在必須在每一次請求中完整自包含宣告：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "summarize_repo",
    "arguments": {"audience": "developer"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {"sampling": {}},
      "io.modelcontextprotocol/clientInfo": {
        "name": "lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

伺服器在接收每一次獨立請求時，皆必須重新校驗協定版本。版本欄位缺漏或非字串型別，視為無效參數拋出 `-32602`。傳入不支援的版本字串，拋出標準錯誤碼 `-32022` 搭配精準資料 `{"supported":["2026-07-28"],"requested":"<client version>"}`。若請求涉及 Sampling 但用戶端能力未聲明，則拋出 `-32021` 搭配 `data.requiredCapabilities` 設定為 `{"sampling":{}}`。

不帶 JSON-RPC `id` 的信封代表單向通知。接收端可以默默處理它，但絕不可回傳成功或失敗回應。在 Streamable HTTP 傳輸層上，接收合法的單向通知時回傳空內文的 `202 Accepted`。

伺服器同時必須強制實作 `server/discover` 介面，並在其中明確宣告 `supportedVersions`、能力清單、`ttlMs` 與 `cacheScope`，使呼叫端在正式調用工具前能夠探測並快取這份契約。由於服務發現宣告了 `tools` 能力，伺服器亦必須實作必備的 `tools/list`。其回傳的 `summarize_repo` 描述資訊中，必須包含合法的物件型別 `inputSchema`、`resultType: "complete"`、伺服器識別資訊後設資料，以及公開的快取建議。

現代成功回應最外層皆必須具備明確的鑑別欄位：

- `resultType: "complete"`：代表全流程執行圓滿終止。
- `resultType: "input_required"`：代表呼叫端必須先滿足內部嵌附的輸入請求，隨後發起重試。
- 外部擴充功能亦可定義專屬的結果型別（例如 Tasks 擴充功能在第 13 課中將引入 `"task"`）。

## One MRTR Round｜單輪 MRTR 運作機制

伺服器在處理請求期間，嚴禁主動向用戶端發起逆向通訊。它改為回傳以下標準結果：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "input_required",
    "inputRequests": {
      "pick_files": {
        "method": "sampling/createMessage",
        "params": {
          "messages": [
            {
              "role": "user",
              "content": {
                "type": "text",
                "text": "Choose three representative files and return a JSON array."
              }
            }
          ],
          "systemPrompt": "Return only the requested value.",
          "modelPreferences": {
            "costPriority": 0.8,
            "intelligencePriority": 0.2
          },
          "maxTokens": 400
        }
      }
    },
    "requestState": "opaque-integrity-protected-value"
  }
}
```

用戶端在接收到該回應後，先驗證自身是否具備 Sampling 能力、實施內部的安全審核與模型調度策略，並調用本地大模型產出回應。隨後，用戶端以全新派發的 JSON-RPC 請求 ID 重新發起原始方法：

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "summarize_repo",
    "arguments": {"audience": "developer"},
    "inputResponses": {
      "pick_files": {
        "role": "assistant",
        "content": {
          "type": "text",
          "text": "[\"README.md\", \"server.py\", \"docs/intro.md\"]"
        },
        "model": "host-model",
        "stopReason": "endTurn"
      }
    },
    "requestState": "opaque-integrity-protected-value",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {"sampling": {}}
    }
  }
}
```

請注意：這次重試呼叫**絕非**舊有協定連線階段的延續！它是一次全新獨立的常規請求——完整重複最初的方法名稱與引數、僅追加當前輪次採集到的 `inputResponses`，並原封不動地逐字回傳 `requestState`。

MRTR 機制僅允許在 `tools/call`、`prompts/get` 與 `resources/read` 上運作。伺服器嚴禁在無關的其他方法中回傳 `input_required`。

## Multi-Round State｜多輪狀態管理

本課展示的業務場景需要兩輪大模型參與：

1. `pick_files`：引導大模型挑選關鍵檔案清單並回傳 JSON 陣列。
2. `summary`：基於已讀取的檔案內容，引導大模型撰寫最終長文摘要。

每一次重試僅攜帶該特定輪次的輸入回應。因此，伺服器必須將當前的業務進展階段以及經過校驗的中間暫存資料，安全封裝進下一個 `requestState` 之中。

必須將該狀態值嚴格視為完全受攻擊者控制的不可信外部輸入。僅對階段名稱進行簡單雜湊是極度危險的。狀態必須深度綁定至：

- 通過驗證的真實主體（Principal），而非用戶端自我聲稱的 `clientInfo`；
- 最初發起調用的具體方法名稱；
- 原始引數內容的防篡改摘要（Digest）；
- 短暫的硬性過期時間戳記；
- 當前所處的具體業務階段，以及通過校驗的中間變數。

在無需保密的情境下採用 HMAC 簽名；在嚴禁用戶端窺探內部狀態時採用具備認證機制的對稱加密。簽名損壞、狀態逾時、呼叫主體不符或原始引數遭到篡改時，伺服器必須堅定回傳 `-32602` 拒絕執行。

用戶端嚴禁私自解析或修改 `requestState` 的內容。它的唯一法定職責，便是在重試時原封不動地原樣轉發該字串。

## Model Preferences Are Hints｜模型偏好僅是建議提示

`costPriority`（成本優先級）、`speedPriority`（速度優先級）以及 `intelligencePriority`（智力優先級）皆是互相獨立的建議提示。它們並非機率分布，數值總和完全不需要等於一。呼叫端完全可以忽略這些偏好，因為大模型的最終選型策略永遠屬於用戶端宿主的主權範疇。

若你維護既有的 Sampling 流程，請將 `includeContext` 始終保持在 `"none"`。其他全域上下文模式會顯著加劇資料外洩風險，且自身亦已被標記為廢棄。請始終在請求中以顯式方式傳遞最小必要的精確上下文。

## Safety Invariants｜安全防護不變量

面對嵌附的 Sampling 請求，用戶端是最終的安全信任邊界：

- 當安全策略要求審核時，在呼叫模型前主動向使用者彈出確認視窗，清晰展示伺服器具體要求大模型做什麼。
- 為 MRTR 輪次配置嚴格的上限。否則惡意受控的伺服器能輕易建構出無限調用大模型的「算力燃燒迴圈」。
- 在將取樣模型產出的字串用於檔案路徑、URL 位址或工具引數前，必須實施地毯式的格式校驗。
- 限制單輪往返所允許消耗的位元組數與 token 上限。
- 堅決拒絕執行任何未在當前用戶端能力宣告中顯式開放的輸入請求。
- 嚴禁讓大模型的生成輸出直接左右核心授權鑑權決策。
- 記錄最初發起的方法名稱與輸入請求金鑰，嚴禁在日誌中洩漏敏感的 Prompt 內文。

`clientInfo` 與 `serverInfo` 僅供前端展示與診斷除錯之用，絕不可充當身分認證憑證。

```figure
t3-sampling-flip
```

## Build It｜動手實作

`code/main.py` 在完全零第三方依賴的前提下，完整實作了標準的雙輪 MRTR 業務流程：

- `server/discover` 回傳 `supportedVersions`、宣告工具支援並回傳快取建議。
- `tools/list` 回傳具備確定性排序、可快取且帶有物件型別輸入 Schema 的 `summarize_repo` 描述符。
- `tools/call` 逐請求嚴格校驗後設資料。
- 首次調用回傳嵌附有 `sampling/createMessage` 的檔案挑選請求。
- 首次重試驗證大模型回傳的結果合法性，並無縫嵌附第二輪長文摘要請求。
- 基於 HMAC 簽名保護的 `requestState` 在多個獨立請求之間安全傳遞階段狀態。
- 最終成果標註有 `resultType: "complete"`。

教學程式碼中內建的虛擬宿主模型確保了測試的高確定性。在介接真實宿主時，只需抽換 `fake_host_model` 即可，伺服器端狀態機始終保持確定性且完全可測。

## Use It｜實際應用

在儲存庫根目錄下執行：

```bash
cd phases/13-tools-and-protocols/11-mcp-sampling/code
python3 main.py
python3 -m unittest discover tests -v
```

日誌軌跡重點檢驗清單：

- 服務發現回傳包含 `ttlMs` 與 `cacheScope` 的終態成果。
- 工具探測回傳相同排序的描述符，包含 `resultType`、伺服器身分與快取提示。
- 能力缺漏與不支援版本精確回傳 `-32021` 與 `-32022` 錯誤資訊。
- 不帶 ID 的單向通知絕不回傳任何 JSON-RPC 回應。
- 請求 ID 序列為 `[1, 2, 3]`，雄辯地證明了每一輪 MRTR 皆是完全獨立的全新請求。
- 前兩次調用成果標註為 `input_required`。
- 最終成果標註為 `complete`，且完整包含選定的檔案清單與高品質長文摘要。
- 刻意在重試時篡改原始引數，會精確觸發狀態防篡改校驗失敗。

## Ship It｜交付成果

本課產出 `outputs/skill-sampling-loop-designer.md`。它已全面升級為架構遷移規劃器：首先客觀評估是否應當徹底移除 Sampling 並轉向直接整合大模型；若確實需要相容，則完整輸出 MRTR 輪次編排、狀態安全綁定、能力閘門、算力預算、校驗防護與長期退場時程表。

## Exercises｜練習

1. 將檔案挑選的回傳結果刻意改為格式損壞的無效 JSON。確認伺服器會主動拋出 `-32602`，而非盲目信任大模型輸出。
2. 在首次呼叫與重試呼叫之間，故意竄改傳入的 `audience` 引數。深入解釋為何封裝簽名的狀態識別碼能成功攔截這類跨請求的狀態盜用。
3. 為流程新增第三輪互動：要求宿主大模型對產出的摘要進行反思批判。將前述摘要安全封裝進帶簽名的狀態中，並將全流程嚴格限制在三輪以內。
4. 徹底移除 Sampling 機制：以伺服器端自有的模型適配器取代虛擬宿主回呼。梳理並列舉有哪些授權審核、計費計量與可觀測性權責隨之遷移至伺服器端。
5. 構造一個已超出有效期限 1 秒的過期狀態值，編寫單元測試驗證伺服器是否會果斷拒絕執行。

## Key Terms｜關鍵術語

| 術語 | 2026-07-28 規範下的實際意義 |
|------|------------------------|
| Sampling | 已廢棄特性；由伺服器向呼叫端的大模型請求文字補全的舊有機制 |
| MRTR | 多輪往返請求（Multi Round-Trip Requests）；在需要用戶端輸入時採用的無狀態重試模式 |
| `InputRequiredResult` | 標註有 `resultType: "input_required"` 的中間狀態成果 |
| `inputRequests` | 伺服器指派的嵌附式詢問、取樣或根目錄輸入請求映射字典 |
| `inputResponses` | 用戶端在當前輪次採集完畢、與 `inputRequests` 鍵值對應的模型輸出成果 |
| `requestState` | 伺服器簽發的不透明狀態識別碼，由用戶端原樣回傳並由伺服器防篡改校驗 |
| `resultType` | 標註於每個現代 MCP 成果外層的必備鑑別欄位 |
| Direct model integration | 直接整合模型；新建伺服器需要模型推論時的官方推薦標準做法 |
| Capability gate | 能力閘門；嚴禁向用戶端發送任何未經用戶端顯式宣告支援的嵌附請求 |
| Loop budget | 迴圈預算；為整套操作所嚴格配置的最大輪次、token 數量、耗時與花費上限 |

## Legacy Compatibility｜傳統歷史相容性

鎖定於 2025-11-25 舊版本的傳統用戶端，在長期連線上依然可能調用傳統伺服器主動發起的 `sampling/createMessage` 流程。請將該行為嚴格限制在專屬的相容適配層中，絕不要讓連線階段式的架構侵蝕 2026-07-28 的現代無狀態伺服器核心。

官方 SDK 能夠在底層自動為舊版對等端點轉譯現代的 `input_required` 處理常式。該轉接層是為了互通而設的相容邊界，絕非在現代架構中引入新連線記憶的許可證。

## Further Reading｜延伸閱讀

- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr) ——MRTR 無狀態重試模式官方規格
- [MCP 2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog) ——最新協定重大架構變更日誌
- [MCP Sampling deprecation](https://modelcontextprotocol.io/seps/2577-deprecate-roots-sampling-and-logging) ——全面廢除 Sampling 與根目錄的官方架構提案（SEP-2577）
- [MCP 2026-07-28 server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover) ——動態服務發現官方規範手冊
