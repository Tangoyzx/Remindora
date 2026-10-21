# 验证截图状态

记录时间：实现阶段自动检查。

## 阻塞

打开 [腾讯云语音识别控制台](https://console.cloud.tencent.com/asr) 时被重定向到登录页：

`https://cloud.tencent.com/login?s_url=https%3A%2F%2Fconsole.cloud.tencent.com%2Fasr`

证据截图：`00-tencent-login-blocker.png`

按规划：**未登录时停下来交由操作者登录，不改用其他云厂商。**

因此下列截图尚未生成：

| 文件 | 状态 |
| --- | --- |
| `01-asr-console.png` | 等待腾讯云登录 |
| `02-tts-console.png` | 等待腾讯云登录 |
| `03-asr-explorer.png` | 等待腾讯云登录 |
| `04-tts-explorer.png` | 等待腾讯云登录 |
| `05-text-ingest.png` | 需本机 `npm start` + `.env` 密钥后跑 `node scripts/verify-local.mjs` |
| `06-briefing-cached.png` | 同上 |
| `07-cache-unchanged.png` | 同上 |
| `08-wav-ingest.png` | 同上，并设置 `REMINDORA_VERIFY_WAV` |

清单说明见 [README.md](./README.md)。本地自动化脚本：`scripts/verify-local.mjs`。

## 已完成（代码侧）

- 待办 JSON 库与日期展开（单元测试通过）
- 文本 / 音频共用入库
- 腾讯云 ASR / TTS 适配器
- 当天播报缓存不刷新（单元测试通过）
- 独立进程入口（Harness 可不在本机）
- Cordis 插件入口（装到远程 Harness）
