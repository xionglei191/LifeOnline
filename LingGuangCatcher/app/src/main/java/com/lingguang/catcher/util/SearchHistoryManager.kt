package com.lingguang.catcher.util

import android.content.Context

/**
 * 搜索历史管理
 */
object SearchHistoryManager {
    private const val PREFS_NAME = "search_history"
    private const val KEY_HISTORY = "history"
    private const val MAX_HISTORY = 10

    /**
     * 添加搜索历史
     */
    fun addHistory(context: Context, query: String) {
        if (query.isBlank()) return

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val history = getHistory(context).toMutableList()

        // 移除重复项
        history.remove(query)
        // 添加到开头
        history.add(0, query)
        // 限制数量
        if (history.size > MAX_HISTORY) {
            history.removeAt(history.size - 1)
        }

        prefs.edit().putStringSet(KEY_HISTORY, history.toSet()).apply()
    }

    /**
     * 获取搜索历史
     */
    fun getHistory(context: Context): List<String> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val historySet = prefs.getStringSet(KEY_HISTORY, emptySet()) ?: emptySet()
        return historySet.toList().sortedByDescending { it }
    }

    /**
     * 清空搜索历史
     */
    fun clearHistory(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().clear().apply()
    }

    /**
     * 删除单条历史
     */
    fun removeHistory(context: Context, query: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val history = getHistory(context).toMutableList()
        history.remove(query)
        prefs.edit().putStringSet(KEY_HISTORY, history.toSet()).apply()
    }

    /**
     * 获取搜索建议（基于历史）
     */
    fun getSuggestions(context: Context, query: String): List<String> {
        if (query.isBlank()) return emptyList()
        return getHistory(context).filter { it.contains(query, ignoreCase = true) }
    }
}
