package com.lingguang.catcher.data.model

import org.json.JSONObject

data class PhysicalAction(
    override val id: String,
    val actionType: String,
    val status: String,
    val payload: JSONObject?,
    val resultContext: String?,
    val createdAt: String
) : GovernanceItem {

    override val displayTitle: String
        get() = getActionTypeLabel()
        
    override val displaySummary: String
        get() {
            if (actionType == "calendar_event") {
                val title = payload?.optString("title", "未知日程")
                return "建议日程: $title"
            }
            return resultContext ?: "请求执行: $actionType"
        }
        
    override val displayBadge: String
        get() = "执行系统"

    override fun isPhysicalAction(): Boolean = true

    fun getActionTypeLabel(): String {
        return when (actionType) {
            "calendar_event" -> "预约日程"
            "send_email" -> "发送邮件"
            "webhook_call" -> "执行 Webhook"
            else -> actionType
        }
    }

    companion object {
        fun fromJson(json: JSONObject): PhysicalAction {
            return PhysicalAction(
                id = json.optString("id", ""),
                actionType = json.optString("actionType", ""),
                status = json.optString("status", ""),
                payload = json.optJSONObject("payload"),
                resultContext = if (json.has("resultContext") && !json.isNull("resultContext")) json.getString("resultContext") else null,
                createdAt = json.optString("createdAt", "")
            )
        }
    }
}
