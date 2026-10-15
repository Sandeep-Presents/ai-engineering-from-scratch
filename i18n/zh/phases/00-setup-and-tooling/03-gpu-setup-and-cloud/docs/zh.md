# GPU 配置与云端使用

> 学习时在 CPU（中央处理器）上训练就够了。正式训练则需要 GPU（图形处理器）。

**Type:** Build
**Languages:** Python
**Prerequisites:** 第 0 阶段，第 01 课
**Time:** ~45 分钟

## 学习目标

- 使用 `nvidia-smi` 和 PyTorch 的 CUDA（NVIDIA 并行计算平台）API（应用程序编程接口）验证本地 GPU 是否可用
- 为 Google Colab 配置 T4 GPU，免费开展云端实验
- 对 CPU 和 GPU 上的矩阵乘法进行基准测试（benchmark），测量加速比
- 根据 fp16（半精度浮点）的经验法则，估算 VRAM（显存）能够容纳的最大模型

## 要解决的问题

第 1-3 阶段的大多数课程都可以在 CPU 上顺利运行。但一旦在第 4+ 阶段开始训练卷积神经网络（CNN）、Transformer 或大语言模型（LLM），就需要 GPU 加速。在 CPU 上需要 8 小时的训练，在 GPU 上只需 10 分钟。

你有三种选择：本地 GPU、云端 GPU，或 Google Colab（免费）。

## 核心概念

```text
Your options:

1. Local NVIDIA GPU
   Cost: $0 (you already have it)
   Setup: Install CUDA + cuDNN
   Best for: Regular use, large datasets

2. Google Colab (free tier)
   Cost: $0
   Setup: None
   Best for: Quick experiments, no GPU at home

3. Cloud GPU (Lambda, RunPod, Vast.ai)
   Cost: $0.20-2.00/hr
   Setup: SSH + install
   Best for: Serious training, large models
```

```figure
s0-gpu-dispatch
```

## 动手实现

### 方案 1：本地 NVIDIA GPU

检查你是否有 NVIDIA GPU：

```bash
nvidia-smi
```

安装支持 CUDA 的 PyTorch：

```python
import torch

print(f"CUDA available: {torch.cuda.is_available()}")
print(f"CUDA version: {torch.version.cuda}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
```

### 方案 2：Google Colab

1. 访问 [colab.research.google.com](https://colab.research.google.com)
2. 依次选择 Runtime（运行时）> Change runtime type（更改运行时类型）> T4 GPU
3. 运行 `!nvidia-smi` 进行验证

将本课程的笔记本（notebook）直接上传到 Colab。

### 方案 3：云端 GPU

对于 Lambda Labs、RunPod 或 Vast.ai：

```bash
ssh user@your-gpu-instance

pip install torch torchvision torchaudio
python -c "import torch; print(torch.cuda.get_device_name(0))"
```

### 没有 GPU？没关系。

大多数课程都能在 CPU 上运行。需要 GPU 的课程会明确说明，并提供 Colab 链接。

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using: {device}")
```

## 动手实现：GPU 与 CPU 基准测试

```python
import torch
import time

size = 5000

a_cpu = torch.randn(size, size)
b_cpu = torch.randn(size, size)

start = time.time()
c_cpu = a_cpu @ b_cpu
cpu_time = time.time() - start
print(f"CPU: {cpu_time:.3f}s")

if torch.cuda.is_available():
    a_gpu = a_cpu.to("cuda")
    b_gpu = b_cpu.to("cuda")

    torch.cuda.synchronize()
    start = time.time()
    c_gpu = a_gpu @ b_gpu
    torch.cuda.synchronize()
    gpu_time = time.time() - start
    print(f"GPU: {gpu_time:.3f}s")
    print(f"Speedup: {cpu_time / gpu_time:.0f}x")
```

## 练习

1. 运行上面的基准测试，比较 CPU 与 GPU 的耗时
2. 如果你没有 GPU，就在 Google Colab 上运行并比较
3. 检查你有多少显存，并估算能够容纳的最大模型（经验法则：fp16 的每个参数占用 2 字节）

### 提示

**练习 1。** 原样运行“动手实现”部分中的代码，记下 CPU 耗时、GPU 耗时以及加速比。再运行一次；首次 GPU 运行包含启动开销，因此应使用第二次的结果进行比较。

**练习 2。** 在 Colab 中，依次选择 Runtime（运行时）> Change runtime type（更改运行时类型）> GPU，然后将基准测试代码粘贴到一个单元格中。先在另一个单元格中运行 `!nvidia-smi`；只有显示出 GPU 名称，基准测试结果才有意义。

**练习 3。** 按照 `code/gpu_check.py` 中的方式，使用 `torch.cuda.get_device_properties(0).total_memory / 1e9` 读取显存总量。将以字节为单位的显存容量除以 2，就能得到 fp16 参数的数量，然后留出余量，因为激活值和 CUDA 上下文也会占用显存。

## 关键术语

| 术语 | 常见说法 | 实际含义 |
|------|----------------|----------------------|
| CUDA | “GPU 编程” | NVIDIA 的并行计算平台，让你能在 GPU 上运行代码 |
| VRAM | “GPU 显存” | GPU 上的显存，与系统 RAM（内存）分开。它限制了模型的大小。 |
| fp16 | “半精度” | 16 位浮点数，占用的内存为 fp32（单精度）的一半，准确度损失很小 |
| Tensor Core（张量核心） | “高速矩阵运算硬件” | 专门用于矩阵乘法的 GPU 核心，速度比常规核心快 4-8 倍 |
