# 語音 Agent：Pipecat 與 LiveKit

> 語音 Agent 在 2026 年已成為頂級的一等生產級應用類別。Pipecat 提供了基於訊框（Frame）的 Python 管線架構（VAD → STT → LLM → TTS → Transport）；LiveKit Agents 則透過 WebRTC 搭建起大模型與使用者之間的即時通訊橋樑。頂級高階技術堆疊的端到端延遲預算目標嚴格落在 450–600ms 之內。

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 描述 Pipecat 基於訊框的雙向管線架構：下行流 DOWNSTREAM（來源→接收端）與上行流 UPSTREAM（控制與反饋）。
- 指出標準語音管線的核心處理階段，以及 Pipecat 所支援的各大傳輸層協定。
- 解釋 LiveKit Agents 的兩大語音 Agent 類別（MultimodalAgent 與 VoicePipelineAgent）及其各自的最佳適用情境。
- 總結 2026 年正式環境中的延遲期望值，並理解這些毫秒級指標如何左右底層架構決策。

## The Problem｜問題

語音 Agent 絕非「單純在文字對話迴圈外層硬掛一個 TTS 朗讀器」。其延遲預算極其嚴苛（端到端約 600ms 閾值）、流動的音訊永遠是連續片段的、話輪結束檢測本身就是一個獨立模型，且傳輸協定橫跨傳統電信 SIP 到現代 WebRTC。你要麼親手建構一套基於訊框的串流管線（如 Pipecat），要麼深度仰賴成熟的即時通訊平台（如 LiveKit）。

## The Concept｜核心概念

### Pipecat（pipecat-ai/pipecat）

- 基於 Python 的訊框式管線框架。
- 核心處理鏈：`Frame` → `FrameProcessor`。
- 兩大雙向流動通道：
  - **下行通道（DOWNSTREAM）**：來源 → 接收端（音訊輸入、LLM 思考、TTS 語音輸出）；
  - **上行通道（UPSTREAM）**：控制與即時反饋（任務取消、效能指標回報、打斷插話 Barge-in）。
- `PipelineTask` 管理整體生命週期，內建生命週期事件（`on_pipeline_started`、`on_pipeline_finished`、`on_idle_timeout`）與針對指標／追蹤／RTVI 的觀測器。

典型語音管線：

```
VAD (Silero) → STT → LLM (context alternates user/assistant) → TTS → transport
```

支援傳輸層：Daily、LiveKit、SmallWebRTCTransport、FastAPI WebSocket、WhatsApp。

Pipecat Flows 為對話注入結構化狀態機。Pipecat Cloud 則是官方雲端代管執行時期。

### LiveKit Agents（livekit/agents）

- 透過 WebRTC 將 AI 模型直接對接至終端使用者。
- 核心概念：`Agent`、`AgentSession`、`entrypoint`、`AgentServer`。
- 兩大語音 Agent 類別：
  - **MultimodalAgent**：原生端到端音訊處理（透過 OpenAI Realtime API 或對等方案直接輸入／輸出音訊）。
  - **VoicePipelineAgent**：STT → LLM → TTS 傳統級聯管線；賦予工程師字詞層級的精細控制力。
- 基於 Transformer 模型的語義話輪檢測（Semantic Turn Detection）。
- 原生支援 MCP 工具整合。
- 支援傳統電話電信網路 SIP 接入。
- 透過 LiveKit Inference 支援 50+ 款免金鑰大模型；透過外接擴充套件支援額外 200+ 款模型。

### 商用平台方案

Vapi（頂級最佳化堆疊下可達約 450–600ms 延遲）與 Retell（跨 180 次實測通話平均約 600ms 端到端延遲）皆深植於上述開源生態之上。若團隊缺乏專職的 WebRTC 網路維運工程師，採用現成平台是明智之舉。

### 典型架構失效模式

- **缺乏打斷插話處理（Barge-in）**：使用者開口打斷，Agent 卻依然自顧自地朗讀。在 Pipecat 中必須透過發射 UPSTREAM 取消訊框來即時煞車，在 LiveKit 中亦具備對等機制。
- **無視 STT 辨識置信度**：將低置信度、充斥語法錯誤的語音轉文字草稿當作聖旨直接餵給 LLM。解法：依置信度設定門檻，過低時主動追問確認。
- **TTS 句中截斷雜音**：當管線在說話中途被突發取消時，TTS 模組若缺乏平滑衰減會爆發刺耳截斷噪音。
- **輕忽毫秒級延遲預算**：管線上的每個環節皆會無情增加 50–200ms 延遲。在正式發布前，必須對全鏈路耗時進行嚴格累加審計。

