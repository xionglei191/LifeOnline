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
}
