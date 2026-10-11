# STaR、V-STaR、Quiet-STaR——自我教學推理（Self-Taught Reasoning）

> 最小可行的自我改進迴圈就存在於推理過程（rationale）之中。模型生成一條思維鏈，保留那些推匯出正確答案的軌跡，並在這些高品質資料上進行 fine-tuning。這就是 STaR。V-STaR 額外加入了驗證器（verifier），大幅提升推論時期的選取品質。Quiet-STaR 則將推理過程下沉到每一個 token。這三種方法都確實有效。但它們絕非魔法——這個迴圈同時也會保留任何剛好碰巧得出正確答案的捷徑推理。

**Type:** Learn
**Languages:** Python (stdlib, bootstrap-loop simulator)
**Prerequisites:** Phase 13 · 01-03 (Reasoning and CoT), Phase 15 · 01 (long-horizon framing)
**Time:** ~60 minutes

## The Problem｜問題

教導模型進行推理最直觀的方法，就是蒐集人類撰寫的推理軌跡。這種方式極其昂貴、緩慢，而且受限於人類願意撰寫的高品質思維鏈數量上限。

STaR（Self-Taught Reasoner，Zelikman 等人，2022 年）提出了一個問題：如果讓模型自己撰寫推理依據，並對照已知答案進行評分，結果會如何？其迴圈流程如下：

1. 取樣一條推理軌跡與最終答案。
2. 若最終答案正確，保留該軌跡。
3. 在保留的軌跡上進行 fine-tuning。
4. 重複上述步驟。

這確實奏效。GSM8K 與 CommonsenseQA 的表現都在沒有增加任何新的人類標註下獲得了提升。然而該迴圈存在一個內建的偏誤：任何得出正確答案的推理過程都會被保留，無論其推理邏輯本身是否嚴謹合理。V-STaR（Hosseini 等人，2024 年）透過訓練出的驗證器修補了這個缺陷；Quiet-STaR（Zelikman 等人，2024 年）則將該概念泛化至逐 token 的內部推理。

## The Concept｜核心概念

### STaR：基於成功經驗的bootstrap（Bootstrap）

從具備基本弱推理能力的基底模型開始。針對每個訓練題目，取樣出一個推理過程與答案。若答案與標準答案相符，則保留該（問題、推理過程、答案）三元組。接著在保留的資料集上對模型進行 fine-tuning。重複循環。

其中有一個關鍵的巧妙設計。如果模型完全無法解出某個題目，迴圈就無法從該題中學習。STaR 引入了**合理化（rationalization）**機制：針對模型解題失敗的問題，將正確答案作為提示注入，重新 prompt 模型生成一條通往該答案的推理過程。這些經過合理化的推理軌跡同樣會被加入訓練集中。

原始論文中的結果（Zelikman 等人，2022 年）：透過帶有合理化機制的多次 STaR 輪次，GPT-J 基底模型在 GSM8K 上的表現從 5.8% 提升至 10.7%——絕對值提高了約 5 個百分點。在 CommonsenseQA 上，經由 STaR 訓練的 GPT-J 6B 達到了 72.5%，足以媲美經過 fine-tuning 的 GPT-3 175B（約 73%）——後者是參數規模大了約 30 倍且使用人工標註推理軌跡訓練的模型。

### V-STaR：利用 DPO 訓練驗證器

STaR 會直接丟棄錯誤的推理過程。Hosseini 等人（2024 年）觀察到這些錯誤軌跡其實也是寶貴的資料：每一對（推理過程，「是否正確」）都可以用來訓練驗證器。他們透過對正確與錯誤解法進行直接偏好最佳化（Direct Preference Optimization, DPO）來建構排序器。在推論時期，取樣 N 個推理過程，並挑選驗證器給出最高評分的選項。

實測增幅：相較於先前的自我改進基準線，在 GSM8K 與 MATH 上獲得了 +4 到 +17 個百分點的提升，其中絕大部分的收益來自於推論時期使用驗證器進行選取，而非來自對生成器的額外 fine-tuning。

### Quiet-STaR：逐 Token 的內部推理

Zelikman 等人（2024 年）思考：如果模型能在每個 token 位置生成短暫的內部推理，而不僅僅是在問題與最終答案之間生成，情況會如何？Quiet-STaR 訓練模型在每個預測的 token 之前發出一個隱藏的「思考」，然後透過學習得出的權重將包含思考的預測與基準預測進行混合。

成果：Mistral 7B 在未經特定任務 fine-tuning 的情況下，GSM8K 的零樣本（zero-shot）準確率從 5.9% 絕對提升至 10.9%，CommonsenseQA 則從 36.3% 提升至 47.2%。模型學會了「何時該思考」——困難的 token 會獲得較長的內部推理；簡單的 token 則幾乎不需要思考。

### 為什麼這三者都面臨共同的安全隱患

這三種方法都使用最終答案作為梯度訊號。如果一條推理過程藉由錯誤的邏輯——利用捷徑、胡亂猜測或依賴無法泛化的模式——碰巧達到了正確答案，它依然會受到正向強化。在分布內的題目上，這種捷徑確實行得通。但在一旦走出分布（out-of-distribution, OOD）的題目上，它就會無聲無息地崩潰。

