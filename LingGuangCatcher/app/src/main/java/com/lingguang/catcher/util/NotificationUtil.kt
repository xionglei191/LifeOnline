package com.lingguang.catcher.util

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.lingguang.catcher.R

object NotificationUtil {

    private const val CHANNEL_ID = "lingguang_sync"
    private const val CHANNEL_NAME = "后台处理通知"

    private const val COGNITION_CHANNEL_ID = "lingguang_cognition"
    private const val COGNITION_CHANNEL_NAME = "认知分析通知"

    private const val EXECUTION_CHANNEL_ID = "lingguang_execution"
    private const val EXECUTION_CHANNEL_NAME = "自动化执行通知"

    private var notificationId = 1000

    fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "AI 处理完成后通知"
                setShowBadge(true)
            }
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)

            val apiChannel = NotificationChannel(
                COGNITION_CHANNEL_ID,
                COGNITION_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "LifeOS 认知反馈与治理推送"
                setShowBadge(true)
            }
            manager.createNotificationChannel(apiChannel)

            val execChannel = NotificationChannel(
                EXECUTION_CHANNEL_ID,
                EXECUTION_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "物理动作执行结果推送（成功/失败/熔断）"
                setShowBadge(true)
                enableVibration(true)
            }
            manager.createNotificationChannel(execChannel)
        }
    }

    fun notifySuccess(context: Context, title: String, content: String) {
        createChannel(context)
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(content)
            .setStyle(NotificationCompat.BigTextStyle().bigText(content))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(notificationId++, notification)
        } catch (e: SecurityException) {
            // 用户未授予通知权限，静默忽略
        }
    }

    fun notifyFailure(context: Context, title: String, content: String) {
        createChannel(context)
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(content)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(notificationId++, notification)
        } catch (e: SecurityException) {
            // 用户未授予通知权限，静默忽略
        }
    }

    fun notifyCognition(context: Context, title: String, content: String) {
        createChannel(context)
        val notification = NotificationCompat.Builder(context, COGNITION_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_lightning_bolt) // you can use another relevant icon
            .setContentTitle(title)
            .setContentText(content)
            .setStyle(NotificationCompat.BigTextStyle().bigText(content))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(notificationId++, notification)
        } catch (e: SecurityException) {
            // ignore
        }
    }

    // ==================== 执行结果三级通知 ====================

    /**
     * 执行成功 — 普通优先级，可收起
     */
    fun notifyExecutionSuccess(context: Context, actionType: String, summary: String) {
        createChannel(context)
        val notification = NotificationCompat.Builder(context, EXECUTION_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_check)
            .setContentTitle("✅ 执行完成: $actionType")
            .setContentText(summary)
            .setStyle(NotificationCompat.BigTextStyle().bigText(summary))
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setAutoCancel(true)
            .setGroup("execution_results")
            .build()

        try {
            NotificationManagerCompat.from(context).notify(notificationId++, notification)
        } catch (e: SecurityException) { /* ignore */ }
    }

    /**
     * 执行失败 — 高优先级，前台弹出 + 震动
     */
    fun notifyExecutionFailure(context: Context, actionType: String, errorMsg: String) {
        createChannel(context)
        val notification = NotificationCompat.Builder(context, EXECUTION_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_close)
            .setContentTitle("❌ 执行失败: $actionType")
            .setContentText(errorMsg)
            .setStyle(NotificationCompat.BigTextStyle().bigText(errorMsg))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_VIBRATE or NotificationCompat.DEFAULT_SOUND)
            .setAutoCancel(true)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(notificationId++, notification)
        } catch (e: SecurityException) { /* ignore */ }
    }

    /**
     * 熔断触发 — 最高优先级特殊警报，持续显示
     */
    fun notifyBreakerTriggered(context: Context, actionType: String) {
        createChannel(context)
        val notification = NotificationCompat.Builder(context, EXECUTION_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_close)
            .setContentTitle("⚠️ 系统已熔断 $actionType 自动化")
            .setContentText("连续执行失败已触发安全保护，该类型已暂停自动审批。请在设置中检查。")
            .setStyle(NotificationCompat.BigTextStyle().bigText(
                "连续执行失败已触发安全保护，$actionType 类型已暂停自动审批。请在设置中检查或手动恢复。"
            ))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setOngoing(true) // 持续显示，不可划除
            .build()

        try {
            NotificationManagerCompat.from(context).notify(notificationId++, notification)
        } catch (e: SecurityException) { /* ignore */ }
    }
}
