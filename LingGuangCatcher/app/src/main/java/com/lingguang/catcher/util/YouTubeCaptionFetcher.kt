package com.lingguang.catcher.util

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import org.xmlpull.v1.XmlPullParser
import org.xmlpull.v1.XmlPullParserFactory
import java.io.StringReader
import java.util.concurrent.TimeUnit

object YouTubeCaptionFetcher {

    data class CaptionFetchResult(
        val captions: String?,
        val langCode: String?,
        val debugInfo: String
    )

    private val TAG = "LingGuang"

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    /** 从 YouTube URL 提取视频 ID */
    fun extractVideoId(url: String): String? {
        val patterns = listOf(
            Regex("""youtube\.com/watch\?.*v=([a-zA-Z0-9_-]{11})"""),
            Regex("""youtu\.be/([a-zA-Z0-9_-]{11})"""),
            Regex("""youtube\.com/embed/([a-zA-Z0-9_-]{11})""")
        )
        for (pattern in patterns) {
            val match = pattern.find(url)
            if (match != null) return match.groupValues[1]
        }
        return null
    }

    /** 判断是否为 YouTube 链接 */
    fun isYouTubeUrl(url: String): Boolean = extractVideoId(url) != null

    /**
     * 获取字幕文本
     * 优先中文，其次英文，最后自动生成字幕
     */
    suspend fun fetchCaptionResult(videoId: String): CaptionFetchResult = withContext(Dispatchers.IO) {
        try {
            val pageHtml = fetchUrl("https://www.youtube.com/watch?v=$videoId")
                ?: return@withContext CaptionFetchResult(
                    captions = null,
                    langCode = null,
                    debugInfo = "字幕抓取失败：无法获取 YouTube 页面 HTML。"
                )

            val captionTracks = parseCaptionTracks(pageHtml)
                ?: return@withContext CaptionFetchResult(
                    captions = null,
                    langCode = null,
                    debugInfo = "字幕抓取失败：未解析到 captionTracks。"
                )

            if (captionTracks.isEmpty()) {
                Log.w(TAG, "YouTube: 无字幕轨道")
                return@withContext CaptionFetchResult(
                    captions = null,
                    langCode = null,
                    debugInfo = "字幕抓取失败：captionTracks 为空。"
                )
            }

            val preferred = captionTracks.firstOrNull { it.first.startsWith("zh") }
                ?: captionTracks.firstOrNull { it.first.startsWith("en") }
                ?: captionTracks.first()

            val (langCode, captionUrl) = preferred
            Log.d(TAG, "YouTube: 使用字幕语言 $langCode")
            Log.d(TAG, "YouTube: 原始字幕 URL ${captionUrl.take(300)}")

            val normalizedCaptionUrl = normalizeCaptionUrl(captionUrl)
            Log.d(TAG, "YouTube: 规范化字幕 URL ${normalizedCaptionUrl.take(300)}")
            val text = fetchCaptionText(normalizedCaptionUrl)

            if (text.isBlank()) {
                Log.w(TAG, "YouTube: 字幕文本为空")
                return@withContext CaptionFetchResult(
                    captions = null,
                    langCode = langCode,
                    debugInfo = buildString {
                        appendLine("字幕抓取失败，已回退网页正文。")
                        appendLine("视频 ID: $videoId")
                        appendLine("字幕语言: $langCode")
                        appendLine("原始字幕 URL: ${captionUrl.take(500)}")
                        appendLine("规范化字幕 URL: ${normalizedCaptionUrl.take(500)}")
                        append("结果: 字幕请求返回空内容或解析后为空。")
                    }.trim()
                )
            }

            Log.d(TAG, "YouTube: 字幕提取成功，长度 ${text.length}")
            CaptionFetchResult(
                captions = text,
                langCode = langCode,
                debugInfo = buildString {
                    appendLine("字幕抓取成功。")
                    appendLine("视频 ID: $videoId")
                    appendLine("字幕语言: $langCode")
                    append("规范化字幕 URL: ${normalizedCaptionUrl.take(500)}")
                }.trim()
            )
        } catch (e: Exception) {
            Log.e(TAG, "YouTube 字幕获取失败: ${e.message}")
            CaptionFetchResult(
                captions = null,
                langCode = null,
                debugInfo = "字幕抓取失败：${e.message ?: "未知异常"}"
            )
        }
    }

    suspend fun fetchCaptions(videoId: String): Pair<String, String>? {
        val result = fetchCaptionResult(videoId)
        return if (!result.captions.isNullOrBlank() && !result.langCode.isNullOrBlank()) {
            Pair(result.captions, result.langCode)
        } else {
            null
        }
    }

