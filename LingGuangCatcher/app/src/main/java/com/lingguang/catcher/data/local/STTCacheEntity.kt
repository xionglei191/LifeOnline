package com.lingguang.catcher.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * STT 结果缓存表
 * 用于头脑风暴重试场景，避免重复转录
 */
@Entity(tableName = "stt_cache")
data class STTCacheEntity(
    @PrimaryKey
    val audioHash: String,          // 音频文件 SHA-256 哈希
    val transcription: String,      // 转录文本
    val createdAt: Long,            // 创建时间
    val audioSize: Long             // 音频文件大小（用于快速校验）
)
