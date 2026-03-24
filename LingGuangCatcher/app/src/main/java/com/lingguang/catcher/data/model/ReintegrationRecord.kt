package com.lingguang.catcher.data.model

import org.json.JSONObject

data class ReintegrationRecord(
    val id: String,
    val summary: String,
    val createdAt: String,
    val signalKind: String,
    val distilledInsights: List<String>,
    val continuitySignals: List<String>,
    val nextActionTitle: String?
) {
    fun getSourceActionLabel(): String {
        return when (signalKind) {
            "summary_reintegration" -> "摘要回流"
            "classification_reintegration" -> "分类回流"
            "task_extraction_reintegration" -> "任务提取回流"
            "persona_snapshot_reintegration" -> "从记忆锚点提炼"
            "daily_report_reintegration" -> "日报回流"
            "weekly_report_reintegration" -> "周报回流"
            "openclaw_reintegration" -> "全视野反思"
            "promote_event_node" -> "从记忆锚点提炼"
            "promote_continuity_record" -> "岁月指引升华"
            "launch_openclaw_task" -> "全视野反思"
            else -> "跨维度联想"
        }
    }

    companion object {
        fun fromJson(json: JSONObject): ReintegrationRecord {
            val evidence = json.optJSONObject("evidence")
            
            val insightsArray = evidence?.optJSONArray("distilledInsights")
            val insights = mutableListOf<String>()
            if (insightsArray != null) {
                for (i in 0 until insightsArray.length()) {
                    insights.add(insightsArray.getString(i))
                }
            }

            val continuityArray = evidence?.optJSONArray("continuitySignals")
            val continuity = mutableListOf<String>()
            if (continuityArray != null) {
                for (i in 0 until continuityArray.length()) {
                    continuity.add(continuityArray.getString(i))
                }
            }

            var nextAction = json.optJSONObject("nextActionSummary")?.optString("candidateTitle", null)
            if (nextAction.isNullOrEmpty()) {
                nextAction = evidence?.optJSONObject("nextActionCandidate")?.optString("title", null)
            }
            if (nextAction.isNullOrEmpty()) {
                nextAction = null
            }

            return ReintegrationRecord(
                id = json.optString("id", ""),
                summary = json.optString("summary", ""),
                createdAt = json.optString("createdAt", ""),
                signalKind = json.optString("signalKind", ""),
                distilledInsights = insights,
                continuitySignals = continuity,
                nextActionTitle = nextAction
            )
        }
    }
}
