package com.lingguang.catcher.ui

import android.os.Bundle
import android.os.Environment
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.lingguang.catcher.data.local.AppDatabase
import com.lingguang.catcher.data.local.AppSettings
import com.lingguang.catcher.data.local.ProcessStatus
import com.lingguang.catcher.databinding.ActivityExportBinding
import com.lingguang.catcher.util.FeedbackUtil
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.*
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class ExportActivity : AppCompatActivity() {

    private lateinit var binding: ActivityExportBinding
    private val database by lazy { AppDatabase.getDatabase(applicationContext) }
    private val settings by lazy { AppSettings.getInstance(applicationContext) }

    private var exportRange = ExportRange.ALL
    private var exportAsZip = true

    enum class ExportRange {
        ALL,
        LAST_7_DAYS,
        LAST_30_DAYS
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityExportBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupToolbar()
        setupRangeSelection()
        setupFormatSelection()
        setupExportButton()
        updateExportInfo()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener { finish() }
    }

    private fun setupRangeSelection() {
        binding.chipGroupRange.setOnCheckedStateChangeListener { _, checkedIds ->
            exportRange = when (checkedIds.firstOrNull()) {
                binding.chipAll.id -> ExportRange.ALL
                binding.chipLast7Days.id -> ExportRange.LAST_7_DAYS
                binding.chipLast30Days.id -> ExportRange.LAST_30_DAYS
                else -> ExportRange.ALL
            }
            updateExportInfo()
        }
    }

    private fun setupFormatSelection() {
        binding.chipGroupFormat.setOnCheckedStateChangeListener { _, checkedIds ->
            exportAsZip = checkedIds.firstOrNull() == binding.chipZip.id
        }
    }

    private fun setupExportButton() {
        binding.btnExport.setOnClickListener {
            performExport()
        }
    }

    private fun updateExportInfo() {
        lifecycleScope.launch {
            val captures = withContext(Dispatchers.IO) {
                val allCaptures = database.captureDao().getRecentCaptures(10000)
                    .filter { it.status == ProcessStatus.SUCCESS && !it.markdownContent.isNullOrBlank() }

                when (exportRange) {
                    ExportRange.ALL -> allCaptures
                    ExportRange.LAST_7_DAYS -> {
                        val cutoff = System.currentTimeMillis() - 7 * 24 * 60 * 60 * 1000
                        allCaptures.filter { it.createdAt >= cutoff }
                    }
                    ExportRange.LAST_30_DAYS -> {
                        val cutoff = System.currentTimeMillis() - 30 * 24 * 60 * 60 * 1000
                        allCaptures.filter { it.createdAt >= cutoff }
                    }
                }
            }

            val parts = mutableListOf<String>()
            if (binding.cbNotes.isChecked) {
                parts.add("${captures.size} 条笔记")
            }
            if (binding.cbSettings.isChecked) {
                parts.add("应用设置")
            }

            binding.tvExportInfo.text = if (parts.isEmpty()) {
                "请选择要导出的内容"
            } else {
                "将导出 ${parts.joinToString("、")}"
            }
        }
    }

    private fun performExport() {
        if (!binding.cbNotes.isChecked && !binding.cbSettings.isChecked) {
            FeedbackUtil.showToast(this, "请至少选择一项导出内容")
            return
        }

        binding.btnExport.isEnabled = false
        binding.btnExport.text = "导出中..."

        lifecycleScope.launch {
            try {
                val result = withContext(Dispatchers.IO) {
                    exportData()
                }

                showExportSuccess(result)
            } catch (e: Exception) {
                FeedbackUtil.showToast(this@ExportActivity, "导出失败: ${e.message}")
            } finally {
                binding.btnExport.isEnabled = true
                binding.btnExport.text = "📦 开始导出"
            }
        }
    }

    private suspend fun exportData(): File {
        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val exportDir = File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
            "LingGuangCatcher_$timestamp"
        )

        if (!exportDir.exists()) {
            exportDir.mkdirs()
        }

        // 导出笔记
        if (binding.cbNotes.isChecked) {
            exportNotes(exportDir)
        }

        // 导出设置
        if (binding.cbSettings.isChecked) {
            exportSettings(exportDir)
        }

        // 生成导出报告
        generateReport(exportDir)

        // 如果选择 ZIP 格式，压缩文件夹
        return if (exportAsZip) {
            val zipFile = File(exportDir.parent, "${exportDir.name}.zip")
            zipDirectory(exportDir, zipFile)
            exportDir.deleteRecursively()
            zipFile
        } else {
            exportDir
        }
    }

    private suspend fun exportNotes(exportDir: File) {
        val notesDir = File(exportDir, "notes")
        notesDir.mkdirs()

        val captures = database.captureDao().getRecentCaptures(10000)
            .filter { it.status == ProcessStatus.SUCCESS && !it.markdownContent.isNullOrBlank() }

        val filteredCaptures = when (exportRange) {
            ExportRange.ALL -> captures
            ExportRange.LAST_7_DAYS -> {
                val cutoff = System.currentTimeMillis() - 7 * 24 * 60 * 60 * 1000
                captures.filter { it.createdAt >= cutoff }
            }
            ExportRange.LAST_30_DAYS -> {
                val cutoff = System.currentTimeMillis() - 30 * 24 * 60 * 60 * 1000
                captures.filter { it.createdAt >= cutoff }
            }
        }

        filteredCaptures.forEach { capture ->
            val filename = capture.filename ?: "note_${capture.id}.md"
            val file = File(notesDir, filename)
            file.writeText(capture.markdownContent ?: "")
        }
    }

    private fun exportSettings(exportDir: File) {
        val settingsJson = JSONObject().apply {
            put("aiServiceType", settings.aiServiceType.name)
            put("sttServiceType", settings.sttServiceType.name)
            put("imageQuality", settings.imageQuality)
            put("edgeDetectionThreshold", settings.edgeDetectionThreshold)
            put("exportDate", System.currentTimeMillis())
        }

        val file = File(exportDir, "settings.json")
        file.writeText(settingsJson.toString(2))
    }

    private suspend fun generateReport(exportDir: File) {
        val captures = database.captureDao().getRecentCaptures(10000)
            .filter { it.status == ProcessStatus.SUCCESS }

        val report = buildString {
            appendLine("# 灵光捕手 - 导出报告")
            appendLine()
            appendLine("导出时间: ${SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date())}")
            appendLine()
            appendLine("## 统计信息")
            appendLine()
            if (binding.cbNotes.isChecked) {
                appendLine("- 笔记数量: ${captures.size}")
            }
            if (binding.cbSettings.isChecked) {
                appendLine("- 应用设置: 已导出")
            }
            appendLine()
            appendLine("## 导出范围")
            appendLine()
            appendLine(when (exportRange) {
                ExportRange.ALL -> "- 全部笔记"
                ExportRange.LAST_7_DAYS -> "- 最近 7 天"
                ExportRange.LAST_30_DAYS -> "- 最近 30 天"
            })
        }

        val file = File(exportDir, "README.md")
        file.writeText(report)
    }

    private fun zipDirectory(sourceDir: File, zipFile: File) {
        ZipOutputStream(FileOutputStream(zipFile)).use { zos ->
            sourceDir.walkTopDown().forEach { file ->
                val zipEntry = ZipEntry(file.relativeTo(sourceDir).path)
                if (file.isFile) {
                    zos.putNextEntry(zipEntry)
                    file.inputStream().use { it.copyTo(zos) }
                    zos.closeEntry()
                }
            }
        }
    }

    private fun showExportSuccess(file: File) {
        MaterialAlertDialogBuilder(this)
            .setTitle("导出成功")
            .setMessage("文件已保存到:\n${file.absolutePath}")
            .setPositiveButton("确定") { _, _ ->
                finish()
            }
            .show()
    }
}
