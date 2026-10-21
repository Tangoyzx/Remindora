# Remindora

DeepSeek Harness 待办音频插件：从**文本或整段音频**录入生活待办，并按本地日期生成**每天一份**播报 MP3。

DeepSeek Harness **不必在本机**。常见部署是 Harness 在远程机器上跑；本仓库因此同时支持：

1. **独立进程**（本机开发、或本机只跑 Remindora API）：`npm start`
2. **Cordis 插件**（拷到 / 安装到远程 Harness 主机）：`dsh plugin --profile web add file:...`

独立进程与插件共用同一套 HTTP 协议（见 `docs/protocol.md`）。Agent 工具仅在插件模式（远程 Harness 已装 `@deepseek-ai/dsh-tools`）下注册。

## 功能

- `POST /v1/ingest/text`：文本录入
- `POST /v1/ingest`：整段 WAV → 腾讯云一句话识别 → 同一解析入库
- `GET /v1/briefing/today`：当天播报 MP3（当天只合成一次，新增待办不刷新）
- Agent 工具（仅在 Harness 插件模式下）：`remindora_add_text` / `remindora_list` / `remindora_update`

待办存 JSON；日期展开与缓存判断由插件代码完成，不交给模型重判。

## 准备

- Node.js ≥ 20
- **插件模式（推荐）**：复用 Harness Settings 里已配置的默认模型与凭据（`ctx.llm` + `agentDefaultModel`），不必再单独配 `DEEPSEEK_API_KEY`
- **独立进程**：需要 OpenAI 兼容的 `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL`
- 腾讯云 SecretId / SecretKey（ASR/TTS：[一句话识别](https://cloud.tencent.com/document/product/1093/35646) + [基础语音合成](https://cloud.tencent.com/document/product/1073/37995)）

```sh
npm install
cp .env.example .env
# 编辑 .env
npm test
npm start
```

协议细节见 [docs/protocol.md](docs/protocol.md)。验证截图清单见 [docs/verify/README.md](docs/verify/README.md)。

## 装到本机 / 远程 Harness

```powershell
npm run build
dsh plugin --profile web add "D:\AIWorkSpace\Remindora"
```

插件模式下，待办解析走 Harness 默认模型（你当前为 `tencent-api` / `deepseek-v4-pro-ioa`）。可选覆盖：

- `REMINDORA_LLM_PROVIDER`
- `REMINDORA_LLM_MODEL`

ASR/TTS 与设备 token 仍放在仓库 `.env` 或 `%USERPROFILE%\.dsh\remindora.env`。

然后重启：

```powershell
dsh web --no-open
```

成功时日志会出现：

- `[remindora] listening on http://127.0.0.1:3090`
- `[remindora] agent tools registered`

Harness UI 仍在 `3080`；Remindora HTTP 在 `3090`。
