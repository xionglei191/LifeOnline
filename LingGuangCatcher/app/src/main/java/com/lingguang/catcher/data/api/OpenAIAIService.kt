package com.lingguang.catcher.data.api

import android.util.Base64
import android.util.Log
import com.lingguang.catcher.data.model.AIProcessResult
import com.lingguang.catcher.data.model.VoiceNoteType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

class OpenAIAIService(
    private val apiKey: String,
    private val baseUrl: String = "https://api.openai.com/v1",
    private val model: String = "gpt-4o"
) : AIService {

    private val TAG = "LingGuang"
    private val chatUrl get() = "$baseUrl/chat/completions"

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    override suspend fun processVoiceText(text: String): AIProcessResult =
        processVoiceTextByType(text, VoiceNoteType.INSPIRATION)

    suspend fun processVoiceTextByType(text: String, noteType: VoiceNoteType): AIProcessResult {
        val prompt = PromptTemplates.getVoicePrompt(noteType, text)
        val tags = listOf(noteType.tag, "语音")
        return callChatAPI(prompt, "语音", tags)
    }

    override suspend fun processImage(imagePath: String, voiceNote: String?): AIProcessResult =
        callVisionAPI(imagePath, voiceNote)

    override suspend fun processLink(url: String): AIProcessResult {
        val page = com.lingguang.catcher.util.LinkContentFetcher.fetch(url)
        val prompt = PromptTemplates.getLinkPrompt(url, page.text, page.title, page.author, page.publishDate, page.articleType)
        return callChatAPI(prompt, url, listOf("链接", "待阅读"))
    }

    override suspend fun processText(text: String): AIProcessResult {
        return callChatAPI(PromptTemplates.getTextPrompt(text), "文本", listOf("文本", "快速捕获"))
    }

    private suspend fun callChatAPI(
        prompt: String,
        source: String,
        tags: List<String>
    ): AIProcessResult = withContext(Dispatchers.IO) {
        try {
            val body = JSONObject().apply {
                put("model", model)
                put("messages", JSONArray().apply {
                    put(JSONObject().apply {
                        put("role", "user")
                        put("content", prompt)
                    })
                })
                put("temperature", 0.7)
            }

            val content = post(body.toString())
            Log.d(TAG, "OpenAI Chat API 返回: ${content.take(100)}...")

            AIProcessResult(
                success = true,
                markdown = content,
                yamlFrontmatter = mapOf(
                    "时间" to timestamp(),
                    "来源" to source,
                    "标签" to tags
                )
            )
        } catch (e: Exception) {
            Log.e(TAG, "OpenAI Chat API 失败: ${e.message}")
            AIProcessResult(success = false, errorMessage = e.message)
        }
    }

    private suspend fun callVisionAPI(imagePath: String, voiceNote: String?): AIProcessResult =
        withContext(Dispatchers.IO) {
            try {
                val file = File(imagePath)
                val base64 = Base64.encodeToString(file.readBytes(), Base64.NO_WRAP)

                val textPrompt = PromptTemplates.getVisionPrompt(voiceNote)

                val body = JSONObject().apply {
                    put("model", model)
                    put("messages", JSONArray().apply {
                        put(JSONObject().apply {
                            put("role", "user")
                            put("content", JSONArray().apply {
                                put(JSONObject().apply {
                                    put("type", "image_url")
                                    put("image_url", JSONObject().apply {
                                        put("url", "data:image/jpeg;base64,$base64")
                                    })
                                })
                                put(JSONObject().apply {
                                    put("type", "text")
                                    put("text", textPrompt)
                                })
                            })
                        })
                    })
                    put("temperature", 0.7)
                    put("max_tokens", 2000)
                }

                val content = post(body.toString())
                Log.d(TAG, "OpenAI Vision API 返回: ${content.take(100)}...")

                AIProcessResult(
                    success = true,
                    markdown = content,
                    yamlFrontmatter = mapOf(
                        "时间" to timestamp(),
                        "来源" to "视觉",
                        "标签" to listOf("图片", "视觉萃取")
                    )
                )
            } catch (e: Exception) {
                Log.e(TAG, "OpenAI Vision API 失败: ${e.message}")
                AIProcessResult(success = false, errorMessage = e.message)
            }
        }

    private suspend fun fetchPageContent(url: String): String = withContext(Dispatchers.IO) {
        try {
            val jinaUrl = "https://r.jina.ai/$url"
            val request = Request.Builder().url(jinaUrl)
                .header("Accept", "text/plain")
                .build()
            val text = client.newCall(request).execute().body?.string() ?: ""
            if (text.length > 8000) text.take(8000) + "\n...(内容已截断)" else text
        } catch (e: Exception) {
            Log.w(TAG, "Jina 抓取失败: ${e.message}")
            "（无法获取页面内容，请根据链接进行分析）"
        }
    }

    private fun post(jsonBody: String): String {
        val request = Request.Builder()
            .url(chatUrl)
            .header("Authorization", "Bearer $apiKey")
            .post(jsonBody.toRequestBody("application/json".toMediaType()))
            .build()
        val response = client.newCall(request).execute()
        val body = response.body?.string() ?: throw Exception("空响应")
        if (!response.isSuccessful) throw Exception("OpenAI API 错误 ${response.code}: $body")
        return parseContent(body)
    }

    private fun parseContent(responseJson: String): String {
        val json = JSONObject(responseJson)
        return json.getJSONArray("choices")
            .getJSONObject(0)
            .getJSONObject("message")
            .getString("content")
            .trim()
    }

    private fun buildVoicePrompt(text: String, noteType: VoiceNoteType): String {
        val header = when (noteType) {
            VoiceNoteType.INSPIRATION -> "## 💡 灵感闪现"
            VoiceNoteType.TASK -> "## 📝 任务清单"
            VoiceNoteType.SCHEDULE -> "## 📅 日程记录"
            VoiceNoteType.LEARNING -> "## 📚 学习笔记"
            VoiceNoteType.THOUGHT -> "## 💭 随想"
            VoiceNoteType.EXCERPT -> "## 🔖 摘录"
            VoiceNoteType.GOAL -> "## 🎯 目标规划"
            VoiceNoteType.QUESTION -> "## ❓ 问题记录"
            VoiceNoteType.CONTACT -> "## 🤝 人脉记录"
            VoiceNoteType.LIFE -> "## 🏠 生活记录"
            VoiceNoteType.WORK -> "## 💼 工作记录"
            VoiceNoteType.BRAINSTORM -> "## 🧠 头脑风暴"
        }
        return """
请将以下语音内容整理为结构化笔记，输出格式以 "$header" 开头。

语音内容：
$text

要求：
1. 去除口语化表达（嗯、啊、那个等）
2. 保留核心信息，结构清晰
3. 只输出 Markdown 正文，不要输出 YAML frontmatter
4. 使用简体中文
        """.trimIndent()
    }

    private fun getBrainstormPrompt(text: String) = """
你是一个头脑风暴整理助手。用户进行了多段录音的头脑风暴会话，请将所有段落整合为一篇结构化的头脑风暴笔记。

语音内容（多段合并）：
$text

要求：
1. 识别各段的主题和核心观点
2. 找出段落之间的关联和递进关系
3. 提炼出关键洞察
4. 标注值得进一步探索的方向
5. 生成简易思维导图（文本形式）

输出格式（严格遵循）：
## 🧠 头脑风暴

**主题**
[根据所有段落内容提炼出的核心主题]

**核心观点**
1. [观点1：来自哪段，核心内容]
2. [观点2：来自哪段，核心内容]
3. [观点3]

**关键洞察**
- 💡 [洞察1：跨段落的深层发现]
- 💡 [洞察2]

**待探索**
- [ ] [值得深入研究的方向1]
- [ ] [值得深入研究的方向2]

**思维导图**
```
[核心主题]
├── [分支1]
│   ├── [子观点]
│   └── [子观点]
├── [分支2]
│   └── [子观点]
└── [分支3]
```

注意：只输出 Markdown 正文，不要输出 YAML frontmatter。使用简体中文。
    """.trimIndent()

    private fun timestamp() = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date())
}
