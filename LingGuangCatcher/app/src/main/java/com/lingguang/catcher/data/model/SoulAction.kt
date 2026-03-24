package com.lingguang.catcher.data.model

import org.json.JSONObject

data class SoulAction(
    override val id: String,
    val actionKind: String,
    val governanceStatus: String,
    val resultSummary: String?,
    val sourceNoteId: String,
    val createdAt: String
) : GovernanceItem {

    override val displayTitle: String
        get() = getActionKindLabel()
        
    override val displaySummary: String
        get() = resultSummary ?: "暂无描述"
        
    override val displayBadge: String
        get() = "认知重塑"

    override fun isPhysicalAction(): Boolean = false

    fun getActionKindLabel(): String {
        return when (actionKind) {
            "ask_followup_question" -> "提出追问"
            "persist_continuity_markdown" -> "持久化连续性洞察"
            "sync_continuity_to_r2" -> "同步到冷存储"
            "extract_tasks" -> "提取任务"
            "update_persona_snapshot" -> "更新 Persona Snapshot"
            "create_event_node" -> "创建 Event Node"
            "promote_event_node" -> "提升 Event Node"
            "promote_continuity_record" -> "提升 Continuity Record"
            "launch_daily_report" -> "生成日报"
            "launch_weekly_report" -> "生成周报"
            "launch_openclaw_task" -> "执行 OpenClaw 任务"
            else -> actionKind
        }
    }

    companion object {
        fun fromJson(json: JSONObject): SoulAction {
            return SoulAction(
                id = json.optString("id", ""),
                actionKind = json.optString("actionKind", ""),
                governanceStatus = json.optString("governanceStatus", ""),
                resultSummary = if (json.has("resultSummary") && !json.isNull("resultSummary")) json.getString("resultSummary") else null,
                sourceNoteId = json.optString("sourceNoteId", ""),
                createdAt = json.optString("createdAt", "")
            )
        }
    }
}
