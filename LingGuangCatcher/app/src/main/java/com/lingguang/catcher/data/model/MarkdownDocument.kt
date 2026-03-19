package com.lingguang.catcher.data.model

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * AI 处理结果
 */
data class AIProcessResult(
    val success: Boolean,
    val markdown: String? = null,
    val yamlFrontmatter: Map<String, Any>? = null,
    val errorMessage: String? = null
)

/**
 * Markdown 文档
 */
data class MarkdownDocument(
    val filename: String,
    val frontmatter: String,  // YAML 前言
    val content: String,      // 正文内容
    val fullText: String      // 完整文本
) {
    companion object {
        fun create(
            type: String,
            dimension: String = "_inbox",
            status: String = "pending",
            priority: String = "medium",
            privacy: String = "private",
            date: String,
            tags: List<String>,
            source: String = "lingguang",
            content: String,
            imageFilename: String? = null,
            rawTranscript: String? = null,
            rawSectionTitle: String? = null,
            rawSectionContent: String? = null
        ): MarkdownDocument {
            val now = Date()
            val created = SimpleDateFormat("yyyy-MM-dd'T'HH:mm", Locale.getDefault()).format(now)
            val timeStr = SimpleDateFormat("HHmmss", Locale.getDefault()).format(now)

            val frontmatter = buildString {
                appendLine("---")
                appendLine("type: $type")
                appendLine("dimension: $dimension")
                appendLine("status: $status")
                appendLine("priority: $priority")
                appendLine("privacy: $privacy")
                appendLine("date: $date")
                appendLine("tags: [${tags.joinToString(", ")}]")
                appendLine("source: $source")
                appendLine("created: $created")
                appendLine("---")
            }

            val imageEmbed = if (imageFilename != null) "![[${imageFilename}]]\n\n" else ""
            val rawSection = rawTranscript
                ?.takeIf { it.isNotBlank() }
                ?.let {
                    "\n\n---\n\n## 原始转写\n\n$it"
                }
                ?: if (!rawSectionTitle.isNullOrBlank() && !rawSectionContent.isNullOrBlank()) {
                    "\n\n---\n\n## $rawSectionTitle\n\n$rawSectionContent"
                } else {
                    ""
                }
            val fullText = frontmatter + "\n" + imageEmbed + content + rawSection
            val filename = "${source}_${type}_${date}_${timeStr}.md"

            return MarkdownDocument(
                filename = filename,
                frontmatter = frontmatter,
                content = content,
                fullText = fullText
            )
        }
    }
}
