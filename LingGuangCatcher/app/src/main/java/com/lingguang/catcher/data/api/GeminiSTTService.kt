package com.lingguang.catcher.data.api

import android.util.Base64
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Google Gemini STT 服务
 * 使用 Gemini API 进行语音转文字
 */
class GeminiSTTService(private val apiKey: String) {

    private val TAG = "LingGuang"
    private val BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    /**
     * 将音频文件转录为文字
     */
    suspend fun transcribeAudio(audioFile: File): String? = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "使用 Gemini 转录音频: ${audioFile.absolutePath}, 大小: ${audioFile.length()} bytes")

            val base64 = Base64.encodeToString(audioFile.readBytes(), Base64.NO_WRAP)

            val body = JSONObject().apply {
                put("contents", JSONArray().apply {
                    put(JSONObject().apply {
                        put("parts", JSONArray().apply {
                            // 音频部分
                            put(JSONObject().apply {
                                put("inline_data", JSONObject().apply {
                                    put("mime_type", "audio/mp4")
                                    put("data", base64)
                                })
                            })
                            // 提示词部分
                            put(JSONObject().apply {
                                put("text", """
                                    请将这段音频转录为文字，并进行智能优化。要求：

                                    1. 转录要求：
                                       - 准确识别语音内容
                                       - 必须使用简体中文输出
                                       - 不要使用繁体中文

                                    2. 文本优化（重要）：
                                       - 去除语气词：嗯、啊、呃、哦、那个、这个、就是说等
                                       - 去除重复词：如"我我我觉得"改为"我觉得"
                                       - 修正口音错误：常见的同音字错误、方言词汇
                                       - 优化标点符号：添加合适的逗号、句号
                                       - 适度书面化：保留原意，但去除过度口语化的表达

                                    3. 输出要求：
                                       - 只输出优化后的文字内容
                                       - 不要添加任何说明或注释
                                       - 保持语义完整和准确
                                       - 使用标准的书面语表达

                                    示例：
                                    输入："嗯...那个...我我我觉得呢，这个想法挺好的，就是说可以试试看"
                                    输出："我觉得这个想法很好，可以试试看。"
                                """.trimIndent())
                            })
                        })
                    })
                })
            }

            val url = "$BASE_URL?key=$apiKey"
            val request = Request.Builder()
                .url(url)
                .post(body.toString().toRequestBody("application/json".toMediaType()))
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: throw Exception("空响应")

            if (!response.isSuccessful) {
                Log.e(TAG, "Gemini API 错误 ${response.code}: $responseBody")
                throw Exception("Gemini API 错误 ${response.code}: $responseBody")
            }

            val json = JSONObject(responseBody)
            val text = json.getJSONArray("candidates")
                .getJSONObject(0)
                .getJSONObject("content")
                .getJSONArray("parts")
                .getJSONObject(0)
                .getString("text")
                .trim()

            Log.d(TAG, "Gemini STT 转录结果: $text")
            return@withContext text.ifEmpty { null }
        } catch (e: Exception) {
            Log.e(TAG, "Gemini STT 失败: ${e.message}", e)
            null
        }
    }
}
