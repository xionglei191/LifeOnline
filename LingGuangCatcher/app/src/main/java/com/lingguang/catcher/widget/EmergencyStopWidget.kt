package com.lingguang.catcher.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.Toast
import com.lingguang.catcher.R
import com.lingguang.catcher.data.api.LifeOSService
import com.lingguang.catcher.data.local.AppSettings
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class EmergencyStopWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (ACTION_EMERGENCY_STOP == intent.action) {
            triggerEmergencyStop(context)
        }
    }

    private fun updateAppWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.widget_emergency_stop)
        
        val intent = Intent(context, EmergencyStopWidget::class.java).apply {
            action = ACTION_EMERGENCY_STOP
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        views.setOnClickPendingIntent(R.id.btn_emergency_stop, pendingIntent)

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun triggerEmergencyStop(context: Context) {
        val appSettings = AppSettings.getInstance(context)
        
        // 1. 本地断开权限
        appSettings.autoGlobalEnabled = false
        
        // 2. 显示 Toast 给用户立即反馈
        Toast.makeText(context, "已触发急停：端侧权限已锁死", Toast.LENGTH_SHORT).show()
        
        // 3. 异步呼叫服务端
        val url = appSettings.lifeosUrl.ifEmpty { "http://192.168.31.246:3000" }
        val service = LifeOSService(url)
        
        CoroutineScope(Dispatchers.IO).launch {
            val result = service.emergencyStop()
            if (result.isSuccess) {
                CoroutineScope(Dispatchers.Main).launch {
                    Toast.makeText(context, "服务端急停信号已确认", Toast.LENGTH_SHORT).show()
                }
            } else {
                CoroutineScope(Dispatchers.Main).launch {
                    Toast.makeText(context, "服务端急停失败，请检查网络", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    companion object {
        const val ACTION_EMERGENCY_STOP = "com.lingguang.catcher.ACTION_EMERGENCY_STOP"
    }
}
