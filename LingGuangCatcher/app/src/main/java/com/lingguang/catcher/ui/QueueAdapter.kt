package com.lingguang.catcher.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.lingguang.catcher.R
import com.lingguang.catcher.data.local.CaptureEntity
import com.lingguang.catcher.data.local.ProcessStatus
import com.lingguang.catcher.data.model.CaptureType
import com.lingguang.catcher.databinding.ItemQueueBinding
import java.util.*

class QueueAdapter(
    private val onRetryClick: (CaptureEntity) -> Unit,
    private val onDeleteClick: (CaptureEntity) -> Unit
) : ListAdapter<CaptureEntity, QueueAdapter.ViewHolder>(DiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemQueueBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position), onRetryClick, onDeleteClick)
    }

    class ViewHolder(private val binding: ItemQueueBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(
            capture: CaptureEntity,
            onRetryClick: (CaptureEntity) -> Unit,
            onDeleteClick: (CaptureEntity) -> Unit
        ) {
            // 类型图标 with capture-type color
            val iconRes = when (capture.type) {
                CaptureType.IMAGE -> R.drawable.ic_camera
                CaptureType.LINK -> R.drawable.ic_link
                CaptureType.TEXT -> R.drawable.ic_text
                CaptureType.VOICE -> R.drawable.ic_microphone
            }
            val iconColorRes = when (capture.type) {
                CaptureType.IMAGE -> R.color.capture_image
                CaptureType.LINK -> R.color.capture_link
                CaptureType.TEXT -> R.color.capture_text
                CaptureType.VOICE -> R.color.capture_voice
            }
            binding.tvTypeIcon.setImageResource(iconRes)
            binding.tvTypeIcon.setColorFilter(binding.root.context.getColor(iconColorRes))
            binding.tvTypeIcon.contentDescription = when (capture.type) {
                CaptureType.IMAGE -> "图片捕获"
                CaptureType.LINK -> "链接捕获"
                CaptureType.TEXT -> "文本捕获"
                CaptureType.VOICE -> "语音捕获"
            }

            // 标题
            binding.tvTitle.text = capture.title ?: when (capture.type) {
                CaptureType.IMAGE -> "图片捕获"
                CaptureType.LINK -> "链接捕获"
                CaptureType.TEXT -> "文本捕获"
                CaptureType.VOICE -> if (capture.rawContent.isEmpty()) "语音捕获（待转录）" else "语音捕获"
            }

            // 时间
            binding.tvTime.text = formatTime(capture.createdAt)

            // 状态
            when (capture.status) {
                ProcessStatus.PENDING -> {
                    binding.chipStatus.text = "待处理"
                    binding.chipStatus.setChipBackgroundColorResource(R.color.warning_container)
                }
                ProcessStatus.PROCESSING -> {
                    binding.chipStatus.text = "处理中"
                    binding.chipStatus.setChipBackgroundColorResource(R.color.md_theme_primaryContainer)
                }
                ProcessStatus.FAILED -> {
                    binding.chipStatus.text = "失败"
                    binding.chipStatus.setChipBackgroundColorResource(R.color.error_container)
                }
                ProcessStatus.SUCCESS -> {
                    binding.chipStatus.text = "成功"
                    binding.chipStatus.setChipBackgroundColorResource(R.color.success_container)
                }
            }

            // 错误信息
            if (capture.errorMessage != null) {
                binding.tvError.visibility = View.VISIBLE
                binding.tvError.text = "错误: ${capture.errorMessage}"
            } else {
                binding.tvError.visibility = View.GONE
            }

            // 重试次数
            if (capture.retryCount > 0) {
                binding.tvRetryCount.visibility = View.VISIBLE
                binding.tvRetryCount.text = "已重试 ${capture.retryCount} 次"
            } else {
                binding.tvRetryCount.visibility = View.GONE
            }

            // 按钮
            binding.btnRetry.setOnClickListener { onRetryClick(capture) }
            binding.btnDelete.setOnClickListener { onDeleteClick(capture) }
        }

        private fun formatTime(timestamp: Long): String {
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
        override fun areItemsTheSame(oldItem: CaptureEntity, newItem: CaptureEntity): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: CaptureEntity, newItem: CaptureEntity): Boolean {
            return oldItem == newItem
        }
    }

    companion object {
        private val DATE_FORMAT = java.text.DateFormat.getDateInstance(
            java.text.DateFormat.SHORT,
            Locale.getDefault()
        )
    }
}
