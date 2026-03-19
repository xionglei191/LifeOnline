package com.lingguang.catcher.ui

import android.content.Context
import com.lingguang.catcher.data.local.ProcessStatus
import com.lingguang.catcher.data.model.CaptureType
import java.util.Calendar

/**
 * 搜索筛选条件
 */
data class SearchFilter(
    var types: Set<CaptureType> = emptySet(),
    var statuses: Set<ProcessStatus> = emptySet(),
    var dateRange: DateRange = DateRange.ALL,
    var customStartDate: Long? = null,
    var customEndDate: Long? = null
) {
    enum class DateRange {
        ALL,        // 全部
        TODAY,      // 今天
        WEEK,       // 本周
        MONTH,      // 本月
        CUSTOM      // 自定义
    }

    /**
     * 检查是否有任何筛选条件
     */
    fun hasAnyFilter(): Boolean {
        return types.isNotEmpty() ||
               statuses.isNotEmpty() ||
               dateRange != DateRange.ALL
    }

    /**
     * 获取筛选条件数量
     */
    fun getFilterCount(): Int {
        var count = 0
        if (types.isNotEmpty()) count++
        if (statuses.isNotEmpty()) count++
        if (dateRange != DateRange.ALL) count++
        return count
    }

    /**
     * 清空所有筛选条件
     */
    fun clear() {
        types = emptySet()
        statuses = emptySet()
        dateRange = DateRange.ALL
        customStartDate = null
        customEndDate = null
    }

    /**
     * 获取日期范围的起始时间戳
     */
    fun getStartTimestamp(): Long? {
        return when (dateRange) {
            DateRange.ALL -> null
            DateRange.TODAY -> {
                Calendar.getInstance().apply {
                    set(Calendar.HOUR_OF_DAY, 0)
                    set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                }.timeInMillis
            }
            DateRange.WEEK -> {
                Calendar.getInstance().apply {
                    set(Calendar.DAY_OF_WEEK, Calendar.MONDAY)
                    set(Calendar.HOUR_OF_DAY, 0)
                    set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                }.timeInMillis
            }
            DateRange.MONTH -> {
                Calendar.getInstance().apply {
                    set(Calendar.DAY_OF_MONTH, 1)
                    set(Calendar.HOUR_OF_DAY, 0)
                    set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                }.timeInMillis
            }
            DateRange.CUSTOM -> customStartDate
        }
    }

    /**
     * 获取日期范围的结束时间戳
     */
    fun getEndTimestamp(): Long? {
        return when (dateRange) {
            DateRange.ALL -> null
            DateRange.CUSTOM -> customEndDate
            else -> System.currentTimeMillis()
        }
    }

    /**
     * 保存到 SharedPreferences
     */
    fun save(context: Context) {
        val prefs = context.getSharedPreferences("search_filter", Context.MODE_PRIVATE)
        prefs.edit().apply {
            putStringSet("types", types.map { it.name }.toSet())
            putStringSet("statuses", statuses.map { it.name }.toSet())
            putString("dateRange", dateRange.name)
            customStartDate?.let { putLong("customStartDate", it) }
            customEndDate?.let { putLong("customEndDate", it) }
            apply()
        }
    }

    companion object {
        /**
         * 从 SharedPreferences 加载
         */
        fun load(context: Context): SearchFilter {
            val prefs = context.getSharedPreferences("search_filter", Context.MODE_PRIVATE)
            return SearchFilter(
                types = prefs.getStringSet("types", emptySet())
                    ?.mapNotNull { try { CaptureType.valueOf(it) } catch (e: Exception) { null } }
                    ?.toSet() ?: emptySet(),
                statuses = prefs.getStringSet("statuses", emptySet())
                    ?.mapNotNull { try { ProcessStatus.valueOf(it) } catch (e: Exception) { null } }
                    ?.toSet() ?: emptySet(),
                dateRange = try {
                    DateRange.valueOf(prefs.getString("dateRange", DateRange.ALL.name)!!)
                } catch (e: Exception) {
                    DateRange.ALL
                },
                customStartDate = if (prefs.contains("customStartDate"))
                    prefs.getLong("customStartDate", 0) else null,
                customEndDate = if (prefs.contains("customEndDate"))
                    prefs.getLong("customEndDate", 0) else null
            )
        }
    }
}
