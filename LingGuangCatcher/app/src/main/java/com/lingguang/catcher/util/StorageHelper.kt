package com.lingguang.catcher.util

import android.content.Context
import android.os.Environment
import android.os.StatFs
import java.io.File

/**
 * 存储空间检查工具
 */
object StorageHelper {

    // 最小可用空间阈值 (100 MB)
    private const val MIN_AVAILABLE_SPACE_MB = 100L
    private const val BYTES_PER_MB = 1024L * 1024L

    /**
     * 检查是否有足够的存储空间
     * @return true 如果有足够空间，false 如果空间不足
     */
    fun hasEnoughSpace(context: Context): Boolean {
        return getAvailableSpaceMB(context) >= MIN_AVAILABLE_SPACE_MB
    }

    /**
     * 获取可用存储空间 (MB)
     */
    fun getAvailableSpaceMB(context: Context): Long {
        return try {
            val path = context.filesDir
            val stat = StatFs(path.absolutePath)
            val availableBytes = stat.availableBytes
            availableBytes / BYTES_PER_MB
        } catch (e: Exception) {
            0L
        }
    }

    /**
     * 获取总存储空间 (MB)
     */
    fun getTotalSpaceMB(context: Context): Long {
        return try {
            val path = context.filesDir
            val stat = StatFs(path.absolutePath)
            val totalBytes = stat.totalBytes
            totalBytes / BYTES_PER_MB
        } catch (e: Exception) {
            0L
        }
    }

    /**
     * 获取已使用存储空间 (MB)
     */
    fun getUsedSpaceMB(context: Context): Long {
        return getTotalSpaceMB(context) - getAvailableSpaceMB(context)
    }

    /**
     * 获取存储空间使用百分比
     */
    fun getUsagePercentage(context: Context): Int {
        val total = getTotalSpaceMB(context)
        if (total == 0L) return 0
        val used = getUsedSpaceMB(context)
        return ((used.toDouble() / total.toDouble()) * 100).toInt()
    }

    /**
     * 格式化存储空间大小
     */
    fun formatSize(mb: Long): String {
        return when {
            mb < 1024 -> "${mb} MB"
            else -> String.format("%.2f GB", mb / 1024.0)
        }
    }

    /**
     * 获取存储空间不足的提示信息
     */
    fun getInsufficientSpaceMessage(context: Context): String {
        val available = getAvailableSpaceMB(context)
        return "存储空间不足！\n可用空间: ${formatSize(available)}\n需要至少: ${formatSize(MIN_AVAILABLE_SPACE_MB)}"
    }
}
