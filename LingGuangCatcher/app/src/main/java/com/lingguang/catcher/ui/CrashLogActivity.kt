package com.lingguang.catcher.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.lingguang.catcher.databinding.ActivityCrashLogBinding
import com.lingguang.catcher.util.CrashLogger
import com.lingguang.catcher.util.FeedbackUtil
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

class CrashLogActivity : AppCompatActivity() {

    private lateinit var binding: ActivityCrashLogBinding
    private val adapter = LogFileAdapter()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCrashLogBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupToolbar()
        setupRecyclerView()
        loadLogs()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener { finish() }
        binding.toolbar.setOnMenuItemClickListener { menuItem ->
            when (menuItem.itemId) {
                android.R.id.home -> { finish(); true }
                else -> false
            }
        }
    }

    private fun setupRecyclerView() {
        binding.rvLogs.layoutManager = LinearLayoutManager(this)
        binding.rvLogs.adapter = adapter

        adapter.onItemClick = { file ->
            showLogContent(file)
        }

        adapter.onShareClick = { file ->
            shareLogFile(file)
        }

        adapter.onDeleteClick = { file ->
            confirmDelete(file)
        }
    }

    private fun loadLogs() {
        val logFiles = CrashLogger.getLogFiles(this)
        if (logFiles.isEmpty()) {
            binding.tvEmpty.visibility = View.VISIBLE
            binding.rvLogs.visibility = View.GONE
            binding.btnClearAll.visibility = View.GONE
        } else {
            binding.tvEmpty.visibility = View.GONE
            binding.rvLogs.visibility = View.VISIBLE
            binding.btnClearAll.visibility = View.VISIBLE
            adapter.submitList(logFiles)
        }

        binding.btnClearAll.setOnClickListener {
            confirmClearAll()
        }
    }

    private fun showLogContent(file: File) {
        val content = file.readText()
        MaterialAlertDialogBuilder(this)
            .setTitle(file.name)
            .setMessage(content)
            .setPositiveButton("关闭", null)
            .setNeutralButton("分享") { _, _ -> shareLogFile(file) }
            .show()
    }

    private fun shareLogFile(file: File) {
        try {
            val uri = FileProvider.getUriForFile(
                this,
                "${packageName}.fileprovider",
                file
            )
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, "灵光捕手崩溃日志")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(Intent.createChooser(intent, "分享日志"))
        } catch (e: Exception) {
            FeedbackUtil.showToast(this, "分享失败: ${e.message}")
        }
    }

    private fun confirmDelete(file: File) {
        MaterialAlertDialogBuilder(this)
            .setTitle("删除日志")
            .setMessage("确定要删除这个日志文件吗？")
            .setPositiveButton("删除") { _, _ ->
                file.delete()
                loadLogs()
                FeedbackUtil.showToast(this, "已删除")
            }
            .setNegativeButton("取消", null)
            .show()
    }

    private fun confirmClearAll() {
        MaterialAlertDialogBuilder(this)
            .setTitle("清空所有日志")
            .setMessage("确定要删除所有日志文件吗？")
            .setPositiveButton("清空") { _, _ ->
                CrashLogger.clearAllLogs(this)
                loadLogs()
                FeedbackUtil.showToast(this, "已清空")
            }
            .setNegativeButton("取消", null)
            .show()
    }

    // Adapter
    private class LogFileAdapter : RecyclerView.Adapter<LogFileAdapter.ViewHolder>() {

        private var items = listOf<File>()
        var onItemClick: ((File) -> Unit)? = null
        var onShareClick: ((File) -> Unit)? = null
        var onDeleteClick: ((File) -> Unit)? = null

        fun submitList(files: List<File>) {
            items = files
            notifyDataSetChanged()
        }

        override fun onCreateViewHolder(parent: android.view.ViewGroup, viewType: Int): ViewHolder {
            val view = android.view.LayoutInflater.from(parent.context)
                .inflate(com.lingguang.catcher.R.layout.item_log_file, parent, false)
            return ViewHolder(view)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            holder.bind(items[position])
        }

        override fun getItemCount() = items.size

        inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            private val tvFileName: android.widget.TextView = view.findViewById(com.lingguang.catcher.R.id.tv_file_name)
            private val tvFileInfo: android.widget.TextView = view.findViewById(com.lingguang.catcher.R.id.tv_file_info)
            private val btnShare: com.google.android.material.button.MaterialButton = view.findViewById(com.lingguang.catcher.R.id.btn_share)
            private val btnDelete: com.google.android.material.button.MaterialButton = view.findViewById(com.lingguang.catcher.R.id.btn_delete)

            fun bind(file: File) {
                tvFileName.text = file.name
                val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
                val size = file.length() / 1024.0
                tvFileInfo.text = "${dateFormat.format(Date(file.lastModified()))} · ${String.format("%.1f", size)} KB"

                itemView.setOnClickListener { onItemClick?.invoke(file) }
                btnShare.setOnClickListener { onShareClick?.invoke(file) }
                btnDelete.setOnClickListener { onDeleteClick?.invoke(file) }
            }
        }
    }
}
