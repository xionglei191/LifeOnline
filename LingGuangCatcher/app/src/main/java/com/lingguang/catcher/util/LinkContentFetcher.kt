package com.lingguang.catcher.util

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.jsoup.Jsoup
import java.util.concurrent.TimeUnit

object LinkContentFetcher {

    private val TAG = "LingGuang"
    private const val MAX_SEGMENT_LENGTH = 5000
    private const val MAX_TOTAL_LENGTH = 15000

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    data class PageContent(
        val text: String,
        val title: String?,
        val author: String?,
        val publishDate: String?,
        val articleType: String,   // news/tutorial/paper/product/social/general
        val segments: List<String> // 分段内容（长文章）
    )

    suspend fun fetch(url: String): PageContent = withContext(Dispatchers.IO) {
        val socialType = detectArticleType(url, null)

        // 1. 先尝试 Jina Reader
        val jinaText = fetchViaJina(url)
        if (jinaText != null && jinaText.length > 200) {
            Log.d(TAG, "Jina 抓取成功，长度: ${jinaText.length}")
            return@withContext buildPageContent(jinaText, null, url, socialType)
        }
        Log.w(TAG, "Jina 抓取失败或内容过短，尝试直接抓取")

        // 2. 直接 HTTP + Jsoup 解析
        val html = fetchRawHtml(url)
        if (html != null) {
            val doc = Jsoup.parse(html)
            doc.select("script, style, nav, footer, header, aside, .ad, .advertisement").remove()

            val title = doc.title().ifBlank { null }
            val author = doc.select("meta[name=author], [rel=author], .author, .byline")
                .firstOrNull()
                ?.text()
                ?.ifBlank { null }
            val publishDate = doc.select("meta[property=article:published_time], time[datetime], .date, .published")
                .firstOrNull()?.let {
                    it.attr("datetime").ifBlank { it.text() }
                }?.ifBlank { null }

            val bodyText = doc.body().text()
            Log.d(TAG, "直接抓取成功，长度: ${bodyText.length}")
            return@withContext buildPageContent(bodyText, PageMeta(title, author, publishDate), url, socialType)
        }

        Log.w(TAG, "所有抓取方式均失败")
        PageContent(
            text = "（无法获取页面内容，请根据链接进行分析）",
            title = null,
            author = null,
            publishDate = null,
            articleType = socialType,
            segments = emptyList()
        )
    }

    private fun buildPageContent(text: String, meta: PageMeta?, url: String, preferredType: String? = null): PageContent {
        val truncated = if (text.length > MAX_TOTAL_LENGTH) {
            text.take(MAX_TOTAL_LENGTH) + "\n...(内容已截断)"
        } else text

        val articleType = preferredType ?: detectArticleType(url, text)
        val segments = if (text.length > MAX_SEGMENT_LENGTH) {
            splitIntoSegments(truncated)
        } else emptyList()

        return PageContent(
            text = truncated,
            title = meta?.title,
            author = meta?.author,
            publishDate = meta?.publishDate,
            articleType = articleType,
            segments = segments
        )
    }

    /** 将长文本按段落分割，每段不超过 MAX_SEGMENT_LENGTH */
    private fun splitIntoSegments(text: String): List<String> {
        val segments = mutableListOf<String>()
        var start = 0
        while (start < text.length) {
            val end = minOf(start + MAX_SEGMENT_LENGTH, text.length)
            // 尽量在句号/换行处截断
            val cutPoint = if (end < text.length) {
                val lastBreak = text.lastIndexOf('\n', end)
                val lastPeriod = text.lastIndexOf('。', end)
                val best = maxOf(lastBreak, lastPeriod)
                if (best > start + MAX_SEGMENT_LENGTH / 2) best + 1 else end
            } else end
            segments.add(text.substring(start, cutPoint).trim())
            start = cutPoint
        }
        return segments.filter { it.isNotBlank() }
    }

    /** 识别文章类型 */
    private fun detectArticleType(url: String, text: String?): String {
        val lowerUrl = url.lowercase()
        val lowerText = text?.lowercase().orEmpty()

        val socialHosts = listOf(
            "x.com",
            "twitter.com",
            "weibo.com",
            "m.weibo.cn",
            "xiaohongshu.com",
            "www.xiaohongshu.com",
            "instagram.com",
            "www.instagram.com",
            "threads.net",
            "www.threads.net",
            "facebook.com",
            "www.facebook.com",
            "linkedin.com",
            "www.linkedin.com"
        )

        if (socialHosts.any { host -> lowerUrl.contains(host) }) {
            return "social"
        }

        return when {
            lowerText.contains("abstract") && lowerText.contains("conclusion") -> "paper"
            lowerText.contains("步骤") || lowerText.contains("教程") || lowerText.contains("how to") -> "tutorial"
            lowerText.contains("价格") || lowerText.contains("购买") || lowerText.contains("buy now") -> "product"
            lowerText.contains("转发") || lowerText.contains("评论") || lowerText.contains("likes") || lowerText.contains("repost") || lowerText.contains("post") -> "social"
            lowerText.contains("记者") || lowerText.contains("报道") || lowerText.contains("据悉") -> "news"
            else -> "general"
        }
    }

    private fun fetchViaJina(url: String): String? {
        return try {
            val request = Request.Builder()
                .url("https://r.jina.ai/$url")
                .header("Accept", "text/plain")
                .build()
            val text = client.newCall(request).execute().body?.string() ?: ""
            if (text.contains("无法访问") || text.contains("403") || text.contains("404")) null
            else text.ifBlank { null }
        } catch (e: Exception) {
            Log.w(TAG, "Jina 失败: ${e.message}")
            null
        }
    }

    private fun fetchRawHtml(url: String): String? {
        return try {
            val request = Request.Builder()
                .url(url)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                .build()
            client.newCall(request).execute().body?.string()
        } catch (e: Exception) {
            Log.w(TAG, "直接抓取失败: ${e.message}")
            null
        }
    }

    private data class PageMeta(
        val title: String?,
        val author: String?,
        val publishDate: String?
    )
}
