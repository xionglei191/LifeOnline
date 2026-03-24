package com.lingguang.catcher.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.lingguang.catcher.R
import com.lingguang.catcher.data.model.GovernanceItem
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

class GovernanceAdapter : ListAdapter<GovernanceItem, GovernanceAdapter.ViewHolder>(DiffCallback) {

    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvActionKind: TextView = view.findViewById(R.id.tv_action_kind)
        val tvDate: TextView = view.findViewById(R.id.tv_date)
        val tvSourceNote: TextView = view.findViewById(R.id.tv_source_note)
        val tvSummary: TextView = view.findViewById(R.id.tv_summary)

        fun bind(item: GovernanceItem) {
            tvActionKind.text = item.displayTitle
            // Since GovernanceItem doesn't directly expose createdAt without casting, 
            // and we want to keep interface clean, we'll just format the object properties.
            // But we can check type.
            tvDate.text = item.displayBadge
            tvSourceNote.text = ""
            tvSummary.text = item.displaySummary
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_governance_card, parent, false)
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
        private val DiffCallback = object : DiffUtil.ItemCallback<GovernanceItem>() {
            override fun areItemsTheSame(oldItem: GovernanceItem, newItem: GovernanceItem): Boolean {
                return oldItem.isSameAs(newItem)
            }

            override fun areContentsTheSame(oldItem: GovernanceItem, newItem: GovernanceItem): Boolean {
                return oldItem.id == newItem.id && oldItem.displaySummary == newItem.displaySummary
            }
        }
    }
}
