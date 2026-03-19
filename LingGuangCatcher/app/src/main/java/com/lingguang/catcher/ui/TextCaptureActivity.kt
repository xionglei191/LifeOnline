package com.lingguang.catcher.ui

import android.os.Bundle
import android.util.Log
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import com.lingguang.catcher.data.local.AppDatabase
import com.lingguang.catcher.data.local.CaptureEntity
import com.lingguang.catcher.data.local.ProcessStatus
import com.lingguang.catcher.data.model.CaptureType
import com.lingguang.catcher.databinding.ActivityTextCaptureBinding
import com.lingguang.catcher.util.FeedbackUtil
import com.lingguang.catcher.worker.SyncWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.UUID

class TextCaptureActivity : AppCompatActivity() {

    private lateinit var binding: ActivityTextCaptureBinding
    private val TAG = "LingGuang"
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val database by lazy { AppDatabase.getDatabase(applicationContext) }

    private var isTextMode = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityTextCaptureBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupUI()
        handleIntent()
    }

    private fun setupUI() {
        binding.toolbar.setNavigationOnClickListener { finish() }

        // 根据 intent 参数设置默认模式
        val mode = intent.getStringExtra("mode")
        when (mode) {
            "link" -> {
                binding.toggleGroup.check(binding.btnLinkMode.id)
                isTextMode = false
                binding.cardTextInput.visibility = View.GONE
                binding.cardLinkInput.visibility = View.VISIBLE
            }
            else -> {
                binding.toggleGroup.check(binding.btnTextMode.id)
                isTextMode = true
                binding.cardTextInput.visibility = View.VISIBLE
                binding.cardLinkInput.visibility = View.GONE
            }
        }

        binding.toggleGroup.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (!isChecked) return@addOnButtonCheckedListener

            when (checkedId) {
                binding.btnTextMode.id -> {
                    isTextMode = true
                    binding.cardTextInput.visibility = View.VISIBLE
                    binding.cardLinkInput.visibility = View.GONE
                }
                binding.btnLinkMode.id -> {
                    isTextMode = false
                    binding.cardTextInput.visibility = View.GONE
                    binding.cardLinkInput.visibility = View.VISIBLE
                }
            }
        }

        binding.btnCancel.setOnClickListener { finish() }
        binding.btnSubmit.setOnClickListener { submitCapture() }
    }

    private fun handleIntent() {
        // 处理分享进来的内容
        if (intent?.action == android.content.Intent.ACTION_SEND) {
            val sharedText = intent.getStringExtra(android.content.Intent.EXTRA_TEXT)
            if (!sharedText.isNullOrBlank()) {
                // 判断是链接还是文本
                if (sharedText.startsWith("http://") || sharedText.startsWith("https://")) {
                    binding.toggleGroup.check(binding.btnLinkMode.id)
                    binding.etLinkInput.setText(sharedText)
                } else {
                    binding.toggleGroup.check(binding.btnTextMode.id)
                    binding.etTextInput.setText(sharedText)
                }
            }
        }
    }

    private fun submitCapture() {
        val content = if (isTextMode) {
            binding.etTextInput.text?.toString()?.trim()
        } else {
            binding.etLinkInput.text?.toString()?.trim()
        }

        if (content.isNullOrBlank()) {
            FeedbackUtil.showToast(this, "内容不能为空")
            return
        }

        // 链接模式验证 URL 格式
        if (!isTextMode && !content.startsWith("http://") && !content.startsWith("https://")) {
            FeedbackUtil.showToast(this, "请输入有效的链接地址")
            return
        }

        binding.btnSubmit.isEnabled = false
        binding.btnCancel.isEnabled = false

        saveToQueue(content)
    }

    private fun saveToQueue(content: String) {
        scope.launch(Dispatchers.IO) {
            try {
                val type = if (isTextMode) CaptureType.TEXT else CaptureType.LINK
                val entity = CaptureEntity(
                    id = UUID.randomUUID().toString(),
                    type = type,
                    rawContent = content,
                    metadata = "",
                    status = ProcessStatus.PENDING,
                    createdAt = System.currentTimeMillis(),
                    updatedAt = System.currentTimeMillis()
                )
                database.captureDao().insert(entity)
                Log.d(TAG, "${if (isTextMode) "文本" else "链接"}已加入离线队列: ${entity.id}")

                // 触发 SyncWorker
                val workRequest = OneTimeWorkRequestBuilder<SyncWorker>()
                    .addTag("sync")
                    .build()
                WorkManager.getInstance(applicationContext)
                    .enqueueUniqueWork("sync_queue", ExistingWorkPolicy.REPLACE, workRequest)

                runOnUiThread {
                    FeedbackUtil.captureSuccess(this@TextCaptureActivity)
                    FeedbackUtil.showToast(
                        this@TextCaptureActivity,
                        "${if (isTextMode) "📝" else "🔗"} 已提交到后台处理"
                    )
                    finish()
                }
            } catch (e: Exception) {
                Log.e(TAG, "保存到离线队列失败: ${e.message}", e)
                runOnUiThread {
                    FeedbackUtil.showToast(this@TextCaptureActivity, "保存失败: ${e.message}")
                    binding.btnSubmit.isEnabled = true
                    binding.btnCancel.isEnabled = true
                }
            }
        }
    }
}
