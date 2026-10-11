# Folia for DiLink — 横屏测试版

面向 2025 款秦 L EV / DiLink 100 UI 7.0 的实验性 APK。保留 Folia-Sonnet 原版界面，仅配置横屏和自动构建；尚未在真实车机验证，不是官方 Android 客户端。

## 下载 APK（无需 Android Studio）

1. 登录拥有本私有仓库权限的 GitHub 账号，打开 [Actions](https://github.com/Leeacc/folia-dilink-android/actions/workflows/android-apk.yml)。
2. 打开最新成功的 **Build DiLink test APK** 运行。
3. 在 **Artifacts** 下载 **folia-dilink-test-apk**，解压得到 `folia-dilink-test.apk`。
4. `SHA256SUMS.txt` 是 APK 校验值；`apk-info.txt` 和 `signature.txt` 是包信息与签名校验记录。

产物保留 30 天，过期可点击 **Run workflow** 重建。`android-29-smoke-test` 和 `android-35-smoke-test` 包含模拟器启动截图和日志；模拟器测试不等于车机兼容性验证。

## 来源与实际版本

- 源码：[`chthollyphile/folia-sonnet`](https://github.com/chthollyphile/folia-sonnet)，固定提交 `5a2c3148cc78c51a5c2df15d7d0d34c120c24873`，基于 **Folia 0.6.7**。
- 对照检查的主项目 [`chthollyphile/folia-major`](https://github.com/chthollyphile/folia-major) 最新正式 release 为 **v0.7.16**；本 APK 不冒充该版本，也未将新版桌面代码混入 Android 示例。
- 原 README 保存在 [README.upstream.md](README.upstream.md)，来源记录见 [UPSTREAM.json](UPSTREAM.json)。保留上游源码、资源和 AGPL-3.0 [许可证](LICENSE)。

## 本仓库的改动

- 主 Activity 固定为 landscape，保留原版界面与原图标。
- 独立安装包 ID：`io.github.leeacc.folia.dilink`，不覆盖上游 `top.izuna.foliamajor`。
- 版本名 `0.6.7-dilink-wv95-r2`；CI versionCode 使用运行编号。
- 工作流使用 Node 24、JDK 21、Capacitor 8.4.2、AGP 8.13.0、Gradle 8.14.3、Android Platform 36.1；最低 Android 7 / API 24，target API 36。**显示原版 UI 还要求 Android System WebView 95+**，最低安装版本不等于最低可用 WebView 版本。
- 移除上游桌面发布及 Docker 发布工作流，仅保留本仓库 Android 构建流程。保留原版组件和布局，补充 Android 系统栏处理及登录失败提示；构建目标明确为 Chrome/WebView 95，低于此版本显示独立兼容性提示页，避免黑屏。
- macOS/Linux 构建脚本使用 Gradle shell wrapper；Windows 可在同步后执行 `android\gradlew.bat`。

上游根 README 的 Node 20+/JDK 17 提示与实际源码要求不一致；以以上工程版本为准。

## 功能边界与后端

这是可安装的界面/前台播放测试包，不包含音乐服务端。未配置后端时，在线音乐登录、搜索或播放可能不可用；本地音乐扫描在上游 Android 示例中不受支持。后台保活、锁屏播放、方向盘按键、车机媒体中心接入都不在本次范围。

可在 **Settings → Secrets and variables → Actions → Variables** 设置以下可选的公开 HTTPS 服务地址，然后重新运行工作流：

- `VITE_NETEASE_API_BASE`：自行部署的网易云 API。
- `VITE_KUGOU_API_BASE`：自行部署的酷狗 API。
- `VITE_FOLIA_API_BASE`：自行部署的 Folia AI / 歌词代理 API，通常以 `/api` 结尾。

这些值会打包进 APK，不能填入 API 密钥。AI 密钥仅放在你自己的服务端。本项目不会自动部署后端或使用你的音乐账号。Navidrome 也需要可访问的 HTTPS 服务。

## 车机验证

停车后，使用车机允许的安装方式安装。依次记录：是否允许安装、是否横屏启动、界面和歌词动画是否显示、配置自己的服务后是否能够前台播放。UI 7.0 名称不能证明具体 Android API 或 WebView 版本；若不能安装或白屏，请记录车机 Android/WebView 版本及错误信息。

这是 debug 签名 APK；不同 CI 构建可能使用不同调试证书。如果后续覆盖安装提示签名不一致，需先卸载旧测试版（会清除应用数据）。不用于正式商店分发。

## 手动重建

```sh
npm ci
npm run cap:sync:android
cd android
bash gradlew assembleDebug
```

需要上述 Node/JDK/SDK 工具链。CI 会先运行 Android 平台与 API 路由单测，再构建 Web 资源和 APK，校验签名、包名、最低系统版本、横屏声明及内置页面，并在 API 29/31 模拟器验证旧 WebView 提示页、API 35 模拟器验证原版页面实际渲染；全部检查横屏与系统栏隐藏。

## DiLink WebView 95 兼容构建

依据车机反馈的 Android 12 / WebView 95.0.4638.74，脚本目标调整为 Chrome 95。构建阶段转换 CSS cascade layers、颜色格式及独立变换属性，保持原组件和布局；部分动态混色在旧内核中使用兼容回退。CI 使用真实 Chromium 95 检查首页、设置交互、透明颜色和位移样式，Android 模拟器继续验证 APK 安装和横屏。浏览器测试不等于实际车机 WebView 完整验证。

动画库动态注入的 CSS 无法经过构建转换，`public/webview95.css` 在旧内核下补充等价的画布铺满规则；CI 还检查画布与其容器的实际尺寸。

## r2：全屏与登录问题

- 原生 Activity 请求隐藏状态栏和导航栏，返回应用时恢复全屏；允许手势临时唤出系统栏。
- 若厂商系统保留系统栏，使用系统报告的可见区域为 WebView 留出边距。DiLink 自定义栏是否允许隐藏仍须实车验证；普通应用无法保证隐藏厂商强制保留的栏。
- 安装包已有 INTERNET 权限。网易云和酷狗需要可用的服务地址，未配置时不会产生登录二维码；网易云现在明确显示缺少音乐服务，不再误显示持续加载。
- 二维码请求超过 15 秒显示连接失败；错误状态不再显示旋转图标。
- 桌面程序使用 Node 音乐 API；Capacitor 不包含该桌面进程。QQ 音乐在较新 folia-major 中实现，当前 0.6.7 Android 示例没有 QQ provider，也没有 QQ 服务端配置。
- 未提供服务地址时，在线登录和播放问题尚未解决，本版只修复全屏处理和错误呈现。

Capacitor 8.4.2 的 Cordova 生命周期转发在启动早期或独立错误页上可能先于网页桥接执行；postinstall 脚本为该调用添加初始化判断，避免 triggerEvent 未定义报错。依赖源码改变时补丁会明确失败，要求重新审查。
