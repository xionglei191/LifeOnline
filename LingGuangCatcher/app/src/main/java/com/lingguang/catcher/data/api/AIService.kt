package com.lingguang.catcher.data.api

import com.lingguang.catcher.data.model.AIProcessResult
import kotlinx.coroutines.delay

/**
 * AI 服务接口
 * Phase 1: 使用模拟数据
 * Phase 2+: 接入真实的云端 API
 */
interface AIService {
    suspend fun processVoiceText(text: String): AIProcessResult
    suspend fun processImage(imagePath: String, voiceNote: String? = null): AIProcessResult
    suspend fun processLink(url: String): AIProcessResult
    suspend fun processText(text: String): AIProcessResult
}

/**
 * 模拟 AI 服务实现
 */
class MockAIService : AIService {

    override suspend fun processVoiceText(text: String): AIProcessResult {
        // 模拟网络延迟
        delay(1500)

        val processedContent = """
## 💡 语音闪念

$text

**核心观点：**
- 这是一段经过 AI 整理的语音内容
- 已去除口语化表达，重构为连贯段落
- 保留了原始思考的核心逻辑

**后续行动：**
- [ ] 待进一步验证
        """.trimIndent()

        return AIProcessResult(
            success = true,
            markdown = processedContent,
            yamlFrontmatter = mapOf(
                "时间" to getCurrentTimestamp(),
                "来源" to "语音",
                "标签" to listOf("#闪念", "#待整理")
            )
        )
    }

    override suspend fun processImage(imagePath: String, voiceNote: String?): AIProcessResult {
        delay(2000)

        val processedContent = """
## 📸 视觉萃取

**图片路径：** `$imagePath`

**识别内容：**
- 这是一张包含重要信息的图片
- AI 已提取关键概念和数据
- 结构化整理如下：

### 核心要点
1. 要点一：模拟提取的内容
2. 要点二：图表数据分析
3. 要点三：关键结论

**备注：** 此为模拟数据，实际将调用多模态 Vision API
        """.trimIndent()

        return AIProcessResult(
            success = true,
            markdown = processedContent,
            yamlFrontmatter = mapOf(
                "时间" to getCurrentTimestamp(),
                "来源" to "视觉",
                "标签" to listOf("#图片", "#待验证")
            )
        )
    }

    override suspend fun processLink(url: String): AIProcessResult {
        delay(2500)

        val processedContent = """
## 🔗 信息漏斗

**原始链接：** $url

**内容摘要：**
这是一篇关于技术/投资/思考的文章或视频。AI 已完成以下处理：

### 核心观点
- 观点 1：提炼的关键信息
- 观点 2：去粗取精后的干货
- 观点 3：值得记录的洞察

### 数据支撑
- 数据点 1
- 数据点 2

**时间戳：** [00:00] 开头 | [05:30] 关键论述 | [12:45] 结论

**备注：** Phase 3 将接入真实的爬虫和字幕提取服务
        """.trimIndent()

        return AIProcessResult(
            success = true,
            markdown = processedContent,
            yamlFrontmatter = mapOf(
                "时间" to getCurrentTimestamp(),
                "来源" to url,
                "标签" to listOf("#链接", "#待阅读")
            )
        )
    }

    override suspend fun processText(text: String): AIProcessResult {
        delay(1000)

        val processedContent = """
## 📝 文本捕获

$text

**AI 处理：**
- 已进行格式优化
- 提取关键信息
- 添加结构化标记
        """.trimIndent()

        return AIProcessResult(
            success = true,
            markdown = processedContent,
            yamlFrontmatter = mapOf(
                "时间" to getCurrentTimestamp(),
                "来源" to "文本",
                "标签" to listOf("#文本", "#快速捕获")
            )
        )
    }

    private fun getCurrentTimestamp(): String {
        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm", java.util.Locale.getDefault())
        return sdf.format(java.util.Date())
    }
}
