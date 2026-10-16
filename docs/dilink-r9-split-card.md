# R9：分屏候选与原厂媒体卡片

## 实车事实

2026-10-16 更新：用户确认 R9 已可进入 UI7 原厂分屏，且效果正常；下面发布时的“尚待实车验证”为历史状态。卡片仍显示汽水音乐，尚未修复。

2026-10-15，用户确认 R8 应用音量、方向盘音量和切歌正常。UI7 的分屏候选里不能选择 Folia；原厂主页卡片仍显示蓝牙空白信息，用户确认汽水音乐可显示。

## 分屏：有依据的最小改动

R8 只有 Android resizeableActivity，没有 BYD_SUPPORT_SPLIT_ACTIVITY 应用元数据。[Denza 作者的固件和实车记录](https://github.com/xor777/denza-lab/blob/main/docs/split-screen-findings.md) 区分普通 Android 窗口与 BYD 原厂 split placement：该固件读取 ApplicationInfo.metaData 中整数 BYD_SUPPORT_SPLIT_ACTIVITY=1，单独设置 resizeableActivity 不代表 BYD 候选准入。[iLINK 的应用适配实现](https://github.com/i99dev/ilink/blob/main/android/app/src/main/kotlin/com/i99dev/ilink/clusterpatch/ManifestPatcher.kt) 也记录同一应用级整数标记。

R9 补充该标记及 MAIN/DEFAULT 入口，保留 R8 的音频控制、任务模式及方向策略。没有使用全局窗口事务号、修改分屏开关、替换车机桌面或重写系统白名单。诊断输出打包后的 splitManifestValue；CI 从实际安装包通过 PackageManager 读取并要求值为整数 1。普通模拟器只能证明声明已正确打包和布局可缩放，不能证明该车 UI7 原厂候选列表已接纳。以上外部固件并非秦 L EV 的当前固件；此改动仍需实车验证。

## 汽水音乐样本与卡片边界

只读检查本地 Downloads/01_软件安装包/com.luna.music.apk：包名 com.luna.music，版本 18.3.0，versionCode 100183030，targetSdk 30；主入口 MAIN + LAUNCHER + DEFAULT，singleTop，方向 behind；播放服务为 MediaBrowserService/MediaSessionCompat 体系。未发现 manifest 中 BYD 专属字段或 DEX 字符串中的 BYD 媒体 SDK 包路径。未复制其代码、资源、厂商 token 或包名。用户不确定车机版是否相同，因此这些是本地样本事实，不是当前实车版的结论。

[BYDMate 作者的原厂 MediaController 调查](https://github.com/AndyShaman/BYDMate/blob/main/app/src/main/kotlin/com/bydmate/app/media/ClusterMusicCard.kt) 记录其他 DiLink 固件会按包名筛选部分播放器。[其元数据桥](https://github.com/AndyShaman/BYDMate/blob/main/app/src/main/kotlin/com/bydmate/app/media/ClusterMusicBridge.kt) 针对的是仪表卡片，不能当作主页卡片的通用注册接口；其中媒体 Provider 受签名权限保护。

汽水作为第三方可显示，足以排除“所有第三方应用都不能显示”的说法，但不足以证明任意拥有 MediaSession 的包都可显示，也不能证明它只靠某一个 Manifest 字段。当前未取得该车 MediaController/Launcher 的准入表和实际汽水版本，因此不改包名、不伪造蓝牙源、不写 FID，不声称主页卡片修复。诊断增加精确的媒体中心/控制器/桌面/汽水版本查询，便于后续对齐实际固件。

用户补充：点主页蓝牙图标后的来源列表既没有 Folia，也没有能显示卡片的汽水音乐。因此该列表不能用于判断第三方自动卡片是否受支持，不能把 Folia 未出现在此列表当作白名单拒绝的直接证据。


## R9 交付与核验

versionCode **39**，版本名 `0.6.7-dilink-r9-split`，APK 源码 `199fd34771b109f9ea20d22116126fe4069dc7ad`。[Actions 38755492502](https://github.com/Leeacc/folia-dilink-android/actions/runs/38755492502) 构建及 API 29/35 回归全部成功，60 项单测和 3 项 QQ 协议测试通过，Chromium 95 检查通过。

已同时核对编译后的二进制 Manifest 及模拟器 PackageManager：应用级 BYD_SUPPORT_SPLIT_ACTIVITY 为整数 1。API 35 的系统音量键、播放/暂停、上下曲指令、后台播放/控制、五秒隐藏、实际多窗口 412×732 无横向溢出通过；网易云播放、酷狗公开试听原生播放/跳转与 QQ 搜索/二维码检查通过。上述标准环境通过仍不能证明秦 L EV UI7 候选已经接纳 Folia，也不能证明主页卡片已经修复。

APK SHA-256：`f19990a2b2ad81c5ffcb33b93e3f3b4fc0b291c8bdf0eec324b61fa17ab06d6d`。
