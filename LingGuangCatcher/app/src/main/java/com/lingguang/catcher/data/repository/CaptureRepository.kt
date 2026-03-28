package com.lingguang.catcher.data.repository

import android.content.Context
import android.util.Log
import com.lingguang.catcher.data.api.AIService
import com.lingguang.catcher.data.api.CloudflareR2Service
import com.lingguang.catcher.data.api.DashScopeAIService
import com.lingguang.catcher.data.api.GeminiAIService
import com.lingguang.catcher.data.api.GeminiSTTService
import com.lingguang.catcher.data.api.OpenAIAIService
import com.lingguang.catcher.data.api.OpenAIWhisperService
import com.lingguang.catcher.data.api.PromptTemplates
import com.lingguang.catcher.data.local.AIServiceType
import com.lingguang.catcher.data.local.AppSettings
import com.lingguang.catcher.data.local.STTServiceType
import com.lingguang.catcher.data.model.*
import com.lingguang.catcher.util.LinkContentFetcher
import com.lingguang.catcher.util.YouTubeCaptionFetcher
import java.io.File
import java.util.*

class CaptureRepository(private val context: Context? = null) {

    private data class RawSectionData(
        val title: String,
        val content: String
    )

    private val TAG = "LingGuang"
    private val settings: AppSettings? = context?.let { AppSettings.getInstance(it) }

    /** 获取 AI 服务实例 */
    private fun getAIService(): AIService {
        val s = settings ?: throw IllegalStateException("未配置 API Key，请在设置中配置")

        return when (s.aiServiceType) {
            AIServiceType.DASHSCOPE -> {
                if (s.dashscopeApiKey.isEmpty()) throw IllegalStateException("请在设置中填写 DashScope API Key")
                DashScopeAIService(s.dashscopeApiKey, s.dashscopeModel)
            }
            AIServiceType.OPENAI -> {
                if (s.openaiApiKey.isEmpty()) throw IllegalStateException("请在设置中填写 OpenAI API Key")
                OpenAIAIService(s.openaiApiKey, s.openaiBaseUrl, s.openaiModel)
            }
            AIServiceType.GEMINI -> {
                if (s.geminiApiKey.isEmpty()) throw IllegalStateException("请在设置中填写 Gemini API Key")
                GeminiAIService(s.geminiApiKey, s.geminiModel)
            }
            AIServiceType.MOCK -> throw IllegalStateException("请在设置中选择 AI 服务并配置 API Key")
        }
    }

    /** 获取 STT 服务实例 */
    private fun getSTTServices(): Triple<GeminiSTTService?, OpenAIWhisperService?, CloudflareR2Service?> {
        val s = settings ?: return Triple(null, null, null)

        val gemini = if (s.geminiApiKey.isNotEmpty()) GeminiSTTService(s.geminiApiKey) else null
        val whisper = if (s.openaiApiKey.isNotEmpty()) OpenAIWhisperService(s.openaiApiKey) else null
        val r2 = if (s.isR2Configured()) {
            CloudflareR2Service(
                accountId = s.r2AccountId,
                accessKeyId = s.r2AccessKeyId,
                secretAccessKey = s.r2SecretAccessKey,
                bucketName = s.r2BucketName,
                publicDomain = s.r2PublicDomain
            )
        } else null

        return Triple(gemini, whisper, r2)
    }

    /** 将音频文件转录为文字 */
    suspend fun transcribeAudio(audioFile: File): String? {
        Log.d(TAG, "开始转录音频: ${audioFile.absolutePath}, 大小: ${audioFile.length()} bytes")

        val (geminiSTTService, whisperService, r2Service) = getSTTServices()
        val sttType = settings?.sttServiceType ?: STTServiceType.GEMINI

        // 根据配置选择 STT 服务
        when (sttType) {
            STTServiceType.GEMINI -> {
                geminiSTTService?.let {
                    Log.d(TAG, "使用 Gemini STT")
                    val text = it.transcribeAudio(audioFile)
                    if (text != null) return text
                } ?: throw IllegalStateException("未配置 Gemini API Key，请在设置中配置")
            }
            STTServiceType.OPENAI_WHISPER -> {
                whisperService?.let {
                    Log.d(TAG, "使用 OpenAI Whisper STT")
                    val text = it.transcribeAudio(audioFile)
                    if (text != null) return text
                } ?: throw IllegalStateException("未配置 OpenAI API Key，请在设置中配置")
            }
            STTServiceType.DASHSCOPE -> {
                val aiService = getAIService()
                if (aiService is DashScopeAIService && r2Service != null) {
                    try {
                        Log.d(TAG, "使用 DashScope + R2 STT")
                        val objectKey = "audio/${UUID.randomUUID()}.m4a"
                        Log.d(TAG, "开始上传到 R2: $objectKey")
                        val audioUrl = r2Service.uploadFile(audioFile, objectKey)

                        if (audioUrl != null) {
                            Log.d(TAG, "R2 上传成功: $audioUrl")
                            val text = aiService.transcribeAudioWithUrl(audioUrl)
                            Log.d(TAG, "STT 转录结果: $text")
                            r2Service.deleteFile(objectKey)
                            return text
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "DashScope + R2 STT 失败: ${e.message}", e)
                    }
                } else {
                    throw IllegalStateException("未配置 DashScope API Key 或 R2，请在设置中配置")
                }
            }
        }

        // 回退：尝试其他可用的 STT 服务
        geminiSTTService?.let {
            Log.d(TAG, "回退到 Gemini STT")
            val text = it.transcribeAudio(audioFile)
            if (text != null) return text
        }

        whisperService?.let {
            Log.d(TAG, "回退到 OpenAI Whisper STT")
            return it.transcribeAudio(audioFile)
        }

        Log.d(TAG, "所有 STT 方案均失败")
        throw IllegalStateException("语音转录失败，请检查 API Key 配置和网络连接")
    }

