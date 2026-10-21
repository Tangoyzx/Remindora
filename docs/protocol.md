# Remindora 设备 / 调用方协议

Harness 可部署在远程主机。本协议描述插件暴露的 HTTP 接口；调用方可以是以后的 ESP 固件，也可以是 curl 或其他录入途径。

默认监听：`0.0.0.0:3090`（环境变量 `REMINDORA_HOST` / `REMINDORA_PORT`）。

所有业务接口需要：

```http
Authorization: Bearer <REMINDORA_TOKEN>
```

时区默认 `Asia/Shanghai`（`REMINDORA_TIMEZONE`）。

## GET /v1/health

无需鉴权。返回服务状态与本地「今天」日期。

## POST /v1/ingest/text

其他途径的文本录入。

```json
{ "text": "明天提醒我带英语书", "source": "optional-source" }
```

`source` 缺省为 `text`。成功时 `200`，解析失败 `422`。响应含 `transcript` 与 `todo` 或 `error`。

不刷新当天已生成的播报缓存。

## POST /v1/ingest

整段 WAV 上传（16 kHz、16 bit、单声道，最长约 20 秒）。`Content-Type: audio/wav`。

插件用腾讯云一句话识别转写后，进入与文本相同的解析入库函数。`source` 记为 `audio`。响应为 JSON，不返回音频。

## GET /v1/briefing/today

返回当天那一份 `audio/mpeg`。当天第一次请求才合成；之后同一天返回同一文件（即使又录入了新待办）。

响应头：

- `ETag`
- `X-Briefing-Date: YYYY-MM-DD`
- `Content-Length`

请求可带 `If-None-Match`；未变时返回 `304`。

## GET /v1/todos?date=YYYY-MM-DD

列出命中该本地日期的待办。`date` 缺省为今天。

## PATCH /v1/todos/:id

修正待办：`title` / `status` / `dueDate` / `weekdays` / `kind`。

## 远程 Harness 安装

在**运行 Harness 的那台机器**上：

```sh
dsh plugin --profile web add file:/absolute/path/to/remindora
# 配置 REMINDORA_* / DEEPSEEK_* / TENCENT_* 后重启 dsh web
```

本机没有 Harness 时，用独立进程：

```sh
cp .env.example .env   # 填密钥
npm start
```
