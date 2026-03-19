package com.lingguang.catcher.data.api

import android.util.Base64
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * OpenAI Whisper API 语音转文字服务
 * 支持 base64 音频和文件上传
 */
class OpenAIWhisperService(private val apiKey: String) {

    private val TAG = "LingGuang"
    private val BASE_URL = "https://api.openai.com/v1/audio/transcriptions"

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    /**
     * 转录音频文件为文字
     * @param audioFile 音频文件（支持 m4a, mp3, wav 等格式）
     * @return 转录文本，失败返回 null
     */
    suspend fun transcribeAudio(audioFile: File): String? = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "OpenAI Whisper 转录开始: ${audioFile.name}, 大小=${audioFile.length()} bytes")

            // 构建 multipart 请求
            val requestBody = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart(
                    "file",
                    audioFile.name,
                    audioFile.asRequestBody("audio/m4a".toMediaType())
                )
                .addFormDataPart("model", "whisper-1")
                .addFormDataPart("language", "zh") // 指定中文，提升准确率
                .addFormDataPart("response_format", "json")
                .build()

            val request = Request.Builder()
                .url(BASE_URL)
                .header("Authorization", "Bearer $apiKey")
                .post(requestBody)
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: throw Exception("空响应")

            if (!response.isSuccessful) {
                Log.e(TAG, "OpenAI Whisper API 错误 ${response.code}: $body")
                throw Exception("API 错误 ${response.code}")
            }

            val json = JSONObject(body)
            val text = json.getString("text").trim()
            Log.d(TAG, "OpenAI Whisper 转录成功: $text")
            return@withContext text.ifEmpty { null }

        } catch (e: Exception) {
            Log.e(TAG, "OpenAI Whisper 转录失败: ${e.message}")
            null
        }
    }
}