    /** 从页面 HTML 解析 captionTracks，返回 List<Pair<langCode, baseUrl>> */
    private fun parseCaptionTracks(html: String): List<Pair<String, String>>? {
        val regexes = listOf(
            Regex("""\"captionTracks\":(\[[^\]]*\])"""),
            Regex("""captionTracks":(\[[^\]]*\])""")
        )

        val jsonArrayString = regexes
            .asSequence()
            .mapNotNull { it.find(html)?.groupValues?.getOrNull(1) }
            .firstOrNull()
            ?: return null

        return try {
            val parsed = JSONTokener(jsonArrayString).nextValue() as? JSONArray ?: return null
            val result = mutableListOf<Pair<String, String>>()
            for (i in 0 until parsed.length()) {
                val obj = parsed.optJSONObject(i) ?: continue
                val baseUrl = obj.optString("baseUrl")
                if (baseUrl.isBlank()) continue
                val langCode = obj.optString("languageCode", "unknown")
                result.add(Pair(langCode, baseUrl))
            }
            result
        } catch (e: Exception) {
            Log.e(TAG, "解析 captionTracks 失败: ${e.message}")
            null
        }
    }

    private fun normalizeCaptionUrl(url: String): String {
        return if (url.contains("fmt=")) {
            url
        } else {
            val separator = if (url.contains("?")) "&" else "?"
            "$url${separator}fmt=json3"
        }
    }

    private fun fetchCaptionText(captionUrl: String): String {
        val payload = fetchUrl(captionUrl) ?: return ""
        val preview = payload.take(200).replace("\n", "\\n")
        Log.d(TAG, "YouTube: 字幕 payload 预览 $preview")

        if (payload.trimStart().startsWith("{")) {
            Log.d(TAG, "YouTube: 按 JSON3 解析字幕")
            val jsonText = parseCaptionJson(payload)
            if (jsonText.isNotBlank()) {
                return jsonText
            }
            Log.w(TAG, "YouTube: JSON3 字幕解析为空，尝试回退 XML")
            val xmlUrl = captionUrl.replace(Regex("([?&])fmt=json3(&)?"), "$1").trimEnd('&', '?')
            Log.d(TAG, "YouTube: XML 回退 URL ${xmlUrl.take(300)}")
            val xmlPayload = fetchUrl(xmlUrl).orEmpty()
            if (xmlPayload.isBlank()) {
                Log.w(TAG, "YouTube: XML 回退 payload 为空")
                return ""
            }
            Log.d(TAG, "YouTube: XML payload 预览 ${xmlPayload.take(200).replace("\n", "\\n")}")
            return parseCaptionXml(xmlPayload)
        }

        Log.d(TAG, "YouTube: 直接按 XML 解析字幕")
        return parseCaptionXml(payload)
    }

    private fun parseCaptionJson(json: String): String {
        return try {
            val events = JSONObject(json).optJSONArray("events") ?: return ""
            Log.d(TAG, "YouTube: JSON3 events 数量 ${events.length()}")
            buildString {
                for (i in 0 until events.length()) {
                    val event = events.optJSONObject(i) ?: continue
                    val segs = event.optJSONArray("segs") ?: continue
                    for (j in 0 until segs.length()) {
                        val seg = segs.optJSONObject(j) ?: continue
                        val text = seg.optString("utf8").trim()
                        if (text.isNotEmpty()) {
                            append(text).append(' ')
                        }
                    }
                }
            }
                .replace("\n", " ")
                .replace(Regex("\\s+"), " ")
                .trim()
        } catch (e: Exception) {
            Log.e(TAG, "解析字幕 JSON 失败: ${e.message}")
            ""
        }
    }

    /** 解析字幕 XML，提取纯文本 */
    private fun parseCaptionXml(xml: String): String {
        return try {
            val factory = XmlPullParserFactory.newInstance()
            val parser = factory.newPullParser()
            parser.setInput(StringReader(xml))
            val sb = StringBuilder()
            var eventType = parser.eventType
            var textNodeCount = 0
            while (eventType != XmlPullParser.END_DOCUMENT) {
                if (eventType == XmlPullParser.TEXT) {
                    val text = parser.text.trim()
                    if (text.isNotEmpty()) {
                        textNodeCount += 1
                        sb.append(text).append(" ")
                    }
                }
                eventType = parser.next()
            }
            Log.d(TAG, "YouTube: XML 文本节点数量 $textNodeCount")
            sb.toString()
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .trim()
        } catch (e: Exception) {
            Log.e(TAG, "解析字幕 XML 失败: ${e.message}")
            ""
        }
    }

    private fun fetchUrl(url: String): String? {
        return try {
            val request = Request.Builder()
                .url(url)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                .build()
            client.newCall(request).execute().body?.string()
        } catch (e: Exception) {
            Log.e(TAG, "HTTP 请求失败: $url — ${e.message}")
            null
        }
    }
}
