package com.lingguang.catcher.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.lingguang.catcher.R
import com.lingguang.catcher.data.model.ReintegrationRecord
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

class InsightsAdapter : ListAdapter<ReintegrationRecord, InsightsAdapter.ViewHolder>(DiffCallback) {

    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvDate: TextView = view.findViewById(R.id.tv_date)
        val tvBadge: TextView = view.findViewById(R.id.tv_badge)
        val tvTitle: TextView = view.findViewById(R.id.tv_insight_title)
        val tvSummary: TextView = view.findViewById(R.id.tv_insight_summary)
        
        val layoutDistilled: LinearLayout = view.findViewById(R.id.layout_distilled_insights)
        val tvDistilledContent: TextView = view.findViewById(R.id.tv_distilled_insights_content)
        
        val layoutContinuity: LinearLayout = view.findViewById(R.id.layout_continuity_signals)
        val tvContinuityContent: TextView = view.findViewById(R.id.tv_continuity_content)

        fun bind(item: ReintegrationRecord) {
            tvDate.text = formatIsoDate(item.createdAt)
            tvBadge.text = item.getSourceActionLabel()
            tvTitle.text = item.nextActionTitle ?: "深空回响"
            tvSummary.text = item.summary

            if (item.distilledInsights.isNotEmpty()) {
                layoutDistilled.visibility = View.VISIBLE
                tvDistilledContent.text = item.distilledInsights.joinToString("\n") { "• $it" }
            } else {
                layoutDistilled.visibility = View.GONE
            }

            if (item.continuitySignals.isNotEmpty()) {
                layoutContinuity.visibility = View.VISIBLE
                tvContinuityContent.text = item.continuitySignals.joinToString("\n") { "• $it" }
            } else {
                layoutContinuity.visibility = View.GONE
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.id.item_insight_card, parent, false)
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
            val formatter = SimpleDateFormat("yyyy/MM/dd HH:mm", Locale.getDefault())
            formatter.timeZone = TimeZone.getDefault()
            return formatter.format(date)
        } catch (e: Exception) {
            return isoDate
        }
    }

    companion object {
        private val DiffCallback = object : DiffUtil.ItemCallback<ReintegrationRecord>() {
            override fun areItemsTheSame(oldItem: ReintegrationRecord, newItem: ReintegrationRecord): Boolean {
                return oldItem.id == newItem.id
            }

            override fun areContentsTheSame(oldItem: ReintegrationRecord, newItem: ReintegrationRecord): Boolean {
                return oldItem == newItem
            }
        }
    }
}
