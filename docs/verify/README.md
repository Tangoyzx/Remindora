# 验证留痕截图

按实现进度保存到本目录（文件名固定）。腾讯云控制台与 API Explorer 截图必须打码，不得出现 `SecretId` / `SecretKey`。

| 文件 | 内容 |
| --- | --- |
| `01-asr-console.png` | 语音识别控制台，一句话识别已开通 |
| `02-tts-console.png` | 语音合成控制台，服务已开通且免费资源包已领取 |
| `03-asr-explorer.png` | API Explorer 调用 SentenceRecognition，可见中文 Result |
| `04-tts-explorer.png` | API Explorer 调用 TextToVoice，Codec=mp3，可见 RequestId 与 Audio |
| `05-text-ingest.png` | 本机 POST /v1/ingest/text 的 JSON，含解析出的待办 |
| `06-briefing-cached.png` | 同一天第二次 GET /v1/briefing/today，ETag 与第一次相同 |
| `07-cache-unchanged.png` | 生成缓存后再文本录入，ETag 仍不变 |
| `08-wav-ingest.png` | 上传 WAV 后的 JSON，含转写与入库结果 |

控制台步骤需要腾讯云登录；未登录时由操作者登录后再截。
