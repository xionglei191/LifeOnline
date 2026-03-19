package com.lingguang.catcher.data.model

import java.util.Date

/**
 * 捕获类型
 */
enum class CaptureType {
    VOICE,      // 语音闪念
    IMAGE,      // 视觉萃取
    LINK,       // 链接/视频
    TEXT        // 纯文本
}

/**
 * 处理状态
 */
enum class ProcessStatus {
    PENDING,    // 待处理
    PROCESSING, // 处理中
    COMPLETED,  // 已完成
    FAILED      // 失败
}

/**
 * 捕获记录
 */
data class CaptureRecord(
    val id: String,
    val type: CaptureType,
    val rawContent: String,          // 原始内容（文件路径/链接/文本）
    val processedContent: String? = null,  // AI处理后的内容
    val status: ProcessStatus = ProcessStatus.PENDING,
    val createdAt: Date = Date(),
    val processedAt: Date? = null,
    val errorMessage: String? = null,
    val metadata: Map<String, String> = emptyMap()
)
