package com.lingguang.catcher.ui

import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.lingguang.catcher.data.local.AppDatabase
import com.lingguang.catcher.data.local.CaptureEntity
import com.lingguang.catcher.data.local.ProcessStatus
import com.lingguang.catcher.databinding.ActivityQueueBinding
import com.lingguang.catcher.util.FeedbackUtil
import com.lingguang.catcher.worker.SyncWorker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File

class QueueActivity : AppCompatActivity() {

    private lateinit var binding: ActivityQueueBinding
    private val database by lazy { AppDatabase.getDatabase(applicationContext) }
    private lateinit var adapter: QueueAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityQueueBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupToolbar()
        setupRecyclerView()
        setupButtons()
        loadQueue()
    }

    override fun onResume() {
        super.onResume()
        loadQueue()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener { finish() }
    }

    private fun setupRecyclerView() {
        adapter = QueueAdapter(
            onRetryClick = { capture ->
                retryCapture(capture)
            },
            onDeleteClick = { capture ->
                confirmDelete(capture)
            }
        )
        binding.rvQueue.layoutManager = LinearLayoutManager(this)
        binding.rvQueue.adapter = adapter
    }

    private fun setupButtons() {
        binding.btnRetryAll.setOnClickListener {
            retryAll()
        }

        binding.btnClearFailed.setOnClickListener {
            confirmClearFailed()
        }
    }

    private fun loadQueue() {
        lifecycleScope.launch {
            val allCaptures = withContext(Dispatchers.IO) {
                database.captureDao().getRecentCaptures(1000)
                    .filter { it.status != ProcessStatus.SUCCESS }
            }

            updateStats(allCaptures)
            updateUI(allCaptures)
        }
    }

    private fun updateStats(captures: List<CaptureEntity>) {
        val pendingCount = captures.count { it.status == ProcessStatus.PENDING }
        val processingCount = captures.count { it.status == ProcessStatus.PROCESSING }
        val failedCount = captures.count { it.status == ProcessStatus.FAILED }

        binding.tvPendingCount.text = pendingCount.toString()
        binding.tvProcessingCount.text = processingCount.toString()
        binding.tvFailedCount.text = failedCount.toString()
    }

    private fun updateUI(captures: List<CaptureEntity>) {
        if (captures.isEmpty()) {
            binding.rvQueue.visibility = View.GONE
            binding.layoutEmpty.visibility = View.VISIBLE
            binding.layoutActions.visibility = View.GONE
        } else {
            binding.rvQueue.visibility = View.VISIBLE
            binding.layoutEmpty.visibility = View.GONE
            binding.layoutActions.visibility = View.VISIBLE
            adapter.submitList(captures)
        }
    }

    private fun retryCapture(capture: CaptureEntity) {
        lifecycleScope.launch {
            withContext(Dispatchers.IO) {
                database.captureDao().update(
                    capture.copy(
                        status = ProcessStatus.PENDING,
                        errorMessage = null,
                        updatedAt = System.currentTimeMillis()
                    )
                )
            }
            triggerSync()
            FeedbackUtil.showToast(this@QueueActivity, "已加入重试队列")
            loadQueue()
        }
    }

    private fun confirmDelete(capture: CaptureEntity) {
        MaterialAlertDialogBuilder(this)
            .setTitle("删除记录")
            .setMessage("确定要删除这条记录吗？")
            .setPositiveButton("删除") { _, _ ->
                deleteCapture(capture)
            }
            .setNegativeButton("取消", null)
            .show()
    }

    private fun deleteCapture(capture: CaptureEntity) {
        lifecycleScope.launch {
            withContext(Dispatchers.IO) {
                cleanupAudioFile(capture)
                database.captureDao().delete(capture.id)
            }
            FeedbackUtil.showToast(this@QueueActivity, "✅ 已删除")
            loadQueue()
        }
    }

    private fun retryAll() {
        lifecycleScope.launch {
            val failedCaptures = withContext(Dispatchers.IO) {
                database.captureDao().getRecentCaptures(1000)
                    .filter { it.status == ProcessStatus.FAILED || it.status == ProcessStatus.PENDING }
            }

            if (failedCaptures.isEmpty()) {
                FeedbackUtil.showToast(this@QueueActivity, "没有需要重试的记录")
                return@launch
            }

            withContext(Dispatchers.IO) {
                failedCaptures.forEach { capture ->
                    database.captureDao().update(
                        capture.copy(
                            status = ProcessStatus.PENDING,
                            errorMessage = null,
                            updatedAt = System.currentTimeMillis()
                        )
                    )
                }
            }

            triggerSync()
            FeedbackUtil.showToast(this@QueueActivity, "已重试 ${failedCaptures.size} 条记录")
            loadQueue()
        }
    }

    private fun confirmClearFailed() {
        lifecycleScope.launch {
            val failedCount = withContext(Dispatchers.IO) {
                database.captureDao().getRecentCaptures(1000)
                    .count { it.status == ProcessStatus.FAILED }
            }

            if (failedCount == 0) {
                FeedbackUtil.showToast(this@QueueActivity, "没有失败的记录")
                return@launch
            }

            MaterialAlertDialogBuilder(this@QueueActivity)
                .setTitle("清除失败记录")
                .setMessage("确定要删除 $failedCount 条失败记录吗？")
                .setPositiveButton("删除") { _, _ ->
                    clearFailed()
                }
                .setNegativeButton("取消", null)
                .show()
        }
    }

    private fun clearFailed() {
        lifecycleScope.launch {
            val failedCaptures = withContext(Dispatchers.IO) {
                database.captureDao().getRecentCaptures(1000)
                    .filter { it.status == ProcessStatus.FAILED }
            }

            withContext(Dispatchers.IO) {
                failedCaptures.forEach { capture ->
                    cleanupAudioFile(capture)
                    database.captureDao().delete(capture.id)
                }
            }

            FeedbackUtil.showToast(this@QueueActivity, "✅ 已删除 ${failedCaptures.size} 条记录")
            loadQueue()
        }
    }

    private fun cleanupAudioFile(capture: CaptureEntity) {
        try {
            if (capture.metadata.isNotEmpty()) {
                val json = JSONObject(capture.metadata)
                val audioPath = json.optString("audio_path", "")
                if (audioPath.isNotEmpty()) {
                    val file = File(audioPath)
                    if (file.exists()) {
                        file.delete()
                    }
                }
            }
        } catch (_: Exception) { }
    }

    private fun triggerSync() {
        val workRequest = SyncWorker.buildWorkRequest()
        WorkManager.getInstance(this)
            .enqueueUniqueWork(
                "sync_queue",
                androidx.work.ExistingWorkPolicy.KEEP,
                workRequest
            )
    }
}