### 2026 年典型延遲預算分佈

- VAD 語音活動檢測：20–60ms
- STT 片段語音識別：100–250ms
- LLM 首字生成延遲（TTFT）：150–400ms
- TTS 首音訊訊框產出：100–200ms
- 網路傳輸往返延遲（RTT）：30–80ms

端到端 450–600ms 屬於頂級旗艦水準；800–1200ms 屬於業界常見水準；任何超過 1500ms 的回應在真實人類聽覺體驗中皆顯得頓挫遲鈍。

```figure
voice-pipeline
```

## Build It｜動手實作

`code/main.py` 實作了一套極簡的訊框式管線：

- `Frame` 核心資料型別（audio 音訊、transcript 逐字稿、text 文字、tts_audio 合成音訊、control 控制信號）；
- 定義 `process(frame)` 介面的 `Processor` 基礎類別；
- 由腳本化處理器構成的五階段標準管線（VAD → STT → LLM → TTS → transport）；
- 演示打斷插話（Barge-in）的 UPSTREAM 取消訊框。

運行實驗：

```
python3 code/main.py
```

日誌會清晰展示標準的正向下行流，以及使用者開口插話時發射的上行取消信號如何即時阻斷中途的 TTS 朗讀輸出。

## Use It｜實際應用

- **Pipecat**：適用於需要極致客製化控制——自訂處理器、Python 優先、隨意熱插拔供應商。
- **LiveKit Agents**：適用於 WebRTC 優先部署與傳統電話電信網路接入。
- **Vapi / Retell**：適用於缺乏專職 WebRTC 維運團隊的企業代管方案。
- **OpenAI Realtime / Gemini Live**：適用於追求極致低延遲的端到端語音直出（MultimodalAgent）。

## Ship It｜交付成果

`outputs/skill-voice-pipeline.md` 能為任何環境產出 Pipecat 風格的語音管線鷹架，完整串聯 VAD + STT + LLM + TTS + Transport，並內建打斷插話防禦常式。

## Exercises｜練習

1. 為教學管線新增效能觀測器：每秒統計每個處理階段的訊框吞吐量。延遲究竟在哪個環節累積最為嚴重？
2. 實作帶有置信度門檻的 STT：當置信度低於閾值時，主動發送「抱歉，能否請您再說一次？」的追問。
3. 新增語義話輪檢測規則：若文字以問號結尾，立即判定該話輪已結束。
4. 研讀 Pipecat 傳輸文檔。將標準函式庫虛擬傳輸層改寫為 SmallWebRTCTransport 設定。
5. 實測對比：在完全相同的問題下，實測 OpenAI Realtime 與 STT+LLM+TTS 級聯管線的延遲差異。文字層級的精細控制權究竟付出了多少毫秒的延遲代價？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| Frame | 「管線訊框」 | 在管線中流動的強型別資料單元（音訊、逐字稿、文字、控制信號） |
| Processor | 「處理節點」 | 實作 process(frame) 介面的具體管線環節 |
| DOWNSTREAM | 「正向下行流」 | 來源至接收端的正向資料流：音訊輸入 → 大模型 → 語音朗讀輸出 |
| UPSTREAM | 「反向上行流」 | 逆向傳播的反饋與控制流：取消信號、指標回報、打斷插話 |
| VAD | 「語音活動檢測」 | 毫秒級即時判定使用者當前是否正在開口說話的感測演算法 |
| Semantic turn detection | 「語義話輪檢測」 | 基於模型語義理解、智慧判定使用者發言是否已經結束的演算法 |
| MultimodalAgent | 「端到端音訊 Agent」 | 音訊直接進、音訊直接出；中間完全不經由文字轉譯轉換 |
| VoicePipelineAgent | 「級聯語音 Agent」 | STT + LLM + TTS 三階段串聯架構；保留字詞層級的精細控制力 |

## Further Reading｜延伸閱讀

- [Pipecat docs](https://docs.pipecat.ai/getting-started/introduction) ——基於訊框的管線架構與處理器官方文件
- [LiveKit Agents docs](https://docs.livekit.io/agents/) ——WebRTC 即時通訊與語音原語指南
- [Vapi](https://vapi.ai/) ——全代管語音平台架構參考
- [Retell AI](https://www.retellai.com/) ——經過嚴格延遲基準評測的語音平台
