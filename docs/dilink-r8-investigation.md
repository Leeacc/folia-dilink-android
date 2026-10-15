# R8：按 R7 实车失败重新核查

## 实车反馈优先于模拟器

用户确认 R7 浮名全屏、按钮隐藏正常；方向盘/音量控制、原厂桌面卡片和分屏失败，启动音量过大。R7 的 Android 29/35 通过记录仅证明标准接口可工作，不能证明 DiLink 100 已兼容。

## 本轮有依据的改动

- R7 的音频实际来自 WebView/Web Audio，原生 MediaSession 仅发布状态。R8 把实际音轨移到平台 `android.media.MediaPlayer`，使用 `STREAM_MUSIC` 对应的音频属性，由同一原生应用申请媒体音频焦点。页面保留播放器接口和歌词时钟，不再创建竞争的 Web Audio 输出。
- 原生准备完成、播放状态、位置、暂停、结束和错误回传原界面；音频 blob 缓存通过有大小限制的分块写入应用私有缓存，不丢弃已有音乐缓存。
- 第一次进入原生播放将应用增益限制到 20%，后续记住用户值，播放器创建后、开始播放前即设置增益。不在启动时写全车媒体音量。
- 增加显式 `MEDIA_BUTTON` 接收器、比亚迪设备上的旧式 `RemoteControlClient`、键码 353；现代 MediaSession 继续提供显式播放/暂停指令。厂商硬件 PLAY/PAUSE 在 BYD 上按切换处理，以免车机自身的错误播放状态造成按键无效。不会拦截电话/语音/空调按键。
- 移除所有运行时 `setRequestedOrientation`。窗口由车机决定方向，保留可调整尺寸和系统安全边界；模拟器测试自行旋转屏幕，不再靠锁横屏证明分屏兼容。
- 诊断增加真实引擎、音频焦点、原生增益、音频会话、请求方向、旧式媒体注册状态及只读 OEM 能力检查。

## 厂商卡片的边界

旧版公开 `BYDAutoMultimediaDevice` 提供获取原厂媒体类型/状态和控制原厂来源的方法，未发现它提供把任意第三方应用注册为原厂桌面播放器的通用接口。不能把调用 `controlMedia` 切换原厂蓝牙/USB 当作 Folia 注册成功。

已有 DiLink 项目为厂商元数据和按键路由使用另外的授权 helper。仪表音乐信息的 FID 写入也不等于原厂桌面卡片接入。R8 不写未经当前车机确认的 FID、不伪装原厂包名，也不绕过签名权限。

因此 R8 增加合法的 Android 新旧媒体协议与实际焦点归属，并提供厂商类/Provider 存在性与权限证据；**尚不能声称原厂 DiLink 100 音乐卡片或分屏入口已实车修复**。如仍失败，需要此车的诊断信息，必要时取得用户授权的设备日志/厂商 SDK 接入资料，而不是重复普通模拟器测试。

## 核查来源（2026-10-15）

- [Android 音频焦点规则](https://developer.android.com/media/optimize/audio-focus)
- [Android RemoteControlClient](https://developer.android.com/reference/android/media/RemoteControlClient)
- [Android MediaSession](https://developer.android.com/reference/android/media/session/MediaSession)
- [比亚迪公开 API V1.0.5](https://oip.byd.com/uploads/20210824/46cd2d7c2e878b0a1c6b066967e7f6fd.pdf)：旧版文档，不能当作当前 UI7 接入保证。
- [DiPlay 的音频焦点与媒体键实现](https://github.com/programmerguohuajing/DiPlay-Legacy-Android/blob/main/common/src/main/java/com/shilapi/xcertplay/CarPlayMediaKeys.kt)
- [比亚迪 353 键码记录](https://github.com/programmerguohuajing/DiPlay-Legacy-Android/blob/main/shared/src/main/java/com/shilapi/xcertplay/airplay/CarPlayMediaButton.kt)
- [BYD Extend 权限与媒体 helper 说明](https://github.com/sunlixWhyNotAvailable/byd-turnsignal-cameraview#which-functions-need-adb)

上述外部项目用于核查协议及限制；本轮原生播放器和桥接代码独立实现，未复制无许可证项目的实现。
