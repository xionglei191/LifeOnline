# Wear OS 手表端快速语音录入可行性报告

## 1. 背景与目标
在 LifeOnline 的生态体系中，"灵光闪念" 的捕获路径（Capture Pipeline）正在向更轻、更快的方向演化。从桌面端的全局快捷键，到移动端的 PWA 及 Widget 小组件，其核心目标始终是降低用户的录入摩擦力。
为了进一步探索极简的录入体验，**D组 Sprint 3 针对 Wear OS 设备（Android 智能手表）进行可行性评估**，期望用户能够通过抬腕即录的方式完成语音输入，并将其送入 LifeOS 的后续分析管线。

## 2. 方案对比与技术选型

在 Wear OS 开发中，对于类似本项目的“录音+上传”场景，主要有以下两种架构路线：

### 方案 A：独立应用模式 (Standalone Mode)
手表应用作为完全独立的实体，利用手表自身的芯片和网络进行所有操作。
- **采集**：调用 `AudioRecord` 或 `MediaRecorder` 在手表本地缓冲区生成音频流。
- **传输**：直接通过手表的 Wi-Fi 或 eSIM 蜂窝网络发出 HTTP POST 请求给 LifeOS Node 服务器。
- **优点**：能够完全脱离手机工作，体验上最为纯粹（适合跑步不带手机的场景）。
- **缺点**：非常耗电；手表上的网络堆栈在低功耗模式下极不稳定；如果手表无独立网络（仅蓝牙），网络请求的延迟不可达预期。

### 方案 B：Companion 模式 (DataLayer API)
手表作为手机的延伸外设，只负责 UI 交互和硬件采集，繁重的逻辑和网络统统交给手机端已有的 APP 完成。
- **采集**：表端只开启 `SpeechRecognizer` (Android 原生语音识别接口，借用 Google 助理的组件)，或者采集原生音频流。
- **传输**：通过 Google Play Services 提供的 `Wearable DataLayer API` (MessageClient 或 ChannelClient)，将语音文本（或音频块）近乎无延迟地接力传送给手机端的 `LingGuangCatcher`。
- **优点**：极大节省手表电量；复用当前手机端灵光 APP 辛辛苦苦搭建好的离线重试队列 (`SyncWorker`) 和鉴权能力。即使手机在后台也能被唤醒并塞入 Queue。
- **缺点**：强依赖手机要在附近（通过蓝牙连接）。

## 3. 最终选型：推荐 方案 B (配合原生 SpeechRecognizer)
结合我们闪念追求“即时、抗弱网”的特性：
1. **直接调用原生的 SpeechRecognizer API**：WearOS 内置了强大的离线与在线混合语音转文本服务，这样可以避免我们在手表上自己处理音频编码，大幅降低难度。
2. **DataLayer API 发送文本**：获取到转换后的文字后，使用 `MessageClient` 将其封装为 JSON 发送至手机端的 `WearListenerService`（需后续在主 App 实现）。
3. **入列**：手机端 Service 收到文本，如同手机上的文字捕获一样，直接持久化写入 Room Database 的 PENDING 队列，由现成且坚如磐石的 `SyncWorker` 接管。

## 4. 最小化 Demo 实现路径
1. **模块结构**：项目中新增 `:wear` 模块，依赖 `androidx.wear:wear` 和 `play-services-wearable`。
2. **UI 侧**：一个居中的大大麦克风图标，结合 Wear Compose 或者纯 XML。
3. **代码逻辑**：
   - 点击麦克风拉起系统的 `ACTION_RECOGNIZE_SPEECH` Intent。
   - 在 `onActivityResult` 拿到语音文本。
   - 实例化 `Wearable.getMessageClient(this)` 并向已配对的 Phone Node 发射载荷。

## 5. 结论
在技术落地上，**WearOS 版本的“灵光捕手（腕上版）”完全可行且风险极低**。由于避开了手表端复杂的重试逻辑和网络连接维护（转移至成熟的手机端守护），开发周期评估可以控制在单人 5 天左右。
本阶段以产出此架构文档及空壳 wear module 证明编译旅程为准，业务级打通可放到后续里程碑。
