package com.lingguang.catcher.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.lingguang.catcher.R
import com.lingguang.catcher.data.model.SoulAction
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

class GovernanceAdapter : ListAdapter<SoulAction, GovernanceAdapter.ViewHolder>(DiffCallback) {

    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvActionKind: TextView = view.findViewById(R.id.tv_action_kind)
        val tvDate: TextView = view.findViewById(R.id.tv_date)
        val tvSourceNote: TextView = view.findViewById(R.id.tv_source_note)
        val tvSummary: TextView = view.findViewById(R.id.tv_summary)

        fun bind(item: SoulAction) {
            tvActionKind.text = item.getActionKindLabel()
            tvDate.text = formatIsoDate(item.createdAt)
            tvSourceNote.text = "来源记录: ${item.sourceNoteId}"
            tvSummary.text = item.resultSummary ?: "暂无详细建议"
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.id.item_soul_action_card, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    private fun formatIsoDate(isoDate: String): String {
        try {
            val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
            parser.timeZone = TimeZone.getTimeZone("UTC")
            val date = parser.parse(isoDate) ?: return isoDate
            val formatter = SimpleDateFormat("MM-dd HH:mm", Locale.getDefault())
            formatter.timeZone = TimeZone.getDefault()
            return formatter.format(date)
        } catch (e: Exception) {
            return isoDate
        }
    }

    companion object {
        private val DiffCallback = object : DiffUtil.ItemCallback<SoulAction>() {
            override fun areItemsTheSame(oldItem: SoulAction, newItem: SoulAction): Boolean {
                return oldItem.id == newItem.id
            }

            override fun areContentsTheSame(oldItem: SoulAction, newItem: SoulAction): Boolean {
                return oldItem == newItem
            }
        }
    }
}
