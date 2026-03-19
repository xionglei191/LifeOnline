package com.lingguang.catcher.data.api

import android.util.Base64
import android.util.Log
import com.lingguang.catcher.data.model.AIProcessResult
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

class DashScopeAIService(
    private val apiKey: String,
    private val textModel: String = "qwen-plus"
) : AIService {

    private val TAG = "LingGuang"
    private val BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
    private val VISION_MODEL = "qwen-vl-max"
    private val AUDIO_MODEL = "sensevoice-v1"  // 改用 sensevoice-v1，支持 base64

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    override suspend fun processVoiceText(text: String): AIProcessResult {
        // 使用默认类型（灵感）
        return processVoiceTextByType(text, com.lingguang.catcher.data.model.VoiceNoteType.INSPIRATION)
    }

    /**
     * 根据笔记类型处理语音文本
     */
    suspend fun processVoiceTextByType(
        text: String,
        noteType: com.lingguang.catcher.data.model.VoiceNoteType
    ): AIProcessResult {
        val prompt = PromptTemplates.getVoicePrompt(noteType, text)
        val tags = listOf(noteType.tag, "语音")
        return callTextAPI(prompt, "语音", tags)
    }

    private fun getInspirationPrompt(text: String) = """
你是一个创意思维助手。分析这个灵感，提取核心观点，并提供扩展思考。

语音内容：
$text

要求：
1. 去除口语化表达
2. 提取核心创意点
3. 分析价值和可行性
4. 提供扩展思考方向

输出格式（严格遵循）：
## 💡 灵感闪现

[整理后的核心灵感，2-3 段落]

**核心观点**
- [观点 1]
- [观点 2]

**价值分析**
- 这个想法的价值在于...
- 可能的应用场景...

**扩展思考**
- 可以进一步探索...
- 需要注意的问题...

**后续行动**
- [ ] [如果有具体行动项]

注意：只输出 Markdown 正文，不要输出 YAML frontmatter。使用简体中文。
    """.trimIndent()

    private fun getTaskPrompt(text: String) = """
你是一个任务管理助手。将语音内容转换为清晰的任务清单。

语音内容：
$text

要求：
1. 提取所有任务项
2. 识别优先级（高/中/低）
3. 提取截止时间（如果提到）
4. 拆解复杂任务为子任务

输出格式（严格遵循）：
## 📝 任务清单

**待办事项**
- [ ] [任务1] `优先级：高` `截止：YYYY-MM-DD`
- [ ] [任务2] `优先级：中`
- [ ] [任务3]

**任务详情**
### [任务1名称]
- 具体步骤1
- 具体步骤2

**备注**
[其他相关信息]

注意：只输出 Markdown 正文，不要输出 YAML frontmatter。使用简体中文。
    """.trimIndent()

    private fun getSchedulePrompt(text: String) = """
你是一个日程记录助手。简洁提取关键信息，不要过度分析。

语音内容：
$text

要求：
1. 提取时间信息（日期、时间）
2. 提取事项描述
3. 提取地点（如果提到）
4. 提取参与人（如果提到）
5. 保持简洁，不要展开分析

输出格式（严格遵循）：
## 📅 日程记录

**时间**: [YYYY-MM-DD HH:mm 或 相对时间描述]
**事项**: [简洁描述，一句话]
**地点**: [如果提到]
**参与人**: [如果提到]

**备注**
[其他补充信息，如果有]

注意：只输出 Markdown 正文，不要输出 YAML frontmatter。使用简体中文。保持简洁。
    """.trimIndent()

    private fun getLearningPrompt(text: String) = """
你是一个学习笔记助手。将学习内容整理为结构化的知识卡片。

语音内容：
$text

要求：
1. 提取核心知识点
2. 解释关键概念
3. 关联相关知识
4. 标注需要进一步学习的内容

输出格式（严格遵循）：
## 📚 学习笔记

**核心知识点**
[用 2-3 段落描述学到的内容]

**关键概念**
- **[概念1]**: [解释]
- **[概念2]**: [解释]

**知识关联**
- 与 [相关知识] 的联系...
- 可以应用在 [场景]...

**待深入**
- [ ] [需要进一步学习的内容]
- [ ] [需要实践的内容]

**参考资料**
[如果提到来源]

注意：只输出 Markdown 正文，不要输出 YAML frontmatter。使用简体中文。
    """.trimIndent()

    private fun getThoughtPrompt(text: String) = """
你是一个思考记录助手。轻量整理，保留原始表达的温度和个性。

语音内容：
$text

要求：
1. 去除明显的口语化词汇（嗯、啊、那个等）
2. 保持原有的思考脉络和情感
3. 适当分段，提升可读性
4. 不要过度分析和扩展

输出格式（严格遵循）：
## 💭 随想

[整理后的内容，保持原有的思考流和情感，2-3 段落]

**关键词**
[提取 3-5 个关键词]

注意：只输出 Markdown 正文，不要输出 YAML frontmatter。使用简体中文。保持原味。
    """.trimIndent()

    private fun getExcerptPrompt(text: String) = """
你是一个摘录整理助手。整理摘录内容，标注来源和感悟。

语音内容：
$text

要求：
1. 提取摘录的原文
2. 识别来源（书籍、文章、视频等）
3. 记录个人感悟
4. 保持原文的精彩表达

输出格式（严格遵循）：
## 🔖 摘录

**原文**
> [摘录的原文内容]

**来源**
- 出处：[书名/文章标题/视频标题]
- 作者：[如果提到]
- 页码/时间点：[如果提到]

**我的感悟**
[对这段摘录的思考和感悟]

**相关主题**
[这段摘录涉及的主题]

注意：只输出 Markdown 正文，不要输出 YAML frontmatter。使用简体中文。
    """.trimIndent()

    private fun getGoalPrompt(text: String) = """
你是一个目标管理助手。将目标拆解为可执行的里程碑和行动计划。

语音内容：
$text

要求：
1. 明确目标的具体内容
2. 拆解为阶段性里程碑
3. 制定具体行动计划
4. 设定时间节点（如果提到）

输出格式（严格遵循）：
## 🎯 目标规划

**目标描述**
[清晰描述目标的具体内容和期望结果]

**里程碑**
1. [阶段1] - [预期时间]
   - 关键成果：[具体可衡量的成果]
2. [阶段2] - [预期时间]
   - 关键成果：[具体可衡量的成果]

**行动计划**
- [ ] [具体行动1] `优先级：高`
- [ ] [具体行动2] `优先级：中`
- [ ] [具体行动3]

**成功标准**
- [如何判断目标达成]

**潜在障碍**
- [可能遇到的困难和应对策略]

注意：只输出 Markdown 正文，不要输出 YAML frontmatter。使用简体中文。
    """.trimIndent()

    private fun getQuestionPrompt(text: String) = """
你是一个问题分析助手。帮助用户理清问题，提供可能的解决方向。

语音内容：
$text

要求：
1. 明确问题的核心
2. 分析问题的类型和背景
3. 提供可能的解决方向
4. 标注需要进一步了解的信息

输出格式（严格遵循）：
## ❓ 问题记录

**问题描述**
[清晰描述问题的核心]

**问题分类**
- 类型：[技术问题/概念理解/实践应用/其他]
- 领域：[相关领域]

**可能的解决方向**
1. [方向1]
   - 思路：[具体思路]
   - 参考：[可能的参考资料]
2. [方向2]
   - 思路：[具体思路]

**需要了解的信息**
- [ ] [需要进一步了解的内容1]
- [ ] [需要进一步了解的内容2]

**相关资源**
[可能有帮助的资源、文档、工具]

注意：只输出 Markdown 正文，不要输出 YAML frontmatter。使用简体中文。
    """.trimIndent()

    private fun getContactPrompt(text: String) = """
你是一个人脉管理助手。整理联系人信息和交往记录。

语音内容：
$text

要求：
1. 提取人物基本信息
2. 记录关键特征和背景
3. 整理交往内容和印象
4. 标注后续跟进事项

输出格式（严格遵循）：
## 🤝 人脉记录

**基本信息**
- 姓名：[姓名]
- 职位/身份：[如果提到]
- 公司/机构：[如果提到]
- 联系方式：[如果提到]

**关键特征**
- [特征1：如专业领域、性格特点等]
- [特征2]

**交往记录**
**时间**: [记录时间]
**场合**: [认识场合或交流场合]
**内容**: [交流的主要内容]

**个人印象**
[对这个人的印象和评价]

**后续跟进**
- [ ] [需要跟进的事项]
- [ ] [可以合作的方向]

**标签**
[相关标签，如：技术、合作、朋友等]

注意：只输出 Markdown 正文，不要输出 YAML frontmatter。使用简体中文。
    """.trimIndent()

    private fun getLifePrompt(text: String) = """
你是一个生活记录助手。整理日常生活相关的内容。

语音内容：
$text

请整理为以下格式：
## 🏠 生活记录

**事项：**
[具体事项描述]

**相关信息：**
[时间、地点、人物等相关信息]

**备注：**
[其他补充信息]

注意：只输出 Markdown 正文，不要输出 YAML frontmatter。使用简体中文。
    """.trimIndent()

    private fun getWorkPrompt(text: String) = """
你是一个工作记录助手。整理工作相关的内容。

语音内容：
$text

请整理为以下格式：
## 💼 工作记录

**事项：**
[具体工作事项描述]

**跟进行动：**
[需要跟进的行动项]

**相关信息：**
[项目、人员、截止日期等]

注意：只输出 Markdown 正文，不要输出 YAML frontmatter。使用简体中文。
    """.trimIndent()

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

    override suspend fun processImage(imagePath: String, voiceNote: String?): AIProcessResult {
        return callVisionAPI(imagePath, voiceNote)
    }

    override suspend fun processLink(url: String): AIProcessResult {
        val page = com.lingguang.catcher.util.LinkContentFetcher.fetch(url)
        return callTextAPI(PromptTemplates.getLinkPrompt(url, page.text, page.title, page.author, page.publishDate, page.articleType), url, listOf("链接", "待阅读"))
    }

    override suspend fun processText(text: String): AIProcessResult {
        return callTextAPI(PromptTemplates.getTextPrompt(text), "文本", listOf("文本", "快速捕获"))
    }

    private suspend fun callTextAPI(
        prompt: String,
        source: String,
        tags: List<String>
    ): AIProcessResult = withContext(Dispatchers.IO) {
        try {
            val body = JSONObject().apply {
                put("model", textModel)
                put("messages", JSONArray().apply {
                    put(JSONObject().apply {
                        put("role", "user")
                        put("content", prompt)
                    })
                })
            }

            val response = post(body.toString())
            val content = parseContent(response)
            Log.d(TAG, "Text API 返回: ${content.take(100)}...")

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
            Log.e(TAG, "Text API 失败: ${e.message}")
            AIProcessResult(success = false, errorMessage = e.message)
        }
    }

    /** 将音频文件转录为文字（使用公网 URL，异步 ASR API） */
    suspend fun transcribeAudioWithUrl(audioUrl: String): String? = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "开始 STT 转录，URL: $audioUrl")

            // 使用 paraformer-v2 模型，支持 URL
            val body = JSONObject().apply {
                put("model", "paraformer-v2")
                put("input", JSONObject().apply {
                    put("file_urls", JSONArray().apply {
                        put(audioUrl)
                    })
                })
                put("parameters", JSONObject().apply {
                    put("format", "mp4")
                })
            }

            Log.d(TAG, "STT 请求: ${body.toString()}")
            val response = postAsrSubmit(body.toString())
            Log.d(TAG, "STT 提交响应: $response")

            val json = JSONObject(response)
            val taskId = json.getJSONObject("output").getString("task_id")
            Log.d(TAG, "STT 任务 ID: $taskId")

            // 轮询获取结果（最多等待 30 秒）
            for (i in 0 until 30) {
                Thread.sleep(1000)
                val statusUrl = "https://dashscope.aliyuncs.com/api/v1/tasks/$taskId"
                val statusResponse = getRequest(statusUrl)
                val statusJson = JSONObject(statusResponse)
                val status = statusJson.getJSONObject("output").getString("task_status")

                Log.d(TAG, "STT 状态: $status")

                when (status) {
                    "SUCCEEDED" -> {
                        val results = statusJson.getJSONObject("output")
                            .getJSONArray("results")
                        if (results.length() > 0) {
                            val transcription = results.getJSONObject(0)
                                .getJSONObject("transcription")
                                .getString("text")
                            Log.d(TAG, "STT 转录结果: $transcription")
                            return@withContext transcription.ifEmpty { null }
                        }
                    }
                    "FAILED" -> {
                        Log.e(TAG, "STT 任务失败，完整响应: $statusResponse")
                        return@withContext null
                    }
                }
            }

            Log.e(TAG, "STT 超时")
            null
        } catch (e: Exception) {
            Log.e(TAG, "STT 失败: ${e.message}", e)
            null
        }
    }

    /** 将音频文件转录为文字（sensevoice-v1，支持 base64） */
    suspend fun transcribeAudio(audioFile: File): String? = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "使用 sensevoice-v1 转录音频")
            val base64 = Base64.encodeToString(audioFile.readBytes(), Base64.NO_WRAP)

            // 使用 sensevoice-v1 模型
            val body = JSONObject().apply {
                put("model", AUDIO_MODEL)
                put("input", JSONObject().apply {
                    put("audio", "data:audio/mp4;base64,$base64")
                })
            }

            val response = postNative(body.toString())
            val json = JSONObject(response)
            val text = json.getJSONObject("output")
                .getString("text")
                .trim()

            Log.d(TAG, "STT 转录结果: $text")
            return@withContext text.ifEmpty { null }
        } catch (e: Exception) {
            Log.e(TAG, "STT 失败: ${e.message}", e)
            null
        }
    }

    private suspend fun callVisionAPI(imagePath: String, voiceNote: String? = null): AIProcessResult = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "callVisionAPI voiceNote=${voiceNote?.take(50)}")
            val file = File(imagePath)
            val base64 = Base64.encodeToString(file.readBytes(), Base64.NO_WRAP)
            val mimeType = "image/jpeg"

            val textPrompt = PromptTemplates.getVisionPrompt(voiceNote)

            val body = JSONObject().apply {
                put("model", VISION_MODEL)
                put("messages", JSONArray().apply {
                    // 有语音指令时加 system 消息强制执行
                    if (!voiceNote.isNullOrBlank()) {
                        put(JSONObject().apply {
                            put("role", "system")
                            put("content", "你是一个严格执行用户指令的助手。用户的指令是最高优先级，必须完全遵守。如果用户要求用某种语言输出（如英语、日语等），你必须用该语言输出全部内容。")
                        })
                    }
                    put(JSONObject().apply {
                        put("role", "user")
                        put("content", JSONArray().apply {
                            put(JSONObject().apply {
                                put("type", "image_url")
                                put("image_url", JSONObject().apply {
                                    put("url", "data:$mimeType;base64,$base64")
                                })
                            })
                            put(JSONObject().apply {
                                put("type", "text")
                                put("text", textPrompt)
                            })
                        })
                    })
                })
            }

            val response = post(body.toString())
            val content = parseContent(response)
            Log.d(TAG, "Vision API 返回: ${content.take(100)}...")

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
            Log.e(TAG, "Vision API 失败: ${e.message}")
            AIProcessResult(success = false, errorMessage = e.message)
        }
    }

    private suspend fun fetchPageContent(url: String): String = withContext(Dispatchers.IO) {
        try {
            // 使用 Jina Reader 免费抓取网页正文
            val jinaUrl = "https://r.jina.ai/$url"
            val request = Request.Builder().url(jinaUrl)
                .header("Accept", "text/plain")
                .build()
            val response = client.newCall(request).execute()
            val text = response.body?.string() ?: ""
            // 截断避免超出 token 限制
            if (text.length > 8000) text.take(8000) + "\n...(内容已截断)" else text
        } catch (e: Exception) {
            Log.w(TAG, "Jina 抓取失败，使用 URL 直接处理: ${e.message}")
            "（无法获取页面内容，请根据链接进行分析）"
        }
    }

    private fun post(jsonBody: String): String {
        val request = Request.Builder()
            .url(BASE_URL)
            .header("Authorization", "Bearer $apiKey")
            .header("Content-Type", "application/json")
            .post(jsonBody.toRequestBody("application/json".toMediaType()))
            .build()

        val response = client.newCall(request).execute()
        val body = response.body?.string() ?: throw Exception("空响应")
        if (!response.isSuccessful) throw Exception("API 错误 ${response.code}: $body")
        return body
    }

    private fun postNative(jsonBody: String): String {
        val url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
        val request = Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $apiKey")
            .header("Content-Type", "application/json")
            .post(jsonBody.toRequestBody("application/json".toMediaType()))
            .build()

        val response = client.newCall(request).execute()
        val body = response.body?.string() ?: throw Exception("空响应")
        if (!response.isSuccessful) throw Exception("API 错误 ${response.code}: $body")
        return body
    }

    private fun postMultiModal(jsonBody: String): String {
        val url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-conversation/generation"
        val request = Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $apiKey")
            .header("Content-Type", "application/json")
            .post(jsonBody.toRequestBody("application/json".toMediaType()))
            .build()
        val response = client.newCall(request).execute()
        val body = response.body?.string() ?: throw Exception("空响应")
        if (!response.isSuccessful) throw Exception("MultiModal API 错误 ${response.code}: $body")
        return body
    }

    private fun postAsrSubmit(jsonBody: String): String {
        val url = "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription"
        val request = Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $apiKey")
            .header("Content-Type", "application/json")
            .header("X-DashScope-Async", "enable")
            .post(jsonBody.toRequestBody("application/json".toMediaType()))
            .build()
        val response = client.newCall(request).execute()
        val body = response.body?.string() ?: throw Exception("空响应")
        if (!response.isSuccessful) throw Exception("ASR 提交失败 ${response.code}: $body")
        return body
    }

    private fun getRequest(url: String): String {
        val request = Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $apiKey")
            .get()
            .build()
        val response = client.newCall(request).execute()
        return response.body?.string() ?: throw Exception("空响应")
    }

    private fun parseNativeContent(responseJson: String): String {
        val json = JSONObject(responseJson)
        val content = json.getJSONObject("output")
            .getJSONArray("choices")
            .getJSONObject(0)
            .getJSONObject("message")
            .getJSONArray("content")
        // content 是数组，找第一个有 text 字段的元素
        for (i in 0 until content.length()) {
            val item = content.getJSONObject(i)
            if (item.has("text")) return item.getString("text").trim()
        }
        throw Exception("响应中无 text 字段")
    }

    private fun parseContent(responseJson: String): String {
        val json = JSONObject(responseJson)
        return json.getJSONArray("choices")
            .getJSONObject(0)
            .getJSONObject("message")
            .getString("content")
            .trim()
    }

    private fun timestamp() = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date())
}
