package com.lingguang.catcher.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.lingguang.catcher.R
import com.lingguang.catcher.data.api.LifeOSWsClient
import com.lingguang.catcher.data.api.LifeOSWsListener
import com.lingguang.catcher.data.local.AppSettings
import com.lingguang.catcher.util.NotificationUtil

class LifeOSNotificationService : Service(), LifeOSWsListener {

    private var wsClient: LifeOSWsClient? = null
    private val FOREGROUND_SERVICE_ID = 2000

    override fun onCreate() {
        super.onCreate()
        createForegroundNotificationChannel()
        startForeground(FOREGROUND_SERVICE_ID, createForegroundNotification())
        
        val lifeosUrl = AppSettings.getInstance(this).lifeosUrl
        if (lifeosUrl.isNotEmpty()) {
            wsClient = LifeOSWsClient(lifeosUrl, this)
            wsClient?.connect()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Sticky service will automatically restart if killed
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onDestroy() {
        super.onDestroy()
        wsClient?.disconnect()
    }

    // --- LifeOSWsListener Events ---
    override fun onConnected() {
        // Notification connected
    }

    override fun onDisconnected() {
        // Reconnect logic can be added here
        val lifeosUrl = AppSettings.getInstance(this).lifeosUrl
        if (lifeosUrl.isNotEmpty()) {
            Thread.sleep(5000)
            wsClient?.connect()
        }
    }

    override fun onIndexFinished(summary: String, successCount: Int) {
        val title = "LifeOS 节点已索引"
        val msg = "提取了 $successCount 个新内容：$summary"
        NotificationUtil.notifyCognition(this, title, msg)
    }

    override fun onSoulActionCreated(actionDesc: String) {
        val title = "LifeOS 需要你"
        val msg = "由于新的进展，产生了一个推断：$actionDesc"
        NotificationUtil.notifyCognition(this, title, msg)
    }

    private fun createForegroundNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "lingguang_ws_service",
                "认知推送服务",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "保持 LifeOnline 的实时认知连接"
                setShowBadge(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun createForegroundNotification() =
        NotificationCompat.Builder(this, "lingguang_ws_service")
            .setSmallIcon(R.drawable.ic_brainstorm_orb) // fallback icon
            .setContentTitle("LifeOS 推送通道运行中")
            .setContentText("正在保持与个人知识库的直连")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
}
