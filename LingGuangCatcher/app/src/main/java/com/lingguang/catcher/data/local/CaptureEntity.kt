package com.lingguang.catcher.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.lingguang.catcher.data.model.CaptureType

/**
 * 待处理的捕获记录（离线队列）
 */
@Entity(tableName = "capture_queue")
data class CaptureEntity(
    @PrimaryKey
    val id: String,
    val type: CaptureType,
    val rawContent: String, // 文件路径或文本内容
    val metadata: String, // JSON 格式的 metadata
    val status: ProcessStatus,
    val errorMessage: String? = null,
    val retryCount: Int = 0,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    // 新增字段：存储生成的内容
    val markdownContent: String? = null, // 生成的 Markdown 内容
    val filename: String? = null, // Obsidian 文件名
    val title: String? = null // 笔记标题
)

enum class ProcessStatus {
    PENDING,    // 待处理
    PROCESSING, // 处理中
    SUCCESS,    // 成功
    FAILED      // 失败（超过重试次数）
}
