# 汽水音乐接入核查（2026-10-17）

结论：技术上存在接入路径，但目前验证到的方案还不能满足「APK 独立运行、无需电脑或服务器、完整稳定播放」的目标。本版不增加只能登录/试听的正式平台入口，也不把公开分享页的试听冒充整曲。

## 本次实测

在工作目录隔离读取 [guowenye/qishui-api](https://github.com/guowenye/qishui-api) 的客户端实现，匿名直连其公开上游；未安装到 Folia、未读取用户凭据、未扫码登录、未下载或解密歌曲。只保留字段存在性、时长和返回状态，不保存二维码 token、会话、签名音频 URL 或设备标识。

- 登录二维码可生成；这只证明发起流程可用，不证明用户确认、持久登录及账号曲库已通过。
- 未配置登录态与应用签名时，PC 搜索 `/luna/pc/search/track`、曲目 `/luna/pc/track_v2` 返回空内容，不能提供完整搜索/取流。
- 公开 H5 SEO 样本 `7079108541549643812` 有标题、歌词及音频地址。元数据原长 297240ms，`video_model.video_duration` 只有 30.047s，是试听。没有把「地址存在」记为整曲播放成功；没有测试其音频解码与车机播放。

## 可借鉴实现与实际缺口

[libresoda 客户端指南](https://github.com/sodahub-org/libresoda/blob/main/docs/CLIENT-API.md) 与 [取流说明](https://github.com/sodahub-org/libresoda/blob/main/docs/FULL-QUALITY-STREAM.md) 描述扫码、搜索、收藏、歌单及取流，但完整路径依赖匹配设备身份、逐请求应用级签名。其文档说明当前 mssdk 桥运行于 Windows/macOS，可作为外部签名服务；并没有证明把这套实现放入 Android WebView95 就能独立工作。部分媒体还需额外处理加密容器，与当前直接交给 Android MediaPlayer 的音频 URL 路径不同。

Folia 当前内置 Node 运行时可以承载普通请求逻辑，不等于能运行 Windows/macOS 签名组件。把外部签名服务地址塞入设置，也不满足用户无需部署服务的既定要求。没有采用第三方公共签名服务、硬编码外来会话或照搬受单独许可约束的官方安全组件。

后续若取得可独立在 Android 工作的签名路径，需要按 Omni 合同实现 provider、账号安全存储与内置 transport，并逐项验证：扫码确认及重启恢复、搜索、收藏/歌单、完整时长、解码与 seek、后台/方向盘/音量/歌词、失效与风控提示。在这些通过前，不宣称已接入汽水。

原厂首页卡片是另一条系统媒体来源接入链路；是否新增汽水曲库，不会自动修复 Folia 的桌面卡片注册。该问题继续跟踪 [#3](https://github.com/Leeacc/folia-dilink-android/issues/3)，仍需本车 OEM/controllerEvidence 记录。
