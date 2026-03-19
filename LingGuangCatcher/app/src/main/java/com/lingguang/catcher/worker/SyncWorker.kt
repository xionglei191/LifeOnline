package com.lingguang.catcher.worker

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.lingguang.catcher.data.local.AppDatabase
import com.lingguang.catcher.data.local.ProcessStatus
import com.lingguang.catcher.data.model.CaptureRecord
import com.lingguang.catcher.data.model.CaptureType
import com.lingguang.catcher.data.model.VoiceNoteType
import com.lingguang.catcher.data.repository.CaptureRepository
import com.lingguang.catcher.data.repository.ObsidianRepository
import com.lingguang.catcher.util.NotificationUtil
import com.lingguang.catcher.util.STTCacheHelper
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * 后台同步 Worker
 * 处理离线队列中的待处理记录
 */
class SyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    private val TAG = "LingGuang"
    private val database = AppDatabase.getDatabase(context)
    private val captureDao = database.captureDao()
    private val repository = CaptureRepository(context)
    private val obsidianRepo = ObsidianRepository(context)
    private val sttCache = STTCacheHelper(database.sttCacheDao())

    // 批量并发处理数量
    private val BATCH_SIZE = 3

    override suspend fun doWork(): Result {
        Log.d(TAG, "SyncWorker 开始执行")

        // 检查网络连接
        if (!com.lingguang.catcher.util.NetworkMonitor.isNetworkAvailable(applicationContext)) {
            Log.d(TAG, "网络不可用，稍后重试")
            return Result.retry()
        }

        // 检查 WiFi Only 设置
        val settings = com.lingguang.catcher.data.local.AppSettings.getInstance(applicationContext)
        if (settings.wifiOnlySync && !com.lingguang.catcher.util.NetworkMonitor.isWifiConnected(applicationContext)) {
            Log.d(TAG, "仅 WiFi 同步模式，当前非 WiFi 连接，稍后重试")
            return Result.retry()
        }

        // 清理卡住的 PROCESSING 记录（超过 10 分钟）
        val tenMinutesAgo = System.currentTimeMillis() - 10 * 60 * 1000
        val stuckRecords = captureDao.getStuckProcessingRecords(tenMinutesAgo)

        for (stuck in stuckRecords) {
            Log.d(TAG, "重置卡住的记录: ${stuck.id}")
            captureDao.update(stuck.copy(status = ProcessStatus.PENDING, updatedAt = System.currentTimeMillis()))
        }

        val pendingCaptures = captureDao.getPendingCaptures()
        Log.d(TAG, "待处理记录数: ${pendingCaptures.size}")

        var successCount = 0
        var failCount = 0

        // 批量并发处理
        pendingCaptures.chunked(BATCH_SIZE).forEach { batch ->
            val results = coroutineScope {
                batch.map { entity ->
                    async {
                        // 再次检查状态，避免并发问题
                        val current = captureDao.getById(entity.id)
                        if (current == null || current.status != ProcessStatus.PENDING) {
                            Log.d(TAG, "跳过非 PENDING 状态的记录: ${entity.id}, status=${current?.status}")
                            return@async Pair(false, false) // (success, fail)
                        }
                        processEntity(entity)
                    }
                }.awaitAll()
            }
            results.forEach { (success, fail) ->
                if (success) successCount++
                if (fail) failCount++
            }
        }

        Log.d(TAG, "SyncWorker 完成: 成功 $successCount, 失败 $failCount")

        // 发送通知
        if (successCount > 0) {
            NotificationUtil.notifySuccess(
                applicationContext,
                "✅ 灵光捕手",
                if (successCount == 1) "1 条记录已处理完成" else "$successCount 条记录已处理完成"
            )
        }
        if (failCount > 0) {
            NotificationUtil.notifyFailure(
                applicationContext,
                "⚠️ 灵光捕手",
                "$failCount 条记录处理失败，将自动重试"
            )
        }

        // 清理 7 天前的成功记录
        val sevenDaysAgo = System.currentTimeMillis() - 7 * 24 * 60 * 60 * 1000
        captureDao.deleteOldSuccessRecords(sevenDaysAgo)

        // 清理过期 STT 缓存
        sttCache.cleanOldCache()

        return Result.success()
    }

    /**
     * 处理单条记录，返回 (success, fail)
     */
    private suspend fun processEntity(entity: com.lingguang.catcher.data.local.CaptureEntity): Pair<Boolean, Boolean> {
        return try {
            // 更新状态为处理中
            captureDao.update(entity.copy(status = ProcessStatus.PROCESSING, updatedAt = System.currentTimeMillis()))

            // 解析 metadata
            val metadataJson = if (entity.metadata.isNotEmpty()) {
                try { JSONObject(entity.metadata) } catch (_: Exception) { JSONObject() }
            } else {
                JSONObject()
            }
            val metadata = metadataJson.keys().asSequence().associateWith { metadataJson.getString(it) }

            // 语音类型：rawContent 为空时需要先做 STT
            var rawContent = entity.rawContent
            val isBrainstorm = metadataJson.optBoolean("brainstorm", false)

            if (entity.type == CaptureType.VOICE && isBrainstorm && rawContent.isEmpty()) {
                // 头脑风暴：多段音频逐段 STT（利用缓存）
                val audioPaths = metadataJson.optJSONArray("audio_paths") ?: throw Exception("头脑风暴缺少 audio_paths")
                val transcriptions = metadataJson.optJSONArray("transcriptions") ?: JSONArray()

                val results = mutableListOf<String>()
                for (i in 0 until audioPaths.length()) {
                    val existing = transcriptions.optString(i, "")
                    if (existing.isNotEmpty()) {
                        results.add(existing)
                        continue
                    }
                    val audioPath = audioPaths.getString(i)
                    val audioFile = File(audioPath)
                    if (!audioFile.exists()) throw Exception("音频文件不存在: $audioPath")

                    // 先查 STT 缓存
                    val cached = sttCache.getCachedTranscription(audioFile)
                    val transcription = if (cached != null) {
                        cached
                    } else {
                        Log.d(TAG, "头脑风暴 STT 段落 ${i + 1}: $audioPath")
                        val result = repository.transcribeAudio(audioFile)
                        if (result.isNullOrBlank()) throw Exception("段落 ${i + 1} STT 转录结果为空")
                        sttCache.cacheTranscription(audioFile, result)
                        result
                    }

                    results.add(transcription)
                    // 更新 transcriptions 以便重试时跳过已完成的
                    while (transcriptions.length() <= i) transcriptions.put("")
                    transcriptions.put(i, transcription)
                }

                // 合并文本
                rawContent = results.mapIndexed { i, text ->
                    "【第${i + 1}段】\n$text"
                }.joinToString("\n\n---\n\n")

                // 更新 metadata 和 rawContent
                metadataJson.put("transcriptions", transcriptions)
                captureDao.update(entity.copy(
                    rawContent = rawContent,
                    metadata = metadataJson.toString(),
                    updatedAt = System.currentTimeMillis()
                ))
                Log.d(TAG, "头脑风暴 STT 全部完成，段数: ${results.size}")
            } else if (entity.type == CaptureType.VOICE && rawContent.isEmpty()) {
                val audioPath = metadataJson.optString("audio_path", "")
                if (audioPath.isEmpty()) throw Exception("语音记录缺少音频文件路径")
                val audioFile = File(audioPath)
                if (!audioFile.exists()) throw Exception("音频文件不存在: $audioPath")

                // 先查 STT 缓存
                val cached = sttCache.getCachedTranscription(audioFile)
                rawContent = if (cached != null) {
                    cached
                } else {
                    Log.d(TAG, "开始 STT 转录: $audioPath")
                    val result = repository.transcribeAudio(audioFile)
                    if (result.isNullOrBlank()) throw Exception("STT 转录结果为空")
                    sttCache.cacheTranscription(audioFile, result)
                    result
                }

                // 更新 rawContent 到数据库，避免重复 STT
                captureDao.update(entity.copy(rawContent = rawContent, updatedAt = System.currentTimeMillis()))
                Log.d(TAG, "STT 转录成功，长度: ${rawContent.length}")
            }

            // 图片类型：如果有语音音频路径，先 STT 转文字
            if (entity.type == CaptureType.IMAGE) {
                val voiceAudioPath = metadataJson.optString("voice_audio_path", "")
                if (voiceAudioPath.isNotEmpty() && !metadata.containsKey("voice_note")) {
                    val voiceAudioFile = File(voiceAudioPath)
                    if (voiceAudioFile.exists()) {
                        Log.d(TAG, "图片语音指令 STT: $voiceAudioPath")
                        val cached = sttCache.getCachedTranscription(voiceAudioFile)
                        val voiceText = cached ?: run {
                            val result = repository.transcribeAudio(voiceAudioFile)
                            if (!result.isNullOrBlank()) sttCache.cacheTranscription(voiceAudioFile, result)
                            result
                        }
                        if (!voiceText.isNullOrBlank()) {
                            metadataJson.put("voice_note", voiceText)
                            captureDao.update(entity.copy(
                                metadata = metadataJson.toString(),
                                updatedAt = System.currentTimeMillis()
                            ))
                            Log.d(TAG, "图片语音指令 STT 成功: $voiceText")
                        }
                    }
                }
            }

            // 重新解析 metadata（可能已更新）
            val updatedMetadata = metadataJson.keys().asSequence().associateWith { metadataJson.optString(it, "") }

            // 构建 CaptureRecord
            val record = CaptureRecord(
                id = entity.id,
                type = entity.type,
                rawContent = rawContent,
                metadata = updatedMetadata
            )

            // 调用 AI 处理
            val result = if (entity.type == CaptureType.VOICE) {
                val noteTypeName = metadataJson.optString("note_type", "")
                val noteType = try {
                    VoiceNoteType.valueOf(noteTypeName)
                } catch (_: Exception) {
                    VoiceNoteType.getDefault()
                }
                repository.processCaptureRecordByType(record, noteType)
            } else {
                repository.processCaptureRecord(record)
            }

            result.onSuccess { markdown ->
                // 写入 Obsidian
                val imageFile = if (entity.type == CaptureType.IMAGE) {
                    File(entity.rawContent)
                } else null

                obsidianRepo.writeToInbox(markdown, imageFile).onSuccess { filename ->
                    // 提取标题（第一个 ## 标题）
                    val titleLine = markdown.fullText.lines().find { it.startsWith("##") }
                    val title = titleLine?.removePrefix("##")?.trim()

                    // 标记为成功，保存 Markdown 内容
                    captureDao.update(
                        entity.copy(
                            status = ProcessStatus.SUCCESS,
                            rawContent = rawContent,
                            markdownContent = markdown.fullText,
                            filename = filename,
                            title = title,
                            updatedAt = System.currentTimeMillis()
                        )
                    )
                    Log.d(TAG, "处理成功: ${entity.id}")

                    // 语音类型成功后清理音频文件
                    if (entity.type == CaptureType.VOICE) {
                        if (isBrainstorm) {
                            val audioPaths = metadataJson.optJSONArray("audio_paths")
                            if (audioPaths != null) {
                                for (i in 0 until audioPaths.length()) {
                                    val path = audioPaths.getString(i)
                                    val f = File(path)
                                    if (f.exists()) { f.delete(); Log.d(TAG, "已清理音频: $path") }
                                }
                            }
                        } else {
                            val audioPath = metadataJson.optString("audio_path", "")
                            if (audioPath.isNotEmpty()) {
                                val audioFile = File(audioPath)
                                if (audioFile.exists()) {
                                    audioFile.delete()
                                    Log.d(TAG, "已清理音频文件: $audioPath")
                                }
                            }
                        }
                    }
                    // 图片类型成功后清理语音音频文件
                    if (entity.type == CaptureType.IMAGE) {
                        val voiceAudioPath = metadataJson.optString("voice_audio_path", "")
                        if (voiceAudioPath.isNotEmpty()) {
                            val f = File(voiceAudioPath)
                            if (f.exists()) { f.delete(); Log.d(TAG, "已清理语音音频: $voiceAudioPath") }
                        }
                    }
                }.onFailure { e ->
                    throw e
                }
            }.onFailure { e ->
                throw e
            }

            Pair(true, false)
        } catch (e: Exception) {
            Log.e(TAG, "处理失败: ${entity.id}, ${e.message}")
            val newRetryCount = entity.retryCount + 1
            val maxRetries = 10

            if (newRetryCount >= maxRetries) {
                captureDao.update(
                    entity.copy(
                        status = ProcessStatus.FAILED,
                        errorMessage = e.message,
                        retryCount = newRetryCount,
                        updatedAt = System.currentTimeMillis()
                    )
                )
                Pair(false, true)
            } else {
                captureDao.update(
                    entity.copy(
                        status = ProcessStatus.PENDING,
                        errorMessage = e.message,
                        retryCount = newRetryCount,
                        updatedAt = System.currentTimeMillis()
                    )
                )
                Pair(false, false)
            }
        }
    }
}