V-STaR 的驗證器透過學習對推理過程進行排序來緩解此問題，但該驗證器依舊是在同一批標籤集合上訓練出來的。它可能會學會偏好格式優美但邏輯錯誤的推理，勝過坦誠自身的不確定性。更安全的架構設計是將 STaR 風格的資料與以下兩者結合：(a) 過程監督獎勵模型（針對中間步驟而非僅針對答案給予獎勵），以及 (b) 能徹底打破單純捷徑的保留 OOD 評估。

### 綜合對比

| Method | Training signal | Inference cost | Data waste | Known failure mode |
|---|---|---|---|---|
| STaR | keep (rationale, answer) if correct | 1x | discards all incorrect rationales | shortcut rationales |
| STaR + rationalization | above + correct-answer hinted retries | 1x | less | rationalized rationales may be implausible |
| V-STaR | STaR + DPO verifier from both classes | Nx (best-of-N) | minimal | verifier can reinforce confident wrongness |
| Quiet-STaR | per-token rationale + mixing weight | 1.5-3x | minimal | still answer-conditioned gradient |

### 這在 2026 年技術堆疊中的定位

STaR 已經是早期的研究。但其核心模式在 2025-2026 年隨處可見。針對可驗證數學問題進行強化學習（DeepSeek-R1、Kimi-k1.5、o1），本質上就是 STaR 以答案為條件的梯度訊號進行大規模擴展。過程獎勵模型（Lightman 等人，2023 年；OpenAI 的《Let's verify step by step》）則是過程監督的替代方案。AlphaEvolve（第 3 課）是針對程式碼的 STaR，以程式評估器替代答案標籤。Darwin Godel Machine（第 4 課）則是針對 agent 本身鷹架結構的 STaR。

理解了 STaR，這一切就都能融會貫通。它是最小可行自我改進迴圈的原型。

```figure
reflection-loop
```

## Use It｜實際應用

`code/main.py` 在一個玩具算術任務上執行模擬的 STaR 迴圈。你可以觀察到：

- 準確率如何隨著bootstrap輪次逐步攀升。
- 捷徑如何悄悄潛入：模擬器中包含了一個「偷懶（lazy）」推理類別，它有 40% 的機率碰巧得出正確答案，但泛化能力極差。觀察 STaR 是否會保留它們。
- 驗證器（V-STaR 風格）如何在推論階段發揮作用，但卻無法完全剔除訓練期間所引入的捷徑。

## Ship It｜交付成果

`outputs/skill-star-loop-reviewer.md` 能協助你在正式訓練之前，審查並檢驗所提議的自我教學推理管線。

## Exercises｜練習

1. 執行模擬器。將捷徑頻率設定為零，接著再設定為 0.4。這兩次執行在訓練分布上都達到了 >90% 的準確率，但最終準確率分歧了多少？

2. 為模擬器加入一個保留的 OOD 測試。從不同的分布中抽取問題，並在分布內與 OOD 測試集上評估拔靴後的模型。將兩者之間的差距量化出來。

3. 閱讀 Quiet-STaR 論文（arXiv:2403.09629）第 3 節。分別用三句話解釋「思考結束（end-of-thought）」token 與混合權重輸出頭（mixing-weight head）。

4. 將 STaR 的「正確即保留」過濾機制與獨立獎勵每個推理步驟的過程監督替代方案進行比較。評估兩者在標註成本上的差異以及合理的品質差距。

5. 設計一項評估機制，用以捕獲已部署模型中的捷徑推理。它不必十全十美——但必須能夠打破 STaR 迴圈所強化的最基本捷徑。

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|---|---|---|
| STaR | "Self-Taught Reasoner" | Fine-tune on model-generated rationales that land correct answers; repeat |
| Rationalization | "Hinted retry" | Inject the correct answer and re-prompt for a rationale on problems the base model fails |
| V-STaR | "Verifier STaR" | DPO-train a verifier on both correct and incorrect rationales, use it for inference-time selection |
| Quiet-STaR | "Per-token rationales" | Generate hidden thoughts at every token position; mix with baseline prediction |
| Answer-conditioned gradient | "Outcome-based signal" | The training loop rewards final answers, not reasoning steps |
| Process reward model | "Step-level verifier" | Reward model trained on per-step correctness, not outcome — contrasts with STaR |
| Shortcut rationale | "Right answer, wrong reasoning" | A rationale that reaches the label via a non-generalizing pattern; STaR keeps these |

## Further Reading｜延伸閱讀

- [Zelikman et al. (2022). STaR: Bootstrapping Reasoning With Reasoning](https://arxiv.org/abs/2203.14465) — 原始論文。
- [Hosseini et al. (2024). V-STaR: Training Verifiers for Self-Taught Reasoners](https://arxiv.org/abs/2402.06457) — 加入用於推論時期選取的 DPO 驗證器。
- [Zelikman et al. (2024). Quiet-STaR: Language Models Can Teach Themselves to Think Before Speaking](https://arxiv.org/abs/2403.09629) — 逐 token 的內部推理。
- [Lightman et al. (2023). Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) — 過程獎勵模型，另一種梯度訊號。
- [DeepSeek-R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) — 可驗證任務上的 RL，將 STaR 擴展至尖端模型訓練。
