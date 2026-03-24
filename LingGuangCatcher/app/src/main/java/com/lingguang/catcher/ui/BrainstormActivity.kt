package com.lingguang.catcher.ui

import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.recyclerview.widget.LinearLayoutManager
import com.lingguang.catcher.data.local.AppDatabase
import com.lingguang.catcher.data.local.CaptureEntity
import com.lingguang.catcher.data.local.ProcessStatus
import com.lingguang.catcher.data.model.CaptureType
import com.lingguang.catcher.data.model.VoiceNoteType
import com.lingguang.catcher.data.repository.CaptureRepository
import com.lingguang.catcher.databinding.ActivityBrainstormBinding
import com.lingguang.catcher.util.AnimUtil
import com.lingguang.catcher.util.FeedbackUtil
import com.lingguang.catcher.util.PermissionUtil
import com.lingguang.catcher.worker.SyncWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

class BrainstormActivity : AppCompatActivity() {

    private lateinit var binding: ActivityBrainstormBinding
    private val TAG = "LingGuang"
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val repository by lazy { CaptureRepository(applicationContext) }
    private val database by lazy { AppDatabase.getDatabase(applicationContext) }

    private var mediaRecorder: MediaRecorder? = null
    private var currentAudioFile: File? = null
    private var isRecording = false
    private var recordingStartTime = 0L
    private var durationUpdateJob: kotlinx.coroutines.Job? = null
    private var maxAmplitude = 0

    private val segments = mutableListOf<BrainstormSegment>()
    private lateinit var adapter: BrainstormSegmentAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityBrainstormBinding.inflate(layoutInflater)
        setContentView(binding.root)
        setupUI()

