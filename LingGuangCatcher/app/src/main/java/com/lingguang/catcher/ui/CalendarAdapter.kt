package com.lingguang.catcher.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.lingguang.catcher.R
import com.lingguang.catcher.data.model.PhysicalAction

class CalendarAdapter : ListAdapter<PhysicalAction, CalendarAdapter.ViewHolder>(DiffCallback) {

    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvActionKind: TextView = view.findViewById(R.id.tv_action_kind)
        val tvDate: TextView = view.findViewById(R.id.tv_date)
        val tvSourceNote: TextView = view.findViewById(R.id.tv_source_note)
        val tvSummary: TextView = view.findViewById(R.id.tv_summary)

        fun bind(item: PhysicalAction) {
            tvActionKind.text = item.displayTitle
            tvDate.text = item.displayBadge
            tvSourceNote.text = "状态: ${item.status}"
            tvSummary.text = item.displaySummary
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.id.item_governance_card, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    companion object {
        private val DiffCallback = object : DiffUtil.ItemCallback<PhysicalAction>() {
            override fun areItemsTheSame(oldItem: PhysicalAction, newItem: PhysicalAction): Boolean {
                return oldItem.id == newItem.id
            }

            override fun areContentsTheSame(oldItem: PhysicalAction, newItem: PhysicalAction): Boolean {
                return oldItem == newItem
            }
        }
    }
}
