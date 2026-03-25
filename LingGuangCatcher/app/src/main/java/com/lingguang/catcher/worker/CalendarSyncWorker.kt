package com.lingguang.catcher.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.lingguang.catcher.data.api.LifeOSService
import com.lingguang.catcher.data.local.AppSettings
import com.lingguang.catcher.util.CalendarResolver
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

/**
 * 后台静默抓取维度数据（例如日历），同步到服务器的 Vault 目录中。
 */
class CalendarSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val appSettings = AppSettings.getInstance(applicationContext)

            // 如果全局自动化关闭，或日历同步开关关闭，则不执行
            if (!appSettings.autoGlobalEnabled || !appSettings.autoCalendarEnabled) {
                return@withContext Result.success()
            }

            // 获取未来 7 天日历
            val upcomingEvents = CalendarResolver.fetchUpcomingEvents(applicationContext, 7)
            if (upcomingEvents.isEmpty()) {
                return@withContext Result.success()
            }

            val eventsJsonArray = JSONArray()
            upcomingEvents.forEach { event ->
                val obj = JSONObject()
                obj.put("title", event.title)
                obj.put("description", event.description)
                obj.put("startTime", event.startTime)
                obj.put("endTime", event.endTime)
                obj.put("location", event.location)
                eventsJsonArray.put(obj)
            }

            val payload = JSONObject()
            payload.put("dimension", "environment")
            payload.put("source", "android_calendar")
            payload.put("events", eventsJsonArray)

            val lifeOSService = LifeOSService(appSettings.lifeosUrl.ifEmpty { "http://192.168.31.252:3000" })
            val syncResult = lifeOSService.syncEnvironmentData(payload)
            
            if (syncResult.isSuccess) {
                Result.success()
            } else {
                Result.retry()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure()
        }
    }
}
