# Folia for DiLink — 横屏测试版

面向 2025 款秦 L EV / DiLink 100 UI 7.0 的实验性 APK。保留 Folia-Sonnet 主要界面，内置网易云、酷狗与 QQ 音乐服务。车机已确认 R5 的网易云/酷狗登录、搜索、播放和歌词可用，新增车机控制仍需实车复测；不是官方 Android 客户端。

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

- 不再锁定窗口方向，允许车机多窗口调整尺寸，保留原版界面与原图标。
- 独立安装包 ID：`io.github.leeacc.folia.dilink`，不覆盖上游 `top.izuna.foliamajor`。
- 版本名 `0.6.7-dilink-r8-native`；CI versionCode 使用运行编号。
- 工作流使用 Node 24、JDK 21、Capacitor 8.4.2、AGP 8.13.0、Gradle 8.14.3、Android Platform 36.1；最低 Android 8 / API 26，target API 36。**显示原版 UI 还要求 Android System WebView 95+**，最低安装版本不等于最低可用 WebView 版本。
- 移除上游桌面发布及 Docker 发布工作流，仅保留本仓库 Android 构建流程。保留原版组件和布局，补充 Android 系统栏处理及登录失败提示；构建目标明确为 Chrome/WebView 95，低于此版本显示独立兼容性提示页，避免黑屏。
- macOS/Linux 构建脚本使用 Gradle shell wrapper；Windows 可在同步后执行 `android\gradlew.bat`。

上游根 README 的 Node 20+/JDK 17 提示与实际源码要求不一致；以以上工程版本为准。

## 功能边界与后端

Android 已内置网易云、酷狗与 QQ 音乐 API，**无需部署音乐服务器或填写服务地址**。R8 使用原生 MediaPlayer 播放实际音轨、申请音频焦点，并提供标准 Android 媒体会话、媒体浏览服务、播放通知和前台播放服务，向系统提供曲名、歌手、专辑、封面、播放状态与进度，接收播放/暂停、上一曲/下一曲和进度跳转。物理音量与手势使用系统媒体音量。实际 DiLink 100 方向盘按键路由、桌面媒体源选择和分屏入口受车机系统控制，必须实车验证；没有使用未经确认的厂商私有接口。

这是实验性 APK，不含本地音乐扫描、Android Auto、CAN 车辆控制或仪表盘专用协议。后台服务能降低被系统回收的概率，不能保证厂商系统永不清理进程。

网页部署仍可配置 `VITE_NETEASE_API_BASE`、`VITE_KUGOU_API_BASE`；Android 版优先调用包内服务，不依赖这些变量。AI/通用歌词代理和用户自己的 Navidrome 仍是独立可选功能，不是网易云/酷狗登录的前提。不要将 API 密钥放入公开构建变量。

## 车机验证

停车后，使用车机允许的安装方式安装。依次记录：是否允许安装、是否横屏启动、界面和歌词动画是否显示、网易云扫码是否出现、酷狗歌单是否能前台播放、能否返回选歌页。UI 7.0 名称不能证明具体 Android API 或 WebView 版本；若不能安装或白屏，请记录车机 Android/WebView 版本及错误信息。

这是 debug 签名 APK；不同 CI 构建可能使用不同调试证书。如果后续覆盖安装提示签名不一致，需先卸载旧测试版（会清除应用数据）。不用于正式商店分发。

## 手动重建

```sh
npm ci
npm run cap:sync:android
python3 mobile/prepare.py
cd android
bash gradlew assembleDebug
```

需要上述 Node/JDK/SDK 工具链。CI 会先运行 Android 平台与 API 路由单测，再构建 Web 资源和 APK，校验签名、包名、最低系统版本、横屏声明及内置页面，并在 API 29 模拟器验证旧 WebView 提示页、API 35 模拟器验证原版页面实际渲染；全部检查横屏与系统栏隐藏。

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

## r3：内置音乐服务（无需部署服务器）

Android 包内置 Node.js Mobile 18.20.4 和电脑版使用的网易云、酷狗 API 库。运行时仅监听本机回环地址，使用每次启动生成的随机令牌；页面经原生桥调用，不需要填写外部服务地址，不向局域网开放服务。首次启动需要解压运行文件。

此版最低 Android 8 / API 26，包含 ARM64、ARMv7 和 x86_64。网络仍然需要可访问网易云/酷狗，实际账号授权必须由用户扫码确认。没有自动登录用户账户。QQ provider 尚未移植，本次接通当前界面已有的网易云和酷狗。

