package com.lingguang.catcher.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import com.lingguang.catcher.data.local.AppDatabase
import com.lingguang.catcher.data.local.ProcessStatus
import com.lingguang.catcher.data.model.CaptureRecord
import com.lingguang.catcher.data.model.CaptureType
import com.lingguang.catcher.data.repository.CaptureRepository
import com.lingguang.catcher.data.repository.ObsidianRepository
import com.lingguang.catcher.util.FeedbackUtil
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

/**
 * 分享接收器 Activity
 * 处理来自其他 App 的分享内容
 */
class ShareReceiverActivity : AppCompatActivity() {

    private val repository by lazy { CaptureRepository(applicationContext) }
    private val obsidianRepo by lazy { ObsidianRepository(applicationContext) }
    private val database by lazy { AppDatabase.getDatabase(applicationContext) }
    private val TAG = "LingGuang"
    // 使用独立的 scope，不依赖 Activity 生命周期
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 透明界面，不显示任何 UI
        when (intent?.action) {
            Intent.ACTION_SEND -> handleSendIntent(intent)
            else -> finish()
        }
    }

    private fun handleSendIntent(intent: Intent) {
        val type = intent.type ?: run {
            finish()
            return
        }

        when {
            type.startsWith("text/") -> handleTextShare(intent)
            type.startsWith("image/") -> handleImageShare(intent)
            else -> {
                FeedbackUtil.showToast(this, "不支持的分享类型")
                finish()
            }
        }
    }

    private fun handleTextShare(intent: Intent) {
        val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT) ?: run {
            finish()
            return
        }

        // 判断是链接还是纯文本
        val captureType = if (sharedText.startsWith("http://") || sharedText.startsWith("https://")) {
            CaptureType.LINK
        } else {
            CaptureType.TEXT
        }

        val record = CaptureRecord(
            id = UUID.randomUUID().toString(),
            type = captureType,
            rawContent = sharedText
        )

        // 调用 AI 处理并保存
        processCapture(record)
    }

    private fun handleImageShare(intent: Intent) {
        val uri = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
        } ?: run {
            finish()
            return
        }
        FeedbackUtil.captureSuccess(this)

        scope.launch {
            // 把 URI 内容复制到 cache，再传给 AI 处理
            val imageFile = withContext(Dispatchers.IO) {
                try {
                    val file = File(cacheDir, "shared_image_${System.currentTimeMillis()}.jpg")
                    contentResolver.openInputStream(uri)?.use { input ->
                        file.outputStream().use { output -> input.copyTo(output) }
                    }
                    file
                } catch (e: Exception) {
                    null
                }
            }

            if (imageFile == null || !imageFile.exists()) {
                FeedbackUtil.captureError(this@ShareReceiverActivity, "无法读取图片")
                finish()
                return@launch
            }

            val record = CaptureRecord(
                id = UUID.randomUUID().toString(),
                type = CaptureType.IMAGE,
                rawContent = imageFile.absolutePath
            )

            try {
                val result = repository.processCaptureRecord(record)
                result.onSuccess { markdown ->
                    Log.d(TAG, "✅ 图片 Markdown 生成成功: ${markdown.filename}")
                    com.lingguang.catcher.util.ResultCache.latestMarkdown = markdown.fullText
                    com.lingguang.catcher.util.ResultCache.latestFilename = markdown.filename

                    val writeResult = obsidianRepo.writeToInbox(markdown)
                    writeResult.onSuccess { filename ->
                        // 保存到数据库
                        saveToDatabase(record, markdown.fullText, filename)
                        FeedbackUtil.showToast(this@ShareReceiverActivity, "✅ 已保存到 Obsidian: $filename")
                    }.onFailure {
                        Log.d(TAG, "未写入 Obsidian: ${it.message}")
                        // 仍然保存到数据库
                        saveToDatabase(record, markdown.fullText, null)
                    }
                }.onFailure { error ->
                    FeedbackUtil.captureError(this@ShareReceiverActivity, error.message ?: "处理失败")
                }
            } catch (e: Exception) {
                FeedbackUtil.captureError(this@ShareReceiverActivity, e.message ?: "异常")
            } finally {
                imageFile.delete()
                finish()
            }
        }
    }

    private fun processCapture(record: CaptureRecord) {
        FeedbackUtil.captureSuccess(this)

        scope.launch {
            try {
                val result = repository.processCaptureRecord(record)
                result.onSuccess { markdown ->
                    Log.d(TAG, "✅ Markdown 生成成功: ${markdown.filename}")
                    com.lingguang.catcher.util.ResultCache.latestMarkdown = markdown.fullText
                    com.lingguang.catcher.util.ResultCache.latestFilename = markdown.filename

                    // 写入 Obsidian
                    val writeResult = obsidianRepo.writeToInbox(markdown)
                    writeResult.onSuccess { filename ->
                        // 保存到数据库
                        saveToDatabase(record, markdown.fullText, filename)
                        FeedbackUtil.showToast(this@ShareReceiverActivity, "✅ 已保存到 Obsidian: $filename")
                    }.onFailure {
                        // 没设置 Vault 也不报错，静默处理
                        Log.d(TAG, "未写入 Obsidian: ${it.message}")
                        // 仍然保存到数据库
                        saveToDatabase(record, markdown.fullText, null)
                    }
                }.onFailure { error ->
                    FeedbackUtil.captureError(this@ShareReceiverActivity, error.message ?: "未知错误")
                }
            } catch (e: Exception) {
                FeedbackUtil.captureError(this@ShareReceiverActivity, e.message ?: "处理异常")
            } finally {
                finish()
            }
        }
    }

    private fun saveToDatabase(record: CaptureRecord, markdownContent: String, filename: String?) {
        scope.launch(Dispatchers.IO) {
            try {
                // 提取标题
                val titleLine = markdownContent.lines().find { it.startsWith("##") }
                val title = titleLine?.removePrefix("##")?.trim()

                val entity = com.lingguang.catcher.data.local.CaptureEntity(
                    id = record.id,
                    type = record.type,
                    rawContent = record.rawContent,
                    metadata = org.json.JSONObject(record.metadata).toString(),
                    status = ProcessStatus.SUCCESS,
                    createdAt = System.currentTimeMillis(),
                    updatedAt = System.currentTimeMillis(),
                    markdownContent = markdownContent,
                    filename = filename,
                    title = title
                )
                database.captureDao().insert(entity)
                Log.d(TAG, "✅ 已保存到数据库: ${record.id}")
            } catch (e: Exception) {
                Log.e(TAG, "保存到数据库失败: ${e.message}")
            }
        }
    }
}
