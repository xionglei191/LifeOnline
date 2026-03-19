package com.lingguang.catcher.util

import android.content.Context
import android.content.SharedPreferences
import com.lingguang.catcher.data.model.VoiceNoteType

/**
 * 标签使用统计工具
 * 记录每种笔记类型的使用次数，用于优化 UI 和推荐
 */
class NoteTypeStatsManager(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(
        "note_type_stats",
        Context.MODE_PRIVATE
    )

    /**
     * 记录一次类型使用
     */
    fun recordUsage(type: VoiceNoteType) {
        val key = "count_${type.name}"
        val currentCount = prefs.getInt(key, 0)
        prefs.edit().putInt(key, currentCount + 1).apply()
    }

    /**
     * 获取某个类型的使用次数
     */
    fun getUsageCount(type: VoiceNoteType): Int {
        val key = "count_${type.name}"
        return prefs.getInt(key, 0)
    }

    /**
     * 获取所有类型的使用统计
     */
    fun getAllStats(): Map<VoiceNoteType, Int> {
        return VoiceNoteType.values().associateWith { type ->
            getUsageCount(type)
        }
    }

    /**
     * 获取最常用的 N 个类型
     */
    fun getTopUsedTypes(count: Int = 3): List<VoiceNoteType> {
        val stats = getAllStats()
        return stats.entries
            .sortedByDescending { it.value }
            .take(count)
            .map { it.key }
    }

    /**
     * 获取最常用的类型（如果有统计数据）
     */
    fun getMostUsedType(): VoiceNoteType? {
        val stats = getAllStats()
        val maxEntry = stats.maxByOrNull { it.value }
        return if (maxEntry != null && maxEntry.value > 0) {
            maxEntry.key
        } else {
            null
        }
    }

    /**
     * 清除所有统计数据
     */
    fun clearStats() {
        prefs.edit().clear().apply()
    }

    /**
     * 获取总使用次数
     */
    fun getTotalUsageCount(): Int {
        return getAllStats().values.sum()
    }
}
