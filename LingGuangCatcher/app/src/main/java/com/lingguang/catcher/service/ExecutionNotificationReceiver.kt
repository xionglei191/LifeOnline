package com.lingguang.catcher.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.lingguang.catcher.util.NotificationUtil

/**
 * 接收来自 LifeOS 服务端（或本地 WorkManager）的物理动作执行结果广播。
 *
 * 三级推送策略：
 * - 成功 → 普通通知（可收起）
 * - 失败 → 高优先级通知（前台弹出 + 震动）
 * - 熔断触发 → 特殊警报（持续显示，不可滑除）
 *
 * 该 Receiver 是 WS 推送通道（LifeOSNotificationService）的补充降级通道——
 * 当 WS 断连时，后端可选择通过 FCM/轮询触发此 Receiver。
 */
class ExecutionNotificationReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "ExecNotifReceiver"

        const val ACTION_EXECUTION_RESULT = "com.lingguang.catcher.ACTION_EXECUTION_RESULT"

        // Intent extras
        const val EXTRA_RESULT_TYPE = "result_type"    // "success" | "failure" | "breaker"
        const val EXTRA_ACTION_TYPE = "action_type"    // e.g. "calendar_event"
        const val EXTRA_ACTION_ID = "action_id"
        const val EXTRA_SUMMARY = "summary"
        const val EXTRA_ERROR = "error"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_EXECUTION_RESULT) return

        val resultType = intent.getStringExtra(EXTRA_RESULT_TYPE) ?: return
        val actionType = intent.getStringExtra(EXTRA_ACTION_TYPE) ?: "unknown"
        val actionId = intent.getStringExtra(EXTRA_ACTION_ID) ?: ""

        Log.d(TAG, "Received execution result: type=$resultType, actionType=$actionType, id=$actionId")

        when (resultType) {
            "success" -> {
                val summary = intent.getStringExtra(EXTRA_SUMMARY) ?: "执行完成"
                NotificationUtil.notifyExecutionSuccess(context, actionType, summary)
            }
            "failure" -> {
                val error = intent.getStringExtra(EXTRA_ERROR) ?: "未知错误"
                NotificationUtil.notifyExecutionFailure(context, actionType, error)
            }
            "breaker" -> {
                NotificationUtil.notifyBreakerTriggered(context, actionType)
            }
            else -> {
                Log.w(TAG, "Unknown result_type: $resultType")
            }
        }
    }
}
