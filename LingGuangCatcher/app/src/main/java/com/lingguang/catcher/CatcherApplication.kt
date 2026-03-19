package com.lingguang.catcher

import android.app.Application
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.lingguang.catcher.util.CrashLogger
import com.lingguang.catcher.util.NetworkMonitor

class CatcherApplication : Application() {

    private lateinit var networkMonitor: NetworkMonitor

    override fun onCreate() {
        super.onCreate()
        instance = this

        // 初始化崩溃日志收集器
        CrashLogger.init(this)

        // 初始化网络监听器
        networkMonitor = NetworkMonitor(this)
        networkMonitor.startMonitoring {
            // 网络恢复时，触发 SyncWorker
            val workRequest = OneTimeWorkRequestBuilder<com.lingguang.catcher.worker.SyncWorker>()
                .addTag("sync")
                .build()
            WorkManager.getInstance(this)
                .enqueueUniqueWork("sync_queue", ExistingWorkPolicy.REPLACE, workRequest)
        }
    }

    override fun onTerminate() {
        super.onTerminate()
        networkMonitor.stopMonitoring()
    }

    companion object {
        lateinit var instance: CatcherApplication
            private set
    }
}
