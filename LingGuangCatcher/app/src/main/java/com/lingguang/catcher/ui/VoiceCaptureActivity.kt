package com.lingguang.catcher.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import com.lingguang.catcher.data.local.AppDatabase
import com.lingguang.catcher.data.local.CaptureEntity
import com.lingguang.catcher.data.local.ProcessStatus
import com.lingguang.catcher.data.model.CaptureType
import com.lingguang.catcher.data.model.VoiceNoteType
import com.lingguang.catcher.data.repository.CaptureRepository
import com.lingguang.catcher.databinding.ActivityVoiceCaptureBinding
import com.lingguang.catcher.util.AnimUtil
import com.lingguang.catcher.util.FeedbackUtil
import com.lingguang.catcher.util.NoteTypeStatsManager
import com.lingguang.catcher.util.PermissionUtil
import com.lingguang.catcher.util.StorageHelper
import com.lingguang.catcher.worker.SyncWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.File
import java.util.UUID

class VoiceCaptureActivity : AppCompatActivity() {

    private lateinit var binding: ActivityVoiceCaptureBinding
    private val TAG = "LingGuang"
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val repository by lazy { CaptureRepository(applicationContext) }
    private val database by lazy { AppDatabase.getDatabase(applicationContext) }
    private val statsManager by lazy { NoteTypeStatsManager(applicationContext) }

    private var mediaRecorder: MediaRecorder? = null
    private var audioFile: File? = null
    private var isRecording = false
    private var isPaused = false
    private var recordingStartTime = 0L
    private var pausedDuration: Long = 0

    // 用于平滑录音波形的变量
    private var smoothedAmplitude: Float = 0f

    // 状态管理
    private var pauseStartTime = 0L
    private var selectedNoteType: VoiceNoteType = VoiceNoteType.getDefault()
    private var durationUpdateJob: kotlinx.coroutines.Job? = null
    private var waveformUpdateJob: kotlinx.coroutines.Job? = null
    private var maxAmplitude = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityVoiceCaptureBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupUI()

