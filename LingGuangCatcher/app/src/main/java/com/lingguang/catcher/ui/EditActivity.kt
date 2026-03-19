package com.lingguang.catcher.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.lingguang.catcher.data.local.AppDatabase
import com.lingguang.catcher.data.local.CaptureEntity
import com.lingguang.catcher.data.repository.ObsidianRepository
import com.lingguang.catcher.databinding.ActivityEditBinding
import com.lingguang.catcher.util.FeedbackUtil
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private data class RawSection(
    val title: String,
    val content: String,
    val markdown: String
)

class EditActivity : AppCompatActivity() {

    private val rawSectionHeadings = listOf(
        "## 原始转写",
        "## 原始文本",
        "## 原始内容",
        "## 原始帖文",
        "## 原始字幕"
    )

    private lateinit var binding: ActivityEditBinding
    private val database by lazy { AppDatabase.getDatabase(applicationContext) }
    private val obsidianRepo by lazy { ObsidianRepository(applicationContext) }
    private var captureId: String? = null
    private var capture: CaptureEntity? = null
    private var rawSectionMarkdown: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityEditBinding.inflate(layoutInflater)
        setContentView(binding.root)

        captureId = intent.getStringExtra("CAPTURE_ID")
        if (captureId == null) {
            Toast.makeText(this, "无效的记录 ID", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        setupToolbar()
        setupButtons()
        loadCapture()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener { finish() }
    }

    private fun setupButtons() {
        binding.btnSave.setOnClickListener { saveChanges() }
        binding.btnPreview.setOnClickListener { showPreview() }
        binding.btnCopyTranscript.setOnClickListener { copyRawContent() }
    }

    private fun loadCapture() {
        lifecycleScope.launch {
            capture = withContext(Dispatchers.IO) {
                database.captureDao().getRecentCaptures(1000)
                    .find { it.id == captureId }
            }

            capture?.let { entity ->
                // 检查是否有 Markdown 内容
                if (entity.markdownContent.isNullOrBlank()) {
                    Toast.makeText(
                        this@EditActivity,
                        "该记录没有内容，无法编辑",
                        Toast.LENGTH_LONG
                    ).show()
                    finish()
                    return@launch
                }

                // 解析 Markdown 内容
                val content = entity.markdownContent

                // 先去除 Frontmatter，再拆分原始内容区块
                val contentWithoutFrontmatter = stripFrontmatter(content)
                val (editableBody, rawSection) = splitRawSection(contentWithoutFrontmatter)
                rawSectionMarkdown = rawSection?.markdown.orEmpty()
                val lines = editableBody.lines()

                // 提取标题（第一个 ## 标题）
                val titleLine = lines.find { it.startsWith("##") }
                val title = titleLine?.removePrefix("##")?.trim() ?: ""

                // 提取标签（查找 #标签 格式）
                val tagPattern = "#[\\w\\u4e00-\\u9fa5]+".toRegex()
                val tags = tagPattern.findAll(editableBody)
                    .map { it.value }
                    .distinct()
                    .joinToString(" ")

                // 内容（去除标题行，不包含原始内容区块）
                val contentWithoutTitle = lines.filterNot { it.startsWith("##") && it.contains(title) }
                    .joinToString("\n")
                    .trim()

                binding.etTitle.setText(title)
                binding.etTags.setText(tags)
                binding.etContent.setText(contentWithoutTitle)
                if (rawSection != null) {
                    binding.layoutRawTranscript.visibility = android.view.View.VISIBLE
                    binding.tilRawTranscript.hint = "${rawSection.title}（只读）"
                    binding.etRawTranscript.setText(rawSection.content)
                } else {
                    binding.layoutRawTranscript.visibility = android.view.View.GONE
                    binding.tilRawTranscript.hint = "原始内容（只读）"
                    binding.etRawTranscript.setText("")
                }
            } ?: run {
                Toast.makeText(this@EditActivity, "记录不存在", Toast.LENGTH_SHORT).show()
                finish()
            }
        }
    }

    private fun saveChanges() {
        val title = binding.etTitle.text.toString().trim()
        val tags = binding.etTags.text.toString().trim()
        val content = binding.etContent.text.toString().trim()

        if (title.isEmpty()) {
            Toast.makeText(this, "标题不能为空", Toast.LENGTH_SHORT).show()
            return
        }

        lifecycleScope.launch {
            try {
                // 从 Obsidian 文件中读取最新的 Frontmatter（而不是从数据库）
                val filename = capture?.filename
                val frontmatter = if (filename != null) {
                    val fileContent = withContext(Dispatchers.IO) {
                        obsidianRepo.readFile(filename)
                    }
                    if (fileContent.isSuccess) {
                        extractFrontmatter(fileContent.getOrNull() ?: "")
                    } else {
                        // 文件不存在，从数据库读取
                        extractFrontmatter(capture?.markdownContent ?: "")
                    }
                } else {
                    extractFrontmatter(capture?.markdownContent ?: "")
                }

                // 重新组装 Markdown（保留 Frontmatter 和原始内容）
                val markdown = buildString {
                    if (frontmatter.isNotEmpty()) {
                        append(frontmatter)
                        appendLine()
                        appendLine()
                    }
                    appendLine("## $title")
                    appendLine()
                    appendLine(content)
                    if (tags.isNotEmpty()) {
                        appendLine()
                        appendLine(tags)
                    }
                    if (rawSectionMarkdown.isNotBlank()) {
                        appendLine()
                        appendLine()
                        append(rawSectionMarkdown)
                    }
                }

                // 更新数据库
                capture?.let { entity ->
                    val updated = entity.copy(
                        markdownContent = markdown,
                        title = title,
                        updatedAt = System.currentTimeMillis()
                    )
                    withContext(Dispatchers.IO) {
                        database.captureDao().update(updated)
                    }

                    // 更新 Obsidian 文件
                    entity.filename?.let { filename ->
                        // 先检测文件是否存在
                        val exists = withContext(Dispatchers.IO) {
                            obsidianRepo.fileExists(filename)
                        }

                        if (!exists) {
                            // 文件不存在，让用户选择
                            showFileNotExistsDialog(filename, markdown, updated)
                        } else {
                            // 文件存在，直接更新
                            val result = obsidianRepo.updateFile(filename, markdown)
                            result.onSuccess {
                                FeedbackUtil.showToast(this@EditActivity, "✅ 已保存")
                                finish()
                            }.onFailure { error ->
                                FeedbackUtil.showToast(this@EditActivity, "保存失败: ${error.message}")
                            }
                        }
                    } ?: run {
                        FeedbackUtil.showToast(this@EditActivity, "✅ 已更新数据库")
                        finish()
                    }
                }
            } catch (e: Exception) {
                FeedbackUtil.showToast(this@EditActivity, "保存失败: ${e.message}")
            }
        }
    }

    private fun showPreview() {
        val title = binding.etTitle.text.toString().trim()
        val tags = binding.etTags.text.toString().trim()
        val content = binding.etContent.text.toString().trim()

        val preview = buildString {
            appendLine("## $title")
            appendLine()
            appendLine(content)
            if (tags.isNotEmpty()) {
                appendLine()
                appendLine(tags)
            }
            if (rawSectionMarkdown.isNotBlank()) {
                appendLine()
                appendLine()
                append(rawSectionMarkdown)
            }
        }

        AlertDialog.Builder(this)
            .setTitle("预览")
            .setMessage(preview)
            .setPositiveButton("确定", null)
            .show()
    }

    /**
     * 从 Markdown 内容中提取 Frontmatter
     * 返回完整的 Frontmatter 块（包括 --- 分隔符）
     */
    private fun extractFrontmatter(content: String): String {
        val lines = content.lines()
        if (lines.isEmpty()) return ""

        // 在前 40 行内查找 Frontmatter
        val searchLimit = minOf(lines.size, 40)
        var start = -1
        var end = -1

        for (i in 0 until searchLimit) {
            if (lines[i].trim() == "---") {
                start = i
                break
            }
        }

        if (start == -1) return ""

        for (j in (start + 1) until searchLimit) {
            if (lines[j].trim() == "---") {
                end = j
                break
            }
        }

        if (end == -1) return ""

        // 返回完整的 Frontmatter 块（包括 --- 分隔符）
        return lines.subList(start, end + 1).joinToString("\n")
    }

    /**
     * 从 Markdown 内容中删除 Frontmatter
     * 返回不包含 Frontmatter 的正文内容
     */
    private fun stripFrontmatter(content: String): String {
        val lines = content.lines()
        if (lines.isEmpty()) return content

        // 在前 40 行内查找 Frontmatter
        val searchLimit = minOf(lines.size, 40)
        var start = -1
        var end = -1

        for (i in 0 until searchLimit) {
            if (lines[i].trim() == "---") {
                start = i
                break
            }
        }

        if (start == -1) return content

        for (j in (start + 1) until searchLimit) {
            if (lines[j].trim() == "---") {
                end = j
                break
            }
        }

        if (end == -1) return content

        // 返回去除 Frontmatter 后的内容
        return lines.subList(end + 1, lines.size).joinToString("\n").trimStart()
    }

    private fun splitRawSection(content: String): Pair<String, RawSection?> {
        val marker = rawSectionHeadings
            .mapNotNull { heading ->
                content.indexOf(heading)
                    .takeIf { it >= 0 }
                    ?.let { heading to it }
            }
            .minByOrNull { it.second }
            ?: return content.trim() to null

        val body = content.substring(0, marker.second).trimEnd()
        val rawMarkdown = content.substring(marker.second).trim()
        val rawContent = rawMarkdown
            .removePrefix(marker.first)
            .trim()

        return body to RawSection(
            title = marker.first.removePrefix("##").trim(),
            content = rawContent,
            markdown = rawMarkdown
        )
    }

    private fun copyRawContent() {
        val transcript = binding.etRawTranscript.text?.toString()?.trim().orEmpty()
        if (transcript.isEmpty()) {
            FeedbackUtil.showToast(this, "没有可复制的原文")
            return
        }

        val clipboard = getSystemService(ClipboardManager::class.java)
        clipboard.setPrimaryClip(ClipData.newPlainText("raw_content", transcript))
        FeedbackUtil.showToast(this, "✅ 原文已复制")
    }

    private fun showFileNotExistsDialog(filename: String, markdown: String, updated: CaptureEntity) {
        AlertDialog.Builder(this)
            .setTitle("文件不存在")
            .setMessage("Obsidian 中的文件 \"$filename\" 已被删除，你可以选择：\n\n1. 重新推送：在 Obsidian 中创建新文件\n2. 清理记录：删除本地记录")
            .setPositiveButton("重新推送") { _, _ ->
                lifecycleScope.launch {
                    val doc = com.lingguang.catcher.data.model.MarkdownDocument(
                        filename = filename,
                        frontmatter = "",
                        content = markdown,
                        fullText = markdown
                    )
                    val result = obsidianRepo.writeToInbox(doc)
                    result.onSuccess {
                        FeedbackUtil.showToast(this@EditActivity, "✅ 已重新推送")
                        finish()
                    }.onFailure { error ->
                        FeedbackUtil.showToast(this@EditActivity, "推送失败: ${error.message}")
                    }
                }
            }
            .setNegativeButton("清理记录") { _, _ ->
                lifecycleScope.launch {
                    withContext(Dispatchers.IO) {
                        database.captureDao().delete(updated.id)
                    }
                    FeedbackUtil.showToast(this@EditActivity, "✅ 已清理记录")
                    finish()
                }
            }
            .setNeutralButton("取消", null)
            .show()
    }
}