Node.js Mobile 为官方 v18.20.4 固定发布包；依赖按 mobile/runtime/package-lock.json 安装。mobile/prepare.py 打包生产依赖，保留库许可证。相比 r2 安装包与占用空间会增大。电脑 Node 上的真实网易云/酷狗 QR key 和 PNG 生成已验证；CI 另检查 Android 原生桥和内置二维码生成，并记录真实网络 key 请求结果（远端服务不可达时不冒充成功）。

## r4：车机登录、音频与返回操作

- 网易云依赖的临时文件目录固定到应用私有存储，避免 Android 环境下读取不存在的 `/tmp/anonymous_token`。
- 远程音频经过同源原生流式通道，保留 Range 请求和响应，HTTP 音乐链接尝试使用 HTTPS；不关闭整个 WebView 的安全检查。
- Android 播放页常驻“返回选歌”按钮，不依赖鼠标悬停。
- CI 检查 Android 内实际 QR key 请求、返回按钮点击、测试音频开始播放及跳转进度。真实账号扫码和账号歌单播放仍需要车机验证。

## r5：真实音乐流播放与控件居中

- 网易云 `/song/url/v1` 在包内使用库支持的 eapi 协议，修复未初始化 xeapi 公钥导致取不到音频地址的问题；不启用解锁或绕过会员权限。
- Android 保留平台返回的原始音乐链接。酷狗公开试听链接实测 HTTP 返回音频，强制 HTTPS 会连接失败；原生通道现在仅对明确列出的音乐域名允许 HTTP。
- 播放地址接口出错不再被吞掉并当作“已下架”；取不到地址的提示改为“暂未取得播放地址”。
- 播放控件采用左右边界与自动外边距居中，避免动画变换覆盖 CSS 平移后偏到右下角。
- CI 使用网易云 API 返回的实际音频及酷狗公开试听流检查播放、进度跳转。酷狗试听只用于验证音频传输，不代表用户账号的完整歌曲授权。
- 本轮模拟器检查 API 29 与 35；API 31 曾连续启动超时，车机 Android 12 本轮仍需实际验证。


## r6：QQ 音乐 Android 接入

- QQ 音乐列入现有平台切换与账号入口；使用手机 QQ 音乐 App 扫码确认。支持账号歌单、我喜欢、歌曲搜索、专辑/歌手、歌词和授权音频链接，统一通过 Omni 调用。
- 内置与 Folia Major 电脑版同版本的 `@yakult-green-tea/qq-music-api@3.1.4`，维持 QQ 扫码需要的 MQTT/WSS 连接，不需要外部服务器。未采用仅支持微信扫码的无中继 Serverless 入口。
- Node 18 补充 Web Crypto 全局入口以兼容设备初始化。QQ 原始凭据和设备状态保存在应用私有目录，会话文件加密；页面仅保存不透明会话令牌。关闭/刷新二维码会释放旧扫码会话。
- QQ 库的 CGI 搜索因 `new_json=1` 静默返回空列表；内置桥改为实测有效的 `new_json=0`，CGI 网络失败再尝试 Desktop RPC。后者实测偶发返回 2001，不作为唯一搜索路径；两种结构均保留 songmid/mediaMid，供后续取播放地址使用。
- 已通过本机真实扫码生成/等待、搜索接口及单元测试。CI 进一步检查 Android 原生桥搜索与真实二维码显示，同时保留网易云/酷狗播放与进度跳转回归检查。最终 CI 结果以对应 Actions 运行记录为准。
- 私人账号歌单和扫码后的 QQ 完整歌曲播放必须由用户实测；没有使用用户凭据验证，也不保证所有版权歌曲或会员音质可播。
- CI 测试签名每次可能不同，覆盖安装提示签名冲突时，需要卸载旧测试包再安装，会清除账号和设置。


