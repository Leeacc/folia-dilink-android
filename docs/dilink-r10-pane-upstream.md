# R10：分屏界面、窗口标题条和上游版本

## 实车依据与改动

用户确认 R9 原厂分屏有效。800×600 的旧设置页实测预览 320px、设置总区约 101px，扣除标签后只剩很小的滚动区域。现在窄窗以 2:3 分配预览和设置行；1024px 起保持左右排列；680px 以上、480px 高以下的短横窗也用左右排列。移除固定预览最低高度，标题和标签不被压缩，设置内容 min-height:0 并独立滚动。没有新增每帧状态更新。

本机编译页面检查 800×600、960×720、680×420、412×732、1920×1080，四个标签、末尾设置可访问。800×600 内容滚动区从不足 60px 增至约 195px。另以 CSS 安全边距检查顶部28px/底部24px。页面错误为0。测试使用明确的原生桥替身验证页面，不等于实际 Android/OEM 行为；真实旧内核和 APK 检查见对应 CI。

## 黑条的控制范围

R9 的多窗口分支明确 show(systemBars)。R10 取消这一恢复行为，只请求隐藏 status/navigation，保留 caption 的系统窗口管理功能；状态/导航/导航分隔线请求透明，API29+ 关闭对比色自动遮罩。安全边距不移除，避免按钮被系统栏覆盖。诊断回读实际 windowBars 属性，CI 验证颜色为透明、对比色遮罩关闭。

[Android 沉浸式文档](https://developer.android.com/develop/ui/views/layout/immersive) 将 status/navigation 与多窗口 caption 区别对待；[Window 文档](https://developer.android.com/reference/android/view/Window#setStatusBarContrastEnforced(boolean)) 解释透明栏仍可能被对比度遮罩覆盖。[Denza 作者固件记录](https://github.com/xor777/denza-lab/blob/main/docs/split-screen-findings.md) 表明另一 DiLink 固件由 DecorView 为各窗绘制 caption 并处理切换/拖动关闭。后者不是本车同版本固件，只能作为归属线索。没有使用隐藏 API、硬编码系统 View id 或反射删除车机窗口控件；不能宣称强制 caption 已透明或移除。

## 原厂音乐卡片

照片显示系统顶栏 Folia、卡片保留汽水歌曲/图标。标准 MediaSession 元数据发布、原生音频焦点、媒体按键链路已由模拟器和用户 R8 反馈分别验证，但这不能证明 BYD 卡片会选择该会话。最近 MediaBrowser 客户端包名仅为只读线索；没有该记录不能证明没有通过 MediaSession 直接读取。

本机汽水18.3.0样本的声明对比见 R9；与车机实际版本是否相同仍未知。新查 [Atto3/DiLink3反编译项目](https://github.com/adricl/byd-tablet-decompiled) 的卡片由 MediaController 选择媒体来源，但公开仓库只提供说明及框架桩，没有本车 UI7 的完整来源准入实现，不能借此猜测接口。卡片仍未解决，未伪造汽水包名、写厂商私有 Provider 或用仪表 FID 代替主页接入。

## Major、Sonnet 和动效

[Sonnet README](https://github.com/chthollyphile/folia-sonnet) 明确声明：实验 Android 打包示范，基于 Major 0.6.7，不再维护同步主仓库。我们的固定基线为5a2c3148cc78c51a5c2df15d7d0d34c120c24873，后来加入 DiLink 适配与 QQ 等功能。两者有同源关系，但现为分别维护的仓库，车机版并非实时跟随 Major。

截至2026-10-16，[Major最新正式版0.7.20](https://github.com/chthollyphile/folia-major/releases/tag/v0.7.20)，源码1b39fd868e2ddda95788f1baa839c032f3e7a285。对比 src/components/visualizer/*/entry.tsx，Major14个内置模式、当前车机10个；新版新增 lumiere（绘光）、sonnet（商籁）、still、tempera。另有 [Folium桌面模组](https://github.com/chthollyphile/folia-major/blob/main/mods/README.md)，与内置模式是两类。R8 原生播放器尚无 FFT 接入，部分频谱响应不足也不同于模式缺失。没有将新版桌面模组或整个新版主项目未经适配直接替换到车机包中。