    /** 对原始转录文本进行智能扩展（加标点、分段） */
    suspend fun enhanceTranscription(rawText: String): String {
        try {
            val aiService = getAIService()
            val prompt = PromptTemplates.getTranscriptionEnhancePrompt(rawText)
            val result = aiService.processText(prompt)
            if (result.success && result.markdown != null) {
                return result.markdown.trim()
            }
        } catch (e: Exception) {
            Log.e(TAG, "增强转录文本失败: ${e.message}", e)
        }
        return rawText // 如果失败，返回原始文本
    }

    suspend fun processCaptureRecord(record: CaptureRecord): Result<MarkdownDocument> {
        return try {
            val aiService = getAIService()
            Log.d(TAG, "处理捕获记录: type=${record.type}, metadata=${record.metadata}")

            val rawSectionData: RawSectionData?
            val result = when (record.type) {
                CaptureType.VOICE -> {
                    rawSectionData = null
                    aiService.processVoiceText(record.rawContent)
                }
                CaptureType.IMAGE -> {
                    val voiceNote = record.metadata["voice_note"]
                    rawSectionData = if (!voiceNote.isNullOrBlank()) {
                        RawSectionData("原始转写", voiceNote)
                    } else {
                        null
                    }
                    Log.d(TAG, "处理图片，语音指令: $voiceNote")
                    aiService.processImage(record.rawContent, voiceNote)
                }
                CaptureType.TEXT -> {
                    rawSectionData = record.rawContent
                        .takeIf { it.isNotBlank() }
                        ?.let { RawSectionData("原始文本", it) }
                    aiService.processText(PromptTemplates.getTextPrompt(record.rawContent))
                }
                CaptureType.LINK -> {
                    val url = record.rawContent
                    if (YouTubeCaptionFetcher.isYouTubeUrl(url)) {
                        val videoId = YouTubeCaptionFetcher.extractVideoId(url)!!
                        val captionResult = YouTubeCaptionFetcher.fetchCaptionResult(videoId)
                        if (!captionResult.captions.isNullOrBlank() && !captionResult.langCode.isNullOrBlank()) {
                            val captionText = captionResult.captions
                            val langCode = captionResult.langCode
                            Log.d(TAG, "YouTube 字幕获取成功，语言: $langCode，长度: ${captionText.length}")
                            rawSectionData = RawSectionData(
                                title = "原始字幕",
                                content = buildYouTubeRawContent(url, langCode, captionText)
                            )
                            aiService.processText(PromptTemplates.getYouTubePrompt(url, captionText, langCode))
                        } else {
                            Log.d(TAG, "YouTube 字幕获取失败，回退到网页抓取")
                            val page = LinkContentFetcher.fetch(url)
                            rawSectionData = RawSectionData(
                                title = rawSectionTitleForArticleType(page.articleType),
                                content = buildYouTubeFallbackRawContent(url, page, captionResult.debugInfo)
                            )
                            aiService.processText(
                                PromptTemplates.getLinkPrompt(
                                    url = url,
                                    pageContent = page.text,
                                    title = page.title,
                                    author = page.author,
                                    publishDate = page.publishDate,
                                    articleType = page.articleType
                                )
                            )
                        }
                    } else {
                        val page = LinkContentFetcher.fetch(url)
                        rawSectionData = RawSectionData(
                            title = rawSectionTitleForArticleType(page.articleType),
                            content = buildLinkRawContent(url, page)
                        )
                        aiService.processText(
                            PromptTemplates.getLinkPrompt(
                                url = url,
                                pageContent = page.text,
                                title = page.title,
                                author = page.author,
                                publishDate = page.publishDate,
                                articleType = page.articleType
                            )
                        )
                    }
                }
            }

            if (result.success && result.markdown != null) {
                val date = getCurrentDate()
                val type = when (record.type) {
                    CaptureType.IMAGE -> "note"
                    CaptureType.LINK -> "note"
                    CaptureType.TEXT -> "note"
                    CaptureType.VOICE -> "note"
                }
                val imageFilename = if (record.type == CaptureType.IMAGE) {
                    val sdf = java.text.SimpleDateFormat("yyyy-MM-dd_HHmmss", java.util.Locale.getDefault())
                    "lingguang_note_${sdf.format(java.util.Date())}.jpg"
                } else null
                val rawTags = (result.yamlFrontmatter?.get("标签") as? List<*>)?.map {
                    it.toString().removePrefix("#")
                } ?: emptyList()

                val markdown = MarkdownDocument.create(
                    type = type,
                    date = date,
                    tags = rawTags,
                    content = stripFrontmatter(result.markdown),
                    imageFilename = imageFilename,
                    rawTranscript = if (record.type == CaptureType.VOICE) record.rawContent else null,
                    rawSectionTitle = rawSectionData?.title,
                    rawSectionContent = rawSectionData?.content
                )
                Result.success(markdown)
            } else {
                Result.failure(Exception(result.errorMessage ?: "AI 处理失败"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * 根据笔记类型处理语音捕获记录
     */
    suspend fun processCaptureRecordByType(
        record: CaptureRecord,
        noteType: VoiceNoteType
    ): Result<MarkdownDocument> {
        return try {
            val aiService = getAIService()
            Log.d(TAG, "处理语音捕获记录: type=${noteType.getDisplayText()}")

            val result = when (aiService) {
                is DashScopeAIService -> aiService.processVoiceTextByType(record.rawContent, noteType)
                is GeminiAIService -> aiService.processVoiceTextByType(record.rawContent, noteType)
                is OpenAIAIService -> aiService.processVoiceTextByType(record.rawContent, noteType)
                else -> aiService.processVoiceText(record.rawContent)
            }

            if (result.success && result.markdown != null) {
                val rawTags = (result.yamlFrontmatter?.get("标签") as? List<*>)?.map {
                    it.toString().removePrefix("#")
                } ?: listOf(noteType.tag, "语音")

                val markdown = MarkdownDocument.create(
                    type = noteType.lifeosType,
                    dimension = noteType.lifeosDimension,
                    date = getCurrentDate(),
                    tags = rawTags,
                    content = stripFrontmatter(result.markdown),
                    rawTranscript = record.rawContent
                )
                Result.success(markdown)
            } else {
                Result.failure(Exception(result.errorMessage ?: "AI 处理失败"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun rawSectionTitleForArticleType(articleType: String): String {
        return if (articleType == "social") "原始帖文" else "原始内容"
    }

    private fun buildLinkRawContent(url: String, page: LinkContentFetcher.PageContent): String {
        return buildString {
            appendLine("URL: $url")
            page.title?.takeIf { it.isNotBlank() }?.let { appendLine("标题: $it") }
            page.author?.takeIf { it.isNotBlank() }?.let { appendLine("作者: $it") }
            page.publishDate?.takeIf { it.isNotBlank() }?.let { appendLine("发布日期: $it") }
            if (page.articleType.isNotBlank()) {
                appendLine("文章类型: ${page.articleType}")
            }
            appendLine()
            append(page.text.trim())
        }.trim()
    }

    private fun buildYouTubeRawContent(url: String, langCode: String, captions: String): String {
        return buildString {
            appendLine("视频链接: $url")
            appendLine("字幕语言: $langCode")
            appendLine()
            append(captions.trim())
        }.trim()
    }

    private fun buildYouTubeFallbackRawContent(
        url: String,
        page: LinkContentFetcher.PageContent,
        captionDebugInfo: String
    ): String {
        return buildString {
            appendLine("视频链接: $url")
            appendLine()
            appendLine("【字幕抓取状态】")
            appendLine(captionDebugInfo.trim())
            appendLine()
            appendLine("【网页回退内容】")
            append(buildLinkRawContent(url, page))
        }.trim()
    }

    /**
     * 剥离 AI 误输出的 YAML frontmatter 块。
     *
     * 兼容两种情况：
     * 1) frontmatter 在正文开头（标准）
     * 2) frontmatter 被错误放在标题后（如先输出 "## 标题" 再输出 ---）
     */
    private fun stripFrontmatter(content: String): String {
        var result = content
        var changed = true

        // 循环删除所有 Frontmatter 块，直到没有更多可删除的
        while (changed) {
            val lines = result.lines().toMutableList()
            if (lines.isEmpty()) return result

            // 只在文档前部查找，避免误删正文中的分隔线
            val searchLimit = minOf(lines.size, 40)
            var start = -1
            var end = -1

            for (i in 0 until searchLimit) {
                if (lines[i].trim() == "---") {
                    start = i
                    break
                }
            }

            if (start == -1) {
                break
            }

            for (j in (start + 1) until searchLimit) {
                if (lines[j].trim() == "---") {
                    end = j
                    break
                }
            }

            if (end == -1) {
                break
            }

            // 删除 frontmatter 块，保留其前后的正文内容
            val merged = (lines.subList(0, start) + lines.subList(end + 1, lines.size)).joinToString("\n")
            result = merged.trimStart()
        }

        return result
    }

    private fun getCurrentDate(): String {
        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
        return sdf.format(Date())
    }

    private fun getCurrentTimestamp(): String {
        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault())
        return sdf.format(Date())
    }
}
