# Major 车机快捷菜单与卡片排查

用户实车确认 Major 首版的分屏黑条已消失、其余主要功能正常；只有桌面音乐卡片不显示 Folia，卡片按钮也不控制 Folia。方向盘和应用内控制正常。此结论不能倒推出厂商采用了哪一种白名单。

快捷菜单来自共享 WallToolsSurface，原设计为 296px 宽、6 列纯图标、38px 行高的桌面紧凑布局。Android 通过单独 WallToolsCar.css 调整为最多 460px、3 列带文字快捷键、58px 操作行、60px 音量行、48px 小按钮，保持桌面几何不变。窗口不足时面板收窄或滚动，不靠 transform 整体放大；native 容器已经处理系统安全边距。菜单根节点排除全屏手势。

Browser 插件不可用，本地使用已有 Playwright / Chromium 156。真实应用中检查 1920×1080、960×720、800×600、412×732、680×420：边界、触控尺寸、文字、叠色开关、帮助展开/收起及音量滑条；CI 对实际 Chromium95 运行同一路径。截图/报告仅作为 CI 或工作目录产物，不提交测试截图。

卡片排查沿用 docs/dilink-r9-split-card.md 与 docs/dilink-r10-pane-upstream.md 的边界。[BYDMate 作者代码](https://github.com/AndyShaman/BYDMate/blob/main/app/src/main/kotlin/com/bydmate/app/media/ClusterMusicCard.kt) 区分标准会话与其固件上的厂商准入；它讨论的是仪表输出，不能用来证明本车 UI7 主页的具体实现。[Denza DiCar probe](https://github.com/xor777/denza-lab/blob/main/experiments/dicar-media-probe/README.md) 的 setPlaybackState 写的是仪表状态/扬声器实验，也不是桌面卡片注册，不接入此应用。

新增 CarControllerEvidence 记录最近8个浏览客户端与最近8次远程会话指令（真实 Android controller 包名、动作和单调时钟），防止 lastBrowserClient 被 SystemUI 后续连接覆盖而遗漏厂商。诊断附 active、playbackState、hasMetadata 和 notificationEnabled。不读取账号/曲目内容，不申请更多权限、不冒用别的包、不写厂商受保护 Provider 或仪表 FID。CI 检查系统媒体控制后确实产生指令记录；普通模拟器不代表 BYD 卡片已接纳。

记录还覆盖共用媒体按键入口（包括传统 RCC 广播）及服务 intent。只有 media_session 来源带平台提供的真实控制端包名；其余来源标明 key_event/service_intent，不猜调用者身份。对照 lastCommand 和记录时间，不能把“没有会话记录”当作“其他入口也没收到”。

下一步需要本车播放后、点击卡片控制后的 controllerEvidence 与 oem 版本信息；若厂商客户端没有浏览连接，也可能直接读 MediaSession，因此仍不能仅凭 browserClients 为空判定拒绝。远程指令未到达只能证明它没有发给 Folia，不能猜测私有 SDK 协议。

## 旧内核构建的样式层级

Chromium95 CI 发现音量滑条无法响应；本地 Chromium96 的实际编译包复现 padding 为0。PostCSS cascade-layers 原本逐 CSS 模块执行，Tailwind 的 reset 被添加优先级，而后加载的组件 CSS 没有同样的层级上下文。其官方文档明确要求输入完整样式包。现在 build/androidCssBundle.mjs 将全部 CSS 资产放在一份虚拟样式树中统一计算层级，然后按原边界写回各资产。JS/CSS 继续按需加载，各独立 HTML 页面的样式保持隔离；其余旧内核特性仍由原 PostCSS 处理。Desktop/Web 构建不变。

不能把独立的主应用、舞台客户端和模组导出页的 CSS 物理合成一个加载文件：其他页面的全局按钮规则会污染主应用、挤压设置区。ci/test-css-bundle.cjs 验证虚拟转换后各页面的规则不串入别的资产，真实旧浏览器检查继续验证最终排版和点击。

矮横窗的歌词设置标签固定两列、44px最小触控高度，避免 Linux/Android 字体差异导致四个标签占用过多垂直空间。CI 原有设置滚动区至少140px的检查保持不变。

修正后 Chromium96 回读菜单内边距16px（之前0px），五种尺寸的实际菜单、帮助和音量交互通过；Chromium156同样通过。CI继续使用真实Chromium95，不将96冒称95。菜单回归检查同时验证实际计算后的内边距，避免只看元素存在。交互测试等待实际开关/帮助状态完成，而非用固定延迟猜测旧浏览器的渲染完成时间。