        if (!PermissionUtil.hasRecordAudioPermission(this)) {
            ActivityCompat.requestPermissions(
                this, arrayOf(Manifest.permission.RECORD_AUDIO),
                PermissionUtil.REQUEST_RECORD_AUDIO
            )
        }
    }

    private fun setupUI() {
        binding.toolbar.setNavigationOnClickListener { confirmDiscard() }

        adapter = BrainstormSegmentAdapter(
            onDelete = { position -> deleteSegment(position) },
            onEdit = { position, currentText -> editSegment(position, currentText) }
        )
        binding.rvSegments.layoutManager = LinearLayoutManager(this)
        binding.rvSegments.adapter = adapter

        binding.btnRecord.setOnClickListener {
            if (isRecording) stopCurrentSegment() else startRecordingSegment()
        }
        binding.btnDiscard.setOnClickListener { confirmDiscard() }
        binding.btnFinish.setOnClickListener { finishAndGenerate() }

        updateUI()
    }

    private fun updateUI() {
        val count = segments.size
        binding.tvSegmentCount.text = "段数: $count"
        val totalMs = segments.sumOf { it.duration }
        binding.tvTotalDuration.text = "总时长: ${formatDuration(totalMs)}"
        binding.btnFinish.isEnabled = count > 0 && !isRecording
        binding.tvEmptyHint.visibility = if (count == 0 && !isRecording) View.VISIBLE else View.GONE
        // 直接提交列表副本
        adapter.submitList(segments.toList())
    }

    private fun startRecordingSegment() {
        if (!PermissionUtil.hasRecordAudioPermission(this)) {
            FeedbackUtil.showToast(this, "需要录音权限")
            return
        }

        // 检查存储空间
        if (!com.lingguang.catcher.util.StorageHelper.hasEnoughSpace(this)) {
            FeedbackUtil.showToast(this, com.lingguang.catcher.util.StorageHelper.getInsufficientSpaceMessage(this))
            return
        }

        try {
            val outputFile = File(cacheDir, "brainstorm_${System.currentTimeMillis()}.m4a")
            currentAudioFile = outputFile

            mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(this)
            } else {
                @Suppress("DEPRECATION") MediaRecorder()
            }
            mediaRecorder?.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioSamplingRate(16000)
                setAudioEncodingBitRate(64000)
                setOutputFile(outputFile.absolutePath)
                prepare()
                start()
            }

            isRecording = true
            recordingStartTime = System.currentTimeMillis()
            maxAmplitude = 0
            FeedbackUtil.vibrateRecordStart(this)

            binding.layoutRecordingStatus.visibility = View.VISIBLE
            binding.btnRecord.text = "停止"
            binding.btnFinish.isEnabled = false
            binding.btnDiscard.isEnabled = false
            startDurationTimer()
            startAmplitudeSampling()
            updateUI()
        } catch (e: Exception) {
            Log.e(TAG, "录音启动失败: ${e.message}", e)
            FeedbackUtil.captureError(this, "录音启动失败: ${e.message}")
            isRecording = false
        }
    }
    private fun stopCurrentSegment() {
        if (!isRecording) return
        isRecording = false
        durationUpdateJob?.cancel()
        val duration = System.currentTimeMillis() - recordingStartTime

        try {
            mediaRecorder?.apply { stop(); release() }
            mediaRecorder = null
            FeedbackUtil.vibrateRecordStop(this)
        } catch (e: Exception) {
            Log.e(TAG, "停止录音失败: ${e.message}", e)
        }

        // 检查时长和音量
        val durationSec = duration / 1000.0
        Log.d(TAG, "段落录音时长: ${durationSec}秒, 最大音量: $maxAmplitude")

        if (durationSec < 1.0) {
            FeedbackUtil.showToast(this, "录音时长不足1秒，已忽略")
            currentAudioFile?.delete()
            binding.layoutRecordingStatus.visibility = View.GONE
            binding.btnRecord.text = if (segments.isEmpty()) "录制第一段" else "下一段"
            binding.btnDiscard.isEnabled = segments.isNotEmpty()
            return
        }

        if (maxAmplitude < 500) {
            FeedbackUtil.showToast(this, "未检测到语音，已忽略")
            currentAudioFile?.delete()
            binding.layoutRecordingStatus.visibility = View.GONE
            binding.btnRecord.text = if (segments.isEmpty()) "录制第一段" else "下一段"
            binding.btnDiscard.isEnabled = segments.isNotEmpty()
            return
        }

        binding.layoutRecordingStatus.visibility = View.GONE
        binding.btnRecord.text = "下一段"
        binding.btnDiscard.isEnabled = true

        val file = currentAudioFile
        if (file != null && file.exists() && file.length() > 0) {
            val segment = BrainstormSegment(
                id = UUID.randomUUID().toString(),
                audioFile = file,
                isTranscribing = true,
                duration = duration
            )
            segments.add(segment)
            updateUI()
            transcribeSegment(segments.size - 1)
        }
    }

    private fun transcribeSegment(index: Int) {
        scope.launch {
            val segment = segments.getOrNull(index) ?: return@launch
            Log.d(TAG, "开始转录段落 ${index + 1}, 文件: ${segment.audioFile.absolutePath}")
            try {
                // 在 IO 线程执行转录
                val transcription = withContext(Dispatchers.IO) {
                    repository.transcribeAudio(segment.audioFile)
                }
                // 回到主线程更新 UI - 替换整个对象
                Log.d(TAG, "段落 ${index + 1} 转录完成: ${transcription?.take(50)}")
                if (!transcription.isNullOrBlank()) {
                    segments[index] = segment.copy(transcription = transcription, isTranscribing = false)
                } else {
                    segments[index] = segment.copy(transcription = "（转录失败）", isTranscribing = false)
                }
            } catch (e: Exception) {
                Log.e(TAG, "段落 ${index + 1} 转录失败: ${e.message}", e)
                segments[index] = segment.copy(transcription = "（转录失败: ${e.message}）", isTranscribing = false)
            } finally {
                Log.d(TAG, "段落 ${index + 1} 状态更新: isTranscribing=${segments[index].isTranscribing}, transcription=${segments[index].transcription?.take(50)}")
                updateUI()
            }
        }
    }

    private fun deleteSegment(position: Int) {
        if (position < 0 || position >= segments.size) return
        AlertDialog.Builder(this)
            .setTitle("删除段落")
            .setMessage("确定删除第 ${position + 1} 段？")
            .setPositiveButton("删除") { _, _ ->
                val removed = segments.removeAt(position)
                removed.audioFile.delete()
                updateUI()
            }
            .setNegativeButton("取消", null)
            .show()
    }

    private fun editSegment(position: Int, currentText: String) {
        if (position < 0 || position >= segments.size) return
        val editText = android.widget.EditText(this).apply {
            setText(currentText)
            setSelection(currentText.length)
            minLines = 3
            maxLines = 8
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE
            setPadding(48, 24, 48, 24)
        }
        AlertDialog.Builder(this)
            .setTitle("编辑第 ${position + 1} 段转录")
            .setView(editText)
            .setPositiveButton("保存") { _, _ ->
                val newText = editText.text?.toString()?.trim()
                if (!newText.isNullOrBlank()) {
                    segments[position].transcription = newText
                    updateUI()
                }
            }
            .setNegativeButton("取消", null)
            .show()
    }

    private fun startDurationTimer() {
        durationUpdateJob?.cancel()
        durationUpdateJob = scope.launch {
            while (isRecording) {
                val elapsed = System.currentTimeMillis() - recordingStartTime
                binding.tvCurrentDuration.text = formatDuration(elapsed)
                delay(100)
            }
        }
    }

    private fun startAmplitudeSampling() {
        scope.launch {
            while (isRecording) {
                try {
                    val amplitude = mediaRecorder?.maxAmplitude ?: 0
                    if (amplitude > maxAmplitude) {
                        maxAmplitude = amplitude
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "获取振幅失败: ${e.message}")
                }
                delay(50)
            }
        }
    }
    private fun finishAndGenerate() {
        if (segments.isEmpty()) return

        // 检查是否有段落正在转录
        if (segments.any { it.isTranscribing }) {
            AlertDialog.Builder(this)
                .setTitle("提示")
                .setMessage("还有段落正在转录中，你可以选择：\n\n1. 等待转录完成后再提交\n2. 直接提交到后台，让后台处理转录")
                .setPositiveButton("直接提交") { _, _ ->
                    // 直接提交到后台，不等待转录
                    submitToBackground()
                }
                .setNegativeButton("等待转录", null)
                .show()
            return
        }

        // 所有段落都已转录完成，直接提交
        submitToBackground()
    }

    private fun submitToBackground() {
        binding.btnRecord.isEnabled = false
        binding.btnFinish.isEnabled = false
        binding.btnDiscard.isEnabled = false

        val mergedText = segments.mapIndexed { i, seg ->
            "【第${i + 1}段】\n${seg.transcription ?: ""}"
        }.joinToString("\n\n---\n\n")

        saveBrainstormToQueue(mergedText)
    }
    private fun saveBrainstormToQueue(mergedText: String?) {
        scope.launch(Dispatchers.IO) {
            try {
                val audioDir = File(filesDir, "audio")
                if (!audioDir.exists()) audioDir.mkdirs()

                val audioPaths = JSONArray()
                val transcriptions = JSONArray()
                for (seg in segments) {
                    val dest = File(audioDir, seg.audioFile.name)
                    if (seg.audioFile.exists()) {
                        seg.audioFile.copyTo(dest, overwrite = true)
                        seg.audioFile.delete()
                    }
                    audioPaths.put(dest.absolutePath)
                    transcriptions.put(seg.transcription ?: "")
                }

                val metadata = JSONObject().apply {
                    put("note_type", VoiceNoteType.BRAINSTORM.name)
                    put("brainstorm", true)
                    put("audio_paths", audioPaths)
                    put("transcriptions", transcriptions)
                }

                val entity = CaptureEntity(
                    id = UUID.randomUUID().toString(),
                    type = CaptureType.VOICE,
                    rawContent = mergedText ?: "",
                    metadata = metadata.toString(),
                    status = ProcessStatus.PENDING,
                    createdAt = System.currentTimeMillis(),
                    updatedAt = System.currentTimeMillis()
                )
                database.captureDao().insert(entity)
                Log.d(TAG, "头脑风暴已加入离线队列: ${entity.id}")

                val workRequest = SyncWorker.buildWorkRequest()
                WorkManager.getInstance(applicationContext)
                    .enqueueUniqueWork("sync_queue", ExistingWorkPolicy.REPLACE, workRequest)

                runOnUiThread {
                    FeedbackUtil.brainstormSuccess(this@BrainstormActivity)
                    finish()
                }
            } catch (e: Exception) {
                Log.e(TAG, "保存到离线队列失败: ${e.message}", e)
                runOnUiThread {
                    FeedbackUtil.showToast(this@BrainstormActivity, "保存失败: ${e.message}")
                    binding.btnRecord.isEnabled = true
                    binding.btnFinish.isEnabled = true
                    binding.btnDiscard.isEnabled = true
                }
            }
        }
    }

    private fun cleanupAudioFiles() {
        for (seg in segments) {
            if (seg.audioFile.exists()) seg.audioFile.delete()
        }
    }

    private fun confirmDiscard() {
        if (segments.isEmpty() && !isRecording) {
            finish()
            return
        }
        AlertDialog.Builder(this)
            .setTitle("放弃头脑风暴？")
            .setMessage("所有录音段落将被丢弃")
            .setPositiveButton("放弃") { _, _ ->
                if (isRecording) {
                    try { mediaRecorder?.stop(); mediaRecorder?.release() } catch (_: Exception) {}
                    mediaRecorder = null; isRecording = false
                }
                cleanupAudioFiles()
                finish()
            }
            .setNegativeButton("继续", null)
            .show()
    }

    private fun formatDuration(ms: Long): String {
        val seconds = (ms / 1000).toInt()
        return String.format("%02d:%02d", seconds / 60, seconds % 60)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int, permissions: Array<out String>, grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PermissionUtil.REQUEST_RECORD_AUDIO) {
            if (grantResults.isEmpty() || grantResults[0] != PackageManager.PERMISSION_GRANTED) {
                FeedbackUtil.showToast(this, "需要录音权限")
                finish()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        durationUpdateJob?.cancel()
        if (isRecording) {
            try { mediaRecorder?.stop(); mediaRecorder?.release() } catch (_: Exception) {}
        }
    }

    override fun finish() {
        super.finish()
        AnimUtil.exitPage(this)
    }
}
