package com.lingguang.catcher.util

import android.content.Context
import android.util.Log
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.*

/**
 * 本地崩溃日志收集器
 * 捕获未处理异常并保存到本地文件
 */
object CrashLogger {
    private const val TAG = "CrashLogger"
    private const val LOG_DIR = "crash_logs"
    private const val MAX_LOG_FILES = 10 // 最多保留 10 个日志文件

    private var context: Context? = null
    private var defaultHandler: Thread.UncaughtExceptionHandler? = null

    /**
     * 初始化崩溃日志收集器
     * 应在 Application.onCreate() 中调用
     */
    fun init(appContext: Context) {
        context = appContext.applicationContext
        defaultHandler = Thread.getDefaultUncaughtExceptionHandler()

        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            handleException(thread, throwable)
            // 调用系统默认处理器
            defaultHandler?.uncaughtException(thread, throwable)
        }

        // 清理旧日志
        cleanOldLogs()
    }

    /**
     * 处理异常并保存日志
     */
    private fun handleException(thread: Thread, throwable: Throwable) {
        try {
            val logContent = buildLogContent(thread, throwable)
            saveLog(logContent)
            Log.e(TAG, "崩溃日志已保存", throwable)
        } catch (e: Exception) {
            Log.e(TAG, "保存崩溃日志失败", e)
        }
    }

    /**
     * 构建日志内容
     */
    private fun buildLogContent(thread: Thread, throwable: Throwable): String {
        val sb = StringBuilder()
        val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())

        sb.append("=== 崩溃日志 ===\n")
        sb.append("时间: ${dateFormat.format(Date())}\n")
        sb.append("线程: ${thread.name} (ID: ${thread.id})\n")
        sb.append("应用版本: ${getAppVersion()}\n")
        sb.append("Android 版本: ${android.os.Build.VERSION.RELEASE} (SDK ${android.os.Build.VERSION.SDK_INT})\n")
        sb.append("设备型号: ${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}\n")
        sb.append("\n异常信息:\n")

        // 获取完整堆栈信息
        val sw = StringWriter()
        val pw = PrintWriter(sw)
        throwable.printStackTrace(pw)
        sb.append(sw.toString())

        return sb.toString()
    }

    /**
     * 保存日志到文件
     */
    private fun saveLog(content: String) {
        val ctx = context ?: return
        val logDir = File(ctx.filesDir, LOG_DIR)
        if (!logDir.exists()) logDir.mkdirs()

        val dateFormat = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault())
        val fileName = "crash_${dateFormat.format(Date())}.log"
        val logFile = File(logDir, fileName)

        logFile.writeText(content)
        Log.d(TAG, "日志已保存: ${logFile.absolutePath}")
    }

    /**
     * 清理旧日志文件
     */
    private fun cleanOldLogs() {
        val ctx = context ?: return
        val logDir = File(ctx.filesDir, LOG_DIR)
        if (!logDir.exists()) return

        val logFiles = logDir.listFiles()?.sortedByDescending { it.lastModified() } ?: return
        if (logFiles.size > MAX_LOG_FILES) {
            logFiles.drop(MAX_LOG_FILES).forEach { file ->
                file.delete()
                Log.d(TAG, "删除旧日志: ${file.name}")
            }
        }
    }

    /**
     * 获取所有日志文件
     */
    fun getLogFiles(context: Context): List<File> {
        val logDir = File(context.filesDir, LOG_DIR)
        if (!logDir.exists()) return emptyList()
        return logDir.listFiles()?.sortedByDescending { it.lastModified() }?.toList() ?: emptyList()
    }

    /**
     * 删除所有日志文件
     */
    fun clearAllLogs(context: Context) {
        val logDir = File(context.filesDir, LOG_DIR)
        if (!logDir.exists()) return
        logDir.listFiles()?.forEach { it.delete() }
        Log.d(TAG, "已清空所有日志")
    }

    /**
     * 获取应用版本
     */
    private fun getAppVersion(): String {
        return try {
            val ctx = context ?: return "Unknown"
            val packageInfo = ctx.packageManager.getPackageInfo(ctx.packageName, 0)
            "${packageInfo.versionName} (${packageInfo.longVersionCode})"
        } catch (e: Exception) {
            "Unknown"
        }
    }
}
