# 灵光捕手 (LingGuangCatcher) V1.0

## 📱 项目简介

"灵光捕手"是一款**零上下文切换**的个人外脑捕获工具，专为快速记录灵感、想法和信息而设计。

### 核心特性
- 🎤 **语音闪念**：快速录制语音，AI 自动整理成文字
- 📸 **视觉萃取**：拍照记录，多模态 AI 提取关键信息
- 🔗 **信息漏斗**：分享链接/视频，自动提炼核心内容
- 📝 **自动归档**：生成 Markdown 并保存到 Obsidian

## 🏗️ 技术架构

- **语言**：Kotlin
- **最低 SDK**：26 (Android 8.0)
- **目标 SDK**：34 (Android 14)
- **架构模式**：Repository Pattern
- **异步处理**：Kotlin Coroutines + WorkManager
- **网络请求**：OkHttp + Retrofit
- **UI 框架**：Material Design 3

## 📦 项目结构

```
app/src/main/java/com/lingguang/catcher/
├── CatcherApplication.kt          # Application 入口
├── data/
│   ├── model/                     # 数据模型
│   │   ├── CaptureRecord.kt       # 捕获记录
│   │   └── MarkdownDocument.kt    # Markdown 文档
│   ├── api/                       # API 接口
│   │   └── AIService.kt           # AI 服务（含模拟实现）
│   └── repository/                # 数据仓库
│       └── CaptureRepository.kt   # 捕获数据仓库
├── ui/                            # UI 界面
│   ├── MainActivity.kt            # 主界面
│   ├── ShareReceiverActivity.kt   # 分享接收器
│   └── VoiceCaptureActivity.kt    # 语音捕获
└── util/                          # 工具类
    ├── FeedbackUtil.kt            # UI 反馈
    └── PermissionUtil.kt          # 权限管理
```

## 🚀 开发进度

### ✅ Phase 1: 基础设施与"单行道"跑通 (当前)
- [x] 初始化 Android Kotlin 工程
- [x] 配置基础权限（录音、网络、文件存储）
- [x] 实现全局分享接收器 (Share Sheet Receiver)
- [x] 封装网络请求模块
- [x] 打通 AI 文本处理 API（模拟）
- [x] 验收：能接收分享内容并生成 Markdown

### 🔄 Phase 2: Obsidian 本地存储与结构化打通
- [ ] 引入 Android SAF 框架
- [ ] 获取 Obsidian Vault 读写权限
- [ ] 编写大模型系统级 Prompt
- [ ] 实现后台文件写入服务
- [ ] 验收：自动写入 Obsidian 收件箱

### 📅 Phase 3: 多模态扩展
- [ ] 开发"拍照闪记"功能
- [ ] 接入多模态 Vision API
- [ ] 开发长链接解析脚本
- [ ] 实现 YouTube 字幕抓取
- [ ] 验收：图片和视频内容提炼

### 🎯 Phase 4: 系统级 UI 降维与异步优化
- [ ] 开发 Android TileService（快捷面板）
- [ ] 引入 WorkManager 后台队列
- [ ] 实现断网缓存与自动重传
- [ ] 增加触觉/视觉反馈
- [ ] 验收：零阻力捕获体验

## 🔧 如何构建

当前项目位于 LifeOnline 总仓库中的 `LifeOnline/LingGuangCatcher`。


### 前置要求
- Android Studio Hedgehog (2023.1.1) 或更高版本
- JDK 17
- Android SDK 34

### 构建步骤
1. 克隆项目到本地
2. 使用 Android Studio 打开项目
3. 等待 Gradle 同步完成
4. 连接 Android 设备或启动模拟器
5. 点击 Run 按钮

## 📱 如何使用

### 分享功能测试
1. 打开任意 App（如浏览器、YouTube）
2. 点击"分享"按钮
3. 选择"灵光捕手"
4. 等待处理完成（会显示 Toast 提示）
5. 查看控制台日志，可以看到生成的 Markdown

### 语音捕获（开发中）
- 点击主界面的"语音捕获"按钮
- Phase 2 将实现完整功能

## 🔑 API 配置

当前使用模拟数据，无需配置 API Key。

Phase 2+ 接入真实 API 时，需要在 `local.properties` 中配置：
```properties
OPENAI_API_KEY=your_api_key_here
ANTHROPIC_API_KEY=your_api_key_here
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