        if (!PermissionUtil.hasRecordAudioPermission(this)) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.RECORD_AUDIO),
                PermissionUtil.REQUEST_RECORD_AUDIO
            )
        }
    }

    private fun setupUI() {
        binding.btnCancel.setOnClickListener { finish() }

        binding.btnBrainstorm.setOnClickListener {
            startActivity(Intent(this, BrainstormActivity::class.java))
            finish()
        }

        binding.btnRecord.setOnClickListener {
            if (isRecording) {
                stopRecordingAndProcess()
            } else {
                startRecording()
            }
        }

        binding.btnPause.setOnClickListener {
            if (isPaused) {
                resumeRecording()
            } else {
                pauseRecording()
            }
        }

        // 设置标签选择监听
        setupNoteTypeSelection()
    }


    private fun selectType(type: VoiceNoteType) {
        selectedNoteType = type
        updateTypeSelection()
        Log.d(TAG, "选择笔记类型: ${type.getDisplayText()}")
    }

    private fun updateTypeSelection() {
        // 更新所有按钮的选中状态
        binding.btnTypeInspiration.isSelected = selectedNoteType == VoiceNoteType.INSPIRATION
        binding.btnTypeTask.isSelected = selectedNoteType == VoiceNoteType.TASK
        binding.btnTypeSchedule.isSelected = selectedNoteType == VoiceNoteType.SCHEDULE
        binding.btnTypeLearning.isSelected = selectedNoteType == VoiceNoteType.LEARNING
        binding.btnTypeThought.isSelected = selectedNoteType == VoiceNoteType.THOUGHT
        binding.btnTypeExcerpt.isSelected = selectedNoteType == VoiceNoteType.EXCERPT
        binding.btnTypeGoal.isSelected = selectedNoteType == VoiceNoteType.GOAL
        binding.btnTypeQuestion.isSelected = selectedNoteType == VoiceNoteType.QUESTION
        binding.btnTypeContact.isSelected = selectedNoteType == VoiceNoteType.CONTACT
        binding.btnTypeLife.isSelected = selectedNoteType == VoiceNoteType.LIFE
        binding.btnTypeWork.isSelected = selectedNoteType == VoiceNoteType.WORK
        binding.btnTypeBrainstorm.isSelected = selectedNoteType == VoiceNoteType.BRAINSTORM
    }


    private fun setupNoteTypeSelection() {
        // 绑定 12 个按钮
        binding.btnTypeInspiration.setOnClickListener { selectType(VoiceNoteType.INSPIRATION) }
        binding.btnTypeTask.setOnClickListener { selectType(VoiceNoteType.TASK) }
        binding.btnTypeSchedule.setOnClickListener { selectType(VoiceNoteType.SCHEDULE) }
        binding.btnTypeLearning.setOnClickListener { selectType(VoiceNoteType.LEARNING) }
        binding.btnTypeThought.setOnClickListener { selectType(VoiceNoteType.THOUGHT) }
        binding.btnTypeExcerpt.setOnClickListener { selectType(VoiceNoteType.EXCERPT) }
        binding.btnTypeGoal.setOnClickListener { selectType(VoiceNoteType.GOAL) }
        binding.btnTypeQuestion.setOnClickListener { selectType(VoiceNoteType.QUESTION) }
        binding.btnTypeContact.setOnClickListener { selectType(VoiceNoteType.CONTACT) }
        binding.btnTypeLife.setOnClickListener { selectType(VoiceNoteType.LIFE) }
        binding.btnTypeWork.setOnClickListener { selectType(VoiceNoteType.WORK) }
        binding.btnTypeBrainstorm.setOnClickListener { selectType(VoiceNoteType.BRAINSTORM) }
    }


    /**
     * 根据类型选中对应的 Chip 或按钮
     */
    private fun selectChipByType(type: VoiceNoteType) {
        selectedNoteType = type
        updateTypeSelection()
    }

    private fun startRecording() {
        if (!PermissionUtil.hasRecordAudioPermission(this)) {
            FeedbackUtil.showToast(this, "需要录音权限")
            return
        }

        // 检查存储空间
        if (!StorageHelper.hasEnoughSpace(this)) {
            FeedbackUtil.showToast(this, StorageHelper.getInsufficientSpaceMessage(this))
            return
        }

        try {
            val outputFile = File(cacheDir, "voice_${System.currentTimeMillis()}.m4a")
            audioFile = outputFile

            mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(this)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
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
            isPaused = false
            recordingStartTime = System.currentTimeMillis()
            pausedDuration = 0L
            maxAmplitude = 0
            FeedbackUtil.vibrateRecordStart(this)

            // 更新 UI
            binding.tvStatus.text = "录音中..."
            binding.tvDuration.visibility = View.VISIBLE
            binding.waveformView.visibility = View.VISIBLE
            binding.waveformView.clear()
            binding.btnRecord.text = "停止"
            binding.btnPause.visibility = View.VISIBLE
            binding.btnPause.text = "暂停"

            // 启动录音时长计时器
            startDurationTimer()

            // 启动波形更新
            startWaveformUpdate()

            Log.d(TAG, "录音已开始: ${outputFile.absolutePath}")

        } catch (e: Exception) {
            Log.e(TAG, "录音启动失败: ${e.message}", e)
            FeedbackUtil.captureError(this, "录音启动失败: ${e.message}")
            isRecording = false
        }
    }

    private fun pauseRecording() {
        if (!isRecording || isPaused) return

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                mediaRecorder?.pause()
                isPaused = true
                pauseStartTime = System.currentTimeMillis()

                binding.tvStatus.text = "已暂停"
                binding.btnPause.text = "继续"
                FeedbackUtil.vibrate(this, 30)
            } else {
                FeedbackUtil.showToast(this, "当前系统版本不支持暂停功能")
            }
        } catch (e: Exception) {
            Log.e(TAG, "暂停失败: ${e.message}", e)
        }
    }

    private fun resumeRecording() {
        if (!isRecording || !isPaused) return

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                mediaRecorder?.resume()
                isPaused = false
                pausedDuration += System.currentTimeMillis() - pauseStartTime

                binding.tvStatus.text = "录音中..."
                binding.btnPause.text = "暂停"
                FeedbackUtil.vibrate(this, 30)
            }
        } catch (e: Exception) {
            Log.e(TAG, "继续失败: ${e.message}", e)
        }
    }

    private fun startDurationTimer() {
        durationUpdateJob?.cancel()
        durationUpdateJob = scope.launch {
            while (isRecording) {
                if (!isPaused) {
                    val elapsed = System.currentTimeMillis() - recordingStartTime - pausedDuration
                    val seconds = (elapsed / 1000).toInt()
                    val minutes = seconds / 60
                    val secs = seconds % 60
                    binding.tvDuration.text = String.format("%02d:%02d", minutes, secs)
                }
                delay(100)
            }
        }
    }

    private fun startWaveformUpdate() {
        waveformUpdateJob?.cancel()
        waveformUpdateJob = scope.launch {
            while (isRecording) {
                if (!isPaused) {
                    try {
                        // 获取当前音量振幅（0-32767）
                        val amplitude = mediaRecorder?.maxAmplitude ?: 0
                        // 记录最大音量
                        if (amplitude > maxAmplitude) {
                            maxAmplitude = amplitude
                        }
                        // 归一化到 0-1 范围
                        val targetAmplitude = amplitude / 32767f
                        
                        // 添加低通滤波 (Low-pass filter) 让波形过度更加顺滑，而不是直接跳跃
                        smoothedAmplitude += (targetAmplitude - smoothedAmplitude) * 0.4f
                        
                        binding.waveformView.addAmplitude(smoothedAmplitude)
                    } catch (e: Exception) {
                        Log.e(TAG, "获取振幅失败: ${e.message}")
                    }
                }
                delay(50) // 每 50ms 更新一次波形
            }
        }
    }

    private fun stopRecordingAndProcess() {
        if (!isRecording) return
        isRecording = false
        isPaused = false
        durationUpdateJob?.cancel()
        waveformUpdateJob?.cancel()

        try {
            mediaRecorder?.apply {
                stop()
                release()
            }
            mediaRecorder = null
            FeedbackUtil.vibrateRecordStop(this)
        } catch (e: Exception) {
            Log.e(TAG, "停止录音失败: ${e.message}", e)
        }

        // 计算实际录音时长
        val actualDuration = (System.currentTimeMillis() - recordingStartTime - pausedDuration) / 1000.0
        Log.d(TAG, "录音时长: ${actualDuration}秒, 最大音量: $maxAmplitude")

        // 检查时长是否足够
        if (actualDuration < 1.0) {
            FeedbackUtil.captureError(this, "录音时长不足1秒，请重新录制")
            audioFile?.delete()
            finish()
            return
        }

        // 检查音量是否足够（判断是否有实际语音）
        if (maxAmplitude < 500) {
            FeedbackUtil.captureError(this, "未检测到语音，请确保麦克风正常并靠近说话")
            audioFile?.delete()
            finish()
            return
        }

        // 更新 UI
        binding.tvStatus.text = "正在处理..."
        binding.waveformView.visibility = View.GONE
        binding.btnRecord.isEnabled = false
        binding.btnCancel.isEnabled = false

        val file = audioFile
        if (file != null && file.exists() && file.length() > 0) {
            Log.d(TAG, "录音文件: ${file.absolutePath}, 大小: ${file.length()} bytes")
            processVoiceFile(file)
        } else {
            FeedbackUtil.captureError(this, "录音文件为空")
            finish()
        }
    }

    private fun processVoiceFile(file: File) {
        scope.launch {
            try {
                // 1. 转录音频（Gemini 会自动清理文本）
                binding.tvStatus.text = "正在转录语音..."
                Log.d(TAG, "开始转录音频文件: ${file.absolutePath}, 大小: ${file.length()} bytes")

                val transcription = try {
                    repository.transcribeAudio(file)
                } catch (e: Exception) {
                    Log.e(TAG, "转录异常: ${e.message}", e)
                    saveVoiceToQueue(file, null)
                    return@launch
                }

                if (transcription.isNullOrBlank()) {
                    Log.e(TAG, "转录结果为空")
                    saveVoiceToQueue(file, null)
                    return@launch
                }

                Log.d(TAG, "转录成功，长度: ${transcription.length}. 开始 AI 智能扩展...")
                binding.tvStatus.text = "正在智能扩展文本..."

                val enhancedTranscription = repository.enhanceTranscription(transcription)

                // 2. 显示转录结果
                binding.tvStatus.text = "转录完成"
                binding.cardTranscription.visibility = View.VISIBLE
                binding.tvTranscription.setText(enhancedTranscription)

                // 3. 显示标签选择
                binding.cardNoteType.visibility = View.VISIBLE

                // 4. 使用最常用的类型作为默认选择
                val mostUsedType = statsManager.getMostUsedType()
                if (mostUsedType != null) {
                    selectedNoteType = mostUsedType
                    selectChipByType(mostUsedType)
                    Log.d(TAG, "使用最常用类型: ${mostUsedType.getDisplayText()}")
                }

                // 3. 显示编辑确认按钮
                binding.btnCancel.text = "重录"
                binding.btnCancel.isEnabled = true
                binding.btnCancel.setOnClickListener {
                    // 重新录音
                    file.delete()
                    resetUI()
                }

                binding.btnRecord.text = "确认"
                binding.btnRecord.isEnabled = true
                binding.btnRecord.setOnClickListener {
                    // 获取编辑后的文本
                    val editedText = binding.tvTranscription.text?.toString() ?: transcription
                    if (editedText.isBlank()) {
                        FeedbackUtil.showToast(this@VoiceCaptureActivity, "内容不能为空")
                        return@setOnClickListener
                    }
                    // 确认后继续处理
                    processTranscription(editedText, file)
                }

                Log.d(TAG, "转录结果: $transcription")

            } catch (e: Exception) {
                Log.e(TAG, "处理失败: ${e.message}", e)
                FeedbackUtil.captureError(this@VoiceCaptureActivity, "处理失败: ${e.message}")
                finish()
            }
        }
    }

    private fun resetUI() {
        binding.tvStatus.text = "点击下方按钮开始录音"
        binding.cardTranscription.visibility = View.GONE
        binding.cardNoteType.visibility = View.GONE
        binding.btnCancel.text = "取消"
        binding.btnCancel.setOnClickListener { finish() }
        binding.btnRecord.text = "开始录音"
        binding.btnRecord.setOnClickListener {
            if (isRecording) {
                stopRecordingAndProcess()
            } else {
                startRecording()
            }
        }
        audioFile = null
        selectedNoteType = VoiceNoteType.getDefault()
        updateTypeSelection()
    }

    private fun processTranscription(transcription: String, file: File) {
        statsManager.recordUsage(selectedNoteType)
        Log.d(TAG, "记录类型使用: ${selectedNoteType.getDisplayText()}")

        binding.btnRecord.isEnabled = false
        binding.btnCancel.isEnabled = false

        // 入队列完成后再 finish
        saveVoiceToQueue(file, transcription)
    }

    private fun persistAudioFile(cacheFile: File): File {
        val audioDir = File(filesDir, "audio")
        if (!audioDir.exists()) audioDir.mkdirs()
        val destFile = File(audioDir, cacheFile.name)
        cacheFile.copyTo(destFile, overwrite = true)
        cacheFile.delete()
        Log.d(TAG, "音频文件持久化: ${destFile.absolutePath}")
        return destFile
    }

    private fun saveVoiceToQueue(audioFile: File, transcription: String?) {
        scope.launch(Dispatchers.IO) {
            try {
                val persistedFile = persistAudioFile(audioFile)
                val metadata = JSONObject().apply {
                    put("audio_path", persistedFile.absolutePath)
                    put("note_type", selectedNoteType.name)
                }
                val entity = CaptureEntity(
                    id = UUID.randomUUID().toString(),
                    type = CaptureType.VOICE,
                    rawContent = transcription ?: "",
                    metadata = metadata.toString(),
                    status = ProcessStatus.PENDING,
                    createdAt = System.currentTimeMillis(),
                    updatedAt = System.currentTimeMillis()
                )
                database.captureDao().insert(entity)
                Log.d(TAG, "语音已加入离线队列: ${entity.id}, 音频: ${persistedFile.absolutePath}")

                // 触发 SyncWorker
                val workRequest = SyncWorker.buildWorkRequest()
                WorkManager.getInstance(applicationContext)
                    .enqueueUniqueWork("sync_queue", ExistingWorkPolicy.REPLACE, workRequest)

                runOnUiThread {
                    FeedbackUtil.captureSuccess(this@VoiceCaptureActivity)
                    finish()
                }
            } catch (e: Exception) {
                Log.e(TAG, "保存到离线队列失败: ${e.message}", e)
                runOnUiThread {
                    FeedbackUtil.showToast(this@VoiceCaptureActivity, "保存失败: ${e.message}")
                    binding.btnRecord.isEnabled = true
                    binding.btnCancel.isEnabled = true
                }
            }
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PermissionUtil.REQUEST_RECORD_AUDIO) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startRecording()
            } else {
                FeedbackUtil.showToast(this, "需要录音权限")
                finish()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (isRecording) {
            try {
                mediaRecorder?.stop()
                mediaRecorder?.release()
            } catch (e: Exception) {
                // ignore
            }
        }
    }

    override fun finish() {
        super.finish()
        AnimUtil.exitPage(this)
    }
}