r6 验证记录：[Actions 38681770840](https://github.com/Leeacc/folia-dilink-android/actions/runs/38681770840) 已全部通过，APK versionCode 26，源码提交 `9b21a89`。包括 51 项路由/平台/账号单测、3 项 QQ 搜索协议测试、Chromium 95 界面、API 29 旧 WebView 提示、API 35 实际 QQ 搜索与二维码显示，以及网易云测试曲/酷狗公开试听的播放和进度跳转。尚未扫码验证 QQ 私人账号歌单和完整歌曲播放；API 31 本轮未运行，车机仍需实测。

## r7：DiLink 100 媒体控制、沉浸与分屏适配

- 原生 Android `MediaSession` + `MediaBrowserService`：发布当前歌曲信息，接收系统媒体控制与实体媒体按键；播放时显示媒体通知并保持前台服务，返回桌面可继续播放。WebView 保持音频焦点所有权，避免双重申请打断歌曲。
- Activity 物理音量键指向 `STREAM_MUSIC`。手势调节同一系统媒体音量，不再只改变网页内增益；厂商固定音量策略仍可能限制调节。
- 播放页 5 秒无操作自动隐藏返回、播放器与侧边按钮，点击屏幕唤回；暂停、设置或面板打开时保留操作入口。拖动进度条时持续计入操作。
- **设置 → 播放 → 车机播放与手势**：可分别指定单指/双指/三指或关闭左右切歌、上下音量。默认单指左右切歌、双指上下音量，左滑下一曲、右滑上一曲、上滑增大音量。系统若拦截三指，应用无法收到该手势。
- 修复“浮名”画布平移被动画覆盖后只占右半屏；窄窗口自动缩放并居中当前歌词块，保留宽屏的原有镜头跟随。
- Activity 允许调整尺寸，进入分屏后解除固定横屏并保留系统窗口边界，退出分屏恢复横屏沉浸。模拟器自由窗口与 DiLink 专用分屏入口不是同一功能，需分别验证。
- 默认启用车机均衡画质：浮名画布像素比上限 1、重绘上限约 30 帧；潜影背景限制像素预算并避免双重动画循环，页面不可见时停止相关绘制。可在上述设置关闭均衡画质。未测量实车帧率，不声称固定幅度的性能提升。
- 设置内可查看安全的媒体诊断信息（系统、机型、窗口、媒体会话、音量），不采集车辆识别码、电话或账户凭据。

R7 保留 R5 已由用户确认有效的网易云/酷狗播放通道以及 R6 的 QQ 接入。QQ 私人账号歌单和完整歌曲授权仍需用户扫码验证。

R7 交付：versionCode **32**，版本名 `0.6.7-dilink-r7-car`，APK 源码提交 `6dddc287a43874f22b75c68f3724dda7a6f608f1`，由 [构建 38705223719](https://github.com/Leeacc/folia-dilink-android/actions/runs/38705223719) 生成。55 项单测、QQ 搜索协议回归与 Chromium 95 界面检查通过；[复核 38707121764](https://github.com/Leeacc/folia-dilink-android/actions/runs/38707121764) 使用同一 APK，修正测试收尾方式后完成 API 29/35 检查。

API 35 实测通过：网易云真实测试曲、酷狗公开试听的播放与进度跳转，QQ 搜索与二维码，系统媒体音量键，系统播放/暂停，上一曲/下一曲事件进入应用，五秒隐藏，返回桌面后音频进度继续，后台暂停/恢复，实际进入多窗口（412×732，无页面横向溢出）。上下曲的具体歌曲切换另以浏览器两首音频替身验证，未把单曲模拟器队列当作切换到另一首歌曲的证据。原厂 DiLink 桌面媒体源、方向盘路由、专用分屏入口和真实帧率仍需实车验证。

APK SHA-256：`5935633a30267cf69df4113472fec83fe5d82fa9be69e0934d81dbe01ba53001`。

## r8：原生音轨与实车问题复核

用户实车确认 R7 全屏、浮名与按钮隐藏有效，但媒体实体控制、分屏入口及原厂卡片仍失败；应用音量在 5% 左右已听起来饱和。R8 移除 WebView/Web Audio 实际出声路径，改用 Android MediaPlayer，应用增益直接作用于原生音轨，不再叠加网页 ReplayGain。首次升级上限 20%，以后记住用户设置，启动不写系统媒体音量。

增加新旧媒体键协议、BYD 353 键码及原生音频焦点；移除运行时横屏锁定。详细依据、诊断字段和厂商卡片限制见 [R8 调查记录](docs/dilink-r8-investigation.md)。普通模拟器不能证明方向盘路由、原厂卡片和 DiLink 分屏入口已修复。

原生音轨保留歌词时钟与时间驱动动画；本轮尚未接入原生 FFT，因此依赖实时频谱的声学响应暂不可用。没有增加麦克风权限。
