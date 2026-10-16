# Major 车机快捷菜单与卡片排查

用户实车确认 Major 首版的分屏黑条已消失、其余主要功能正常；只有桌面音乐卡片不显示 Folia，卡片按钮也不控制 Folia。方向盘和应用内控制正常。此结论不能倒推出厂商采用了哪一种白名单。

快捷菜单来自共享 WallToolsSurface，原设计为 296px 宽、6 列纯图标、38px 行高的桌面紧凑布局。Android 通过单独 WallToolsCar.css 调整为最多 460px、3 列带文字快捷键、58px 操作行、60px 音量行、48px 小按钮，保持桌面几何不变。窗口不足时面板收窄或滚动，不靠 transform 整体放大；native 容器已经处理系统安全边距。菜单根节点排除全屏手势。

Browser 插件不可用，本地使用已有 Playwright / Chromium 156。真实应用中检查 1920×1080、960×720、800×600、412×732、680×420：边界、触控尺寸、文字、叠色开关、帮助展开/收起及音量滑条；CI 对实际 Chromium95 运行同一路径。截图/报告仅作为 CI 或工作目录产物，不提交测试截图。

卡片排查沿用 docs/dilink-r9-split-card.md 与 docs/dilink-r10-pane-upstream.md 的边界。[BYDMate 作者代码](https://github.com/AndyShaman/BYDMate/blob/main/app/src/main/kotlin/com/bydmate/app/media/ClusterMusicCard.kt) 区分标准会话与其固件上的厂商准入；它讨论的是仪表输出，不能用来证明本车 UI7 主页的具体实现。[Denza DiCar probe](https://github.com/xor777/denza-lab/blob/main/experiments/dicar-media-probe/README.md) 的 setPlaybackState 写的是仪表状态/扬声器实验，也不是桌面卡片注册，不接入此应用。

新增 CarControllerEvidence 记录最近8个浏览客户端与最近8次远程会话指令（真实 Android controller 包名、动作和单调时钟），防止 lastBrowserClient 被 SystemUI 后续连接覆盖而遗漏厂商。诊断附 active、playbackState、hasMetadata 和 notificationEnabled。不读取账号/曲目内容，不申请更多权限、不冒用别的包、不写厂商受保护 Provider 或仪表 FID。CI 检查系统媒体控制后确实产生指令记录；普通模拟器不代表 BYD 卡片已接纳。

下一步需要本车播放后、点击卡片控制后的 controllerEvidence 与 oem 版本信息；若厂商客户端没有浏览连接，也可能直接读 MediaSession，因此仍不能仅凭 browserClients 为空判定拒绝。远程指令未到达只能证明它没有发给 Folia，不能猜测私有 SDK 协议。
