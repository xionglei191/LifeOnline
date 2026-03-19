package com.lingguang.catcher.util

import android.util.Log
import com.lingguang.catcher.data.local.STTCacheDao
import com.lingguang.catcher.data.local.STTCacheEntity
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

/**
 * STT 缓存辅助类
 * 用于头脑风暴重试场景，避免重复转录
 */
class STTCacheHelper(private val cacheDao: STTCacheDao) {

    private val TAG = "LingGuang"

    /**
     * 获取缓存的转录结果
     */
    suspend fun getCachedTranscription(audioFile: File): String? {
        if (!audioFile.exists()) return null

        val hash = calculateFileHash(audioFile)
        val size = audioFile.length()
        val cached = cacheDao.getByHash(hash, size)

        if (cached != null) {
            Log.d(TAG, "STT 缓存命中: ${audioFile.name}")
            return cached.transcription
        }
        return null
    }

    /**
     * 保存转录结果到缓存
     */
    suspend fun cacheTranscription(audioFile: File, transcription: String) {
        if (!audioFile.exists() || transcription.isBlank()) return

        val hash = calculateFileHash(audioFile)
        val entity = STTCacheEntity(
            audioHash = hash,
            transcription = transcription,
            createdAt = System.currentTimeMillis(),
            audioSize = audioFile.length()
        )
        cacheDao.insert(entity)
        Log.d(TAG, "STT 结果已缓存: ${audioFile.name}")
    }

    /**
     * 清理 30 天前的缓存
     */
    suspend fun cleanOldCache() {
        val thirtyDaysAgo = System.currentTimeMillis() - 30 * 24 * 60 * 60 * 1000L
        cacheDao.deleteOldCache(thirtyDaysAgo)
    }

    /**
     * 计算文件 SHA-256 哈希
     */
    private fun calculateFileHash(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { fis ->
            val buffer = ByteArray(8192)
            var bytesRead: Int
            while (fis.read(buffer).also { bytesRead = it } != -1) {
                digest.update(buffer, 0, bytesRead)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
}
