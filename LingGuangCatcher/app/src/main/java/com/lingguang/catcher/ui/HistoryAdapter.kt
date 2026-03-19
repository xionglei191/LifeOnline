package com.lingguang.catcher.ui

import android.content.Intent
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.appcompat.app.AlertDialog
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.lingguang.catcher.data.local.CaptureEntity
import com.lingguang.catcher.data.local.ProcessStatus
import com.lingguang.catcher.data.model.CaptureType
import com.lingguang.catcher.databinding.ItemHistoryBinding
import java.util.*

class HistoryAdapter(
    private val onItemClick: ((CaptureEntity) -> Unit)? = null,
    private val onDeleteClick: (CaptureEntity) -> Unit,
    private val onItemLongClick: ((CaptureEntity) -> Unit)? = null
) : ListAdapter<CaptureEntity, HistoryAdapter.ViewHolder>(DiffCallback()) {

    private var selectionMode = false
    private val selectedItems = mutableSetOf<String>()

    fun setSelectionMode(enabled: Boolean) {
        selectionMode = enabled
        if (!enabled) {
            selectedItems.clear()
        }
        notifyItemRangeChanged(0, itemCount)
    }

    fun isSelectionMode() = selectionMode

    fun toggleSelection(captureId: String) {
        val position = currentList.indexOfFirst { it.id == captureId }
        if (selectedItems.contains(captureId)) {
            selectedItems.remove(captureId)
        } else {
            selectedItems.add(captureId)
        }
        if (position >= 0) notifyItemChanged(position)
    }

    fun getSelectedItems(): List<CaptureEntity> {
        return currentList.filter { selectedItems.contains(it.id) }
    }

    fun getSelectedCount() = selectedItems.size

    fun selectAll() {
        val prev = selectedItems.toSet()
        selectedItems.clear()
        selectedItems.addAll(currentList.map { it.id })
        // 只刷新状态变化的 item
        currentList.forEachIndexed { index, item ->
            if (!prev.contains(item.id)) notifyItemChanged(index)
        }
    }

    fun clearSelection() {
        val prev = selectedItems.toSet()
        selectedItems.clear()
        currentList.forEachIndexed { index, item ->
            if (prev.contains(item.id)) notifyItemChanged(index)
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemHistoryBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val capture = getItem(position)
        val isSelected = selectedItems.contains(capture.id)
        holder.bind(capture, isSelected, selectionMode, onItemClick, onDeleteClick, onItemLongClick) {
            toggleSelection(capture.id)
        }
    }

    class ViewHolder(private val binding: ItemHistoryBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(
            capture: CaptureEntity,
            isSelected: Boolean,
            selectionMode: Boolean,
            onItemClick: ((CaptureEntity) -> Unit)?,
            onDeleteClick: (CaptureEntity) -> Unit,
            onItemLongClick: ((CaptureEntity) -> Unit)?,
            onToggleSelection: () -> Unit
        ) {
            // Type icon with capture-type color
            val iconRes = when (capture.type) {
                CaptureType.IMAGE -> com.lingguang.catcher.R.drawable.ic_camera
                CaptureType.LINK -> com.lingguang.catcher.R.drawable.ic_link
                CaptureType.TEXT -> com.lingguang.catcher.R.drawable.ic_text
                CaptureType.VOICE -> com.lingguang.catcher.R.drawable.ic_microphone
            }
            val iconColorRes = when (capture.type) {
                CaptureType.IMAGE -> com.lingguang.catcher.R.color.capture_image
                CaptureType.LINK -> com.lingguang.catcher.R.color.capture_link
                CaptureType.TEXT -> com.lingguang.catcher.R.color.capture_text
                CaptureType.VOICE -> com.lingguang.catcher.R.color.capture_voice
            }
            binding.tvTypeIcon.setImageResource(iconRes)
            binding.tvTypeIcon.setColorFilter(binding.root.context.getColor(iconColorRes))
            binding.tvTypeIcon.contentDescription = when (capture.type) {
                CaptureType.IMAGE -> "图片捕获"
                CaptureType.LINK -> "链接捕获"
                CaptureType.TEXT -> "文本捕获"
                CaptureType.VOICE -> "语音捕获"
            }

            // Content preview
            binding.tvContent.text = when (capture.type) {
                CaptureType.IMAGE -> capture.title ?: "图片捕获"
                CaptureType.LINK, CaptureType.TEXT -> {
                    (capture.title ?: capture.rawContent).take(50).let {
                        if ((capture.title ?: capture.rawContent).length > 50) "$it..." else it
                    }
                }
                CaptureType.VOICE -> capture.title ?: "语音捕获"
            }

            // Status
            val statusIconRes = when (capture.status) {
                ProcessStatus.SUCCESS -> com.lingguang.catcher.R.drawable.ic_check_circle
                ProcessStatus.PENDING -> com.lingguang.catcher.R.drawable.ic_history
                ProcessStatus.PROCESSING -> com.lingguang.catcher.R.drawable.ic_history
                ProcessStatus.FAILED -> com.lingguang.catcher.R.drawable.ic_info
            }
            binding.tvStatus.setImageResource(statusIconRes)

            val statusTint = when (capture.status) {
                ProcessStatus.SUCCESS -> com.lingguang.catcher.R.color.success
                ProcessStatus.FAILED -> com.lingguang.catcher.R.color.error
                else -> com.lingguang.catcher.R.color.warning
            }
            binding.tvStatus.setColorFilter(
                binding.root.context.getColor(statusTint)
            )
            binding.tvStatus.contentDescription = when (capture.status) {
                ProcessStatus.SUCCESS -> "已完成"
                ProcessStatus.PENDING -> "等待处理"
                ProcessStatus.PROCESSING -> "处理中"
                ProcessStatus.FAILED -> "处理失败"
            }

            // Timestamp
            binding.tvTimestamp.text = formatTimestamp(capture.createdAt)

            // Progress indicator for PENDING/PROCESSING/FAILED status
            when (capture.status) {
                ProcessStatus.PENDING, ProcessStatus.PROCESSING -> {
                    binding.progressBar.visibility = View.VISIBLE
                    binding.tvProgressInfo.visibility = View.VISIBLE

                    // Show indeterminate progress for PROCESSING
                    if (capture.status == ProcessStatus.PROCESSING) {
                        binding.progressBar.isIndeterminate = true
                        binding.tvProgressInfo.text = "正在处理..."
                    } else {
                        // Show retry count for PENDING
                        binding.progressBar.isIndeterminate = false
                        binding.progressBar.progress = (capture.retryCount * 10).coerceAtMost(100)
                        if (capture.retryCount > 0) {
                            binding.tvProgressInfo.text = "重试 ${capture.retryCount}/10"
                        } else {
                            binding.tvProgressInfo.text = "等待处理..."
                        }
                    }
                }
                ProcessStatus.FAILED -> {
                    binding.progressBar.visibility = View.GONE
                    binding.tvProgressInfo.visibility = View.VISIBLE
                    binding.tvProgressInfo.text = "失败: ${capture.errorMessage ?: "未知错误"}"
                    binding.tvProgressInfo.setTextColor(
                        binding.root.context.getColor(com.lingguang.catcher.R.color.error)
                    )
                }
                ProcessStatus.SUCCESS -> {
                    binding.progressBar.visibility = View.GONE
                    binding.tvProgressInfo.visibility = View.GONE
                }
            }

            // Selection mode
            if (selectionMode) {
                binding.checkboxSelect.visibility = View.VISIBLE
                binding.checkboxSelect.isChecked = isSelected
                binding.btnEdit.visibility = View.GONE
                binding.btnDelete.visibility = View.GONE

                // 选中状态使用主题色描边
                binding.root.isChecked = isSelected
                binding.root.strokeWidth = if (isSelected) 2 else 0
                binding.root.strokeColor = if (isSelected) {
                    binding.root.context.getColor(com.lingguang.catcher.R.color.md_theme_primary)
                } else {
                    0
                }
                binding.root.alpha = 1.0f
            } else {
                binding.checkboxSelect.visibility = View.GONE
                binding.btnEdit.visibility = View.VISIBLE
                binding.btnDelete.visibility = View.VISIBLE
                binding.root.isChecked = false
                binding.root.strokeWidth = 0
                binding.root.alpha = 1.0f
            }

            // Edit button (only for successful captures with content)
            val hasContent = capture.status == ProcessStatus.SUCCESS &&
                             !capture.markdownContent.isNullOrBlank()

            binding.btnEdit.isEnabled = hasContent
            binding.btnEdit.isClickable = hasContent

            if (hasContent) {
                binding.btnEdit.setOnClickListener {
                    val intent = Intent(binding.root.context, EditActivity::class.java)
                    intent.putExtra("CAPTURE_ID", capture.id)
                    binding.root.context.startActivity(intent)
                }
            } else {
                binding.btnEdit.setOnClickListener(null)
            }

            // Item click
            binding.root.setOnClickListener {
                if (selectionMode) {
                    onToggleSelection()
                } else if (hasContent) {
                    onItemClick?.invoke(capture)
                }
            }

            // Long click to enter selection mode
            binding.root.setOnLongClickListener {
                if (!selectionMode) {
                    onItemLongClick?.invoke(capture)
                    true
                } else {
                    false
                }
            }

            // Delete button
            binding.btnDelete.setOnClickListener {
                AlertDialog.Builder(binding.root.context)
                    .setTitle("删除记录")
                    .setMessage("确定要删除这条记录吗？")
                    .setPositiveButton("删除") { _, _ ->
                        onDeleteClick(capture)
                    }
                    .setNegativeButton("取消", null)
                    .show()
            }
        }

        private fun formatTimestamp(timestamp: Long): String {
            val now = System.currentTimeMillis()
            val diff = now - timestamp

            return when {
                diff < 60_000 -> "刚刚"
                diff < 3600_000 -> "${diff / 60_000} 分钟前"
                diff < 86400_000 -> "${diff / 3600_000} 小时前"
                diff < 604800_000 -> "${diff / 86400_000} 天前"
                else -> DATE_FORMAT.format(Date(timestamp))
            }
        }
    }

    class DiffCallback : DiffUtil.ItemCallback<CaptureEntity>() {
        override fun areItemsTheSame(oldItem: CaptureEntity, newItem: CaptureEntity) =
            oldItem.id == newItem.id

        override fun areContentsTheSame(oldItem: CaptureEntity, newItem: CaptureEntity) =
            oldItem == newItem
    }

    companion object {
        private val DATE_FORMAT = java.text.DateFormat.getDateTimeInstance(
            java.text.DateFormat.SHORT,
            java.text.DateFormat.SHORT,
            Locale.getDefault()
        )
    }
}
