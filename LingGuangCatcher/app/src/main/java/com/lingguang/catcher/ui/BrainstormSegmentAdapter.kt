package com.lingguang.catcher.ui

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.lingguang.catcher.databinding.ItemBrainstormSegmentBinding

data class BrainstormSegment(
    val id: String,
    val audioFile: java.io.File,
    var transcription: String? = null,
    var isTranscribing: Boolean = false,
    val duration: Long = 0L
)

class BrainstormSegmentAdapter(
    private val onDelete: (Int) -> Unit,
    private val onEdit: (Int, String) -> Unit
) : ListAdapter<BrainstormSegment, BrainstormSegmentAdapter.ViewHolder>(DIFF) {

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<BrainstormSegment>() {
            override fun areItemsTheSame(a: BrainstormSegment, b: BrainstormSegment) = a.id == b.id
            override fun areContentsTheSame(a: BrainstormSegment, b: BrainstormSegment) =
                a.transcription == b.transcription && a.isTranscribing == b.isTranscribing
        }
    }

    inner class ViewHolder(val binding: ItemBrainstormSegmentBinding) :
        RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemBrainstormSegmentBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val segment = getItem(position)
        holder.binding.apply {
            tvSegmentIndex.text = "${position + 1}"
            tvDuration.text = formatDuration(segment.duration)
            when {
                segment.isTranscribing -> {
                    tvTranscription.text = "🔄 转录中..."
                }
                segment.transcription.isNullOrBlank() -> {
                    tvTranscription.text = "⏳ 等待转录"
                }
                else -> {
                    tvTranscription.text = segment.transcription
                }
            }
            btnDelete.setOnClickListener { onDelete(position) }
            btnEdit.setOnClickListener {
                android.util.Log.d("BrainstormAdapter", "编辑按钮点击: position=$position, isTranscribing=${segment.isTranscribing}, transcription=${segment.transcription?.take(20)}")
                if (!segment.transcription.isNullOrBlank() && !segment.isTranscribing) {
                    onEdit(position, segment.transcription!!)
                }
            }
            // 转录中或无内容时禁用编辑按钮
            btnEdit.isEnabled = !segment.isTranscribing && !segment.transcription.isNullOrBlank()
            btnEdit.alpha = if (btnEdit.isEnabled) 1.0f else 0.3f
            android.util.Log.d("BrainstormAdapter", "段落 ${position + 1}: isEnabled=${btnEdit.isEnabled}, isTranscribing=${segment.isTranscribing}, hasTranscription=${!segment.transcription.isNullOrBlank()}")
        }
    }

    private fun formatDuration(ms: Long): String {
        val seconds = (ms / 1000).toInt()
        val minutes = seconds / 60
        val secs = seconds % 60
        return String.format("%02d:%02d", minutes, secs)
    }
}
