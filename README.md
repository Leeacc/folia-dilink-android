# Folia for DiLink Android

面向比亚迪 DiLink 100 / UI 7.0 的长期维护 Android 适配分支。无需 Android Studio，也不需要自行部署音乐服务器；从本仓库 Releases 下载 APK。

**原项目：[chthollyphile/folia-major](https://github.com/chthollyphile/folia-major)**，作者 chthollyphile 与上游贡献者。本项目基于 **v0.7.25**，保留 AGPL-3.0 许可证及原作者版权，非比亚迪或音乐平台官方客户端。旧版 R1–R10 来自 [folia-sonnet](https://github.com/chthollyphile/folia-sonnet) 0.6.7；完整来源及提交见 [UPSTREAM.json](UPSTREAM.json)。

## 新基线

- Major 0.7.25 的完整内置前端：Bravais 资料库墙面、Lattice 播放视图、设置与主题。
- 17 种内置歌词可视化和 6 类背景，保留原设置，不删减为少数演示动效。
- 网易云、酷狗、QQ 音乐、汽水音乐通过包内服务连接；账号权限、地区及平台限制仍适用。
- Android 原生播放器、媒体音量、音频焦点、媒体会话和方向盘控制；保留 BYD 三分屏声明。
- 窄窗设置滚动、无名动效全屏、5 秒隐藏控件、多指手势、可选本机播放频谱。

汽水音乐使用上游 0.2.2 车机协议，二维码登录、搜索、推荐、歌单、歌词与明文音频均走包内服务；平台返回受保护音频时仅播放其公开提供的试听，不解密受保护资源。

桌面专用的 Electron 模组、壁纸、Discord、窗口捕获、FFmpeg 导出与本地 AI 分轨不能直接在 Android 上执行。Android 仍使用单个原生播放器，双播放器 Automix、WebAudio 均衡器与桌面输出设备选择不启用；这些限制不等于内置视觉模式缺失。详见 [维护说明](docs/MAINTENANCE.md)。

## 下载与安装

[Releases](https://github.com/Leeacc/folia-dilink-android/releases) 提供签名 APK、校验和、构建提交和上游版本。GitHub Actions 保留测试报告。源码与发布 APK 公开提供；无需 Android Studio，可从 Releases 下载覆盖安装。

迁移后的版本使用固定发布证书，以后可覆盖升级。早期 R 系列使用临时调试证书，第一次换到固定证书时如系统提示签名冲突，需要先导出设置，再卸载旧版并安装新版；旧登录状态可能需要重新扫码。

可选“原生音乐频谱”位于车机播放设置中。Android 要求录音权限以读取 **Folia 自己的播放会话**；不使用麦克风，不录音存盘，不分析其他应用。拒绝授权不会影响播放及按歌词时间运行的动效。

## 上游更新

每周检查原仓库的正式版本，有更新时尝试建立更新 PR。发生冲突会创建跟踪 issue，明确冲突文件，不自动覆盖车机适配。更新必须通过构建、单元测试、真实 Chromium 95 界面检查及 Android 播放测试后，才发布新的签名 APK。同步代码与发布应用分开进行，不会静默替换车机上已安装的软件。

## 开发与验证

Node.js 24、JDK 21、Android SDK 36.1、NDK 27.2。依赖使用锁文件；`mobile/runtime` 是独立的 Android Node.js Mobile 运行时依赖，不混用桌面原生模块。

```sh
npm ci
npm run typecheck
npm run test:unit
npm run cap:sync:android
python3 mobile/prepare.py
cd android && ./gradlew assembleDebug assembleRelease
```

签名私钥仅存于 GitHub Actions secrets 和维护者本地备份，不进入仓库。CI 先验证调试容器的原生控制与真实音乐流，同时检查同一源码的发布包签名、版本和非调试声明；发布包不开放 WebView 远程调试。

DiLink 桌面音乐卡片仍需实车确认，不能把标准 MediaSession 支持等同于厂商卡片已接纳。系统拥有的分屏标题条也可能覆盖应用的透明颜色请求。此前实车结果与排查记录保存在 `docs/dilink-r*.md`，不会冒充新版的实车验证。
