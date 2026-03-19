package com.lingguang.catcher.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.MediaRecorder
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.exifinterface.media.ExifInterface
import com.lingguang.catcher.data.model.CaptureType
import com.lingguang.catcher.databinding.ActivityCameraCaptureBinding
import com.lingguang.catcher.util.FeedbackUtil
import com.lingguang.catcher.util.AnimUtil
import com.lingguang.catcher.util.ImageCompressor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.io.File
import java.util.UUID
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class CameraCaptureActivity : AppCompatActivity() {

    private lateinit var binding: ActivityCameraCaptureBinding
    private val TAG = "LingGuang"
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val database by lazy { com.lingguang.catcher.data.local.AppDatabase.getDatabase(applicationContext) }

    private var imageCapture: ImageCapture? = null
    private var camera: Camera? = null
    private lateinit var cameraExecutor: ExecutorService
    private var capturedFile: File? = null
    private var lensFacing = CameraSelector.LENS_FACING_BACK
    private var flashMode = ImageCapture.FLASH_MODE_OFF
    private var isGridVisible = false

    companion object {
        private const val REQUEST_PERSPECTIVE_CROP = 1001
    }

    // 缩放相关
    private var currentZoomRatio = 1f
    private lateinit var scaleGestureDetector: ScaleGestureDetector

    // 语音录制
    private var mediaRecorder: MediaRecorder? = null
    private var voiceFile: File? = null
    private var isRecording = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCameraCaptureBinding.inflate(layoutInflater)
        setContentView(binding.root)
        cameraExecutor = Executors.newSingleThreadExecutor()

        // 从 intent 获取摄像头选择
        val cameraFacing = intent.getStringExtra("camera_facing")
        if (cameraFacing == "front") {
            lensFacing = CameraSelector.LENS_FACING_FRONT
        }

        // 初始化缩放手势检测器
        scaleGestureDetector = ScaleGestureDetector(this, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
            override fun onScale(detector: ScaleGestureDetector): Boolean {
                val scale = detector.scaleFactor
                camera?.let { cam ->
                    val zoomState = cam.cameraInfo.zoomState.value
                    val maxZoom = zoomState?.maxZoomRatio ?: 1f
                    val minZoom = zoomState?.minZoomRatio ?: 1f
                    currentZoomRatio = (currentZoomRatio * scale).coerceIn(minZoom, maxZoom)
                    cam.cameraControl.setZoomRatio(currentZoomRatio)
                    Log.d(TAG, "缩放比例: $currentZoomRatio (min=$minZoom, max=$maxZoom)")
                }
                return true
            }
        })

        val missing = arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
            .filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isEmpty()) {
            startCamera()
        } else {
            ActivityCompat.requestPermissions(this, missing.toTypedArray(), 1001)
        }

        binding.btnCapture.setOnClickListener { takePhoto() }
        binding.btnCancel.setOnClickListener { finish() }
        binding.btnRetake.setOnClickListener { showViewfinder() }
        binding.btnFlash.setOnClickListener { toggleFlash() }
        binding.btnSwitchCamera.setOnClickListener { switchCamera() }
        binding.btnGrid.setOnClickListener { toggleGrid() }
        binding.btnConfirm.setOnClickListener {
            // 启动透视校正界面
            val intent = Intent(this, PerspectiveCropActivity::class.java)
            intent.putExtra(PerspectiveCropActivity.EXTRA_IMAGE_PATH, capturedFile?.absolutePath)
            startActivityForResult(intent, REQUEST_PERSPECTIVE_CROP)
        }
        binding.btnSkipVoice.setOnClickListener { processCapture(capturedFile!!, null) }

        // 按住录音，松开结束
        binding.btnRecordVoice.setOnTouchListener { v, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> { startVoiceRecording(); true }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> { v.performClick(); stopVoiceRecording(); true }
                else -> true
            }
        }
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()

            // 获取屏幕尺寸，使用屏幕比例
            val metrics = resources.displayMetrics
            val screenWidth = metrics.widthPixels
            val screenHeight = metrics.heightPixels
            Log.d(TAG, "屏幕尺寸: ${screenWidth}x${screenHeight}")

            val preview = Preview.Builder()
                .setTargetResolution(android.util.Size(screenWidth, screenHeight))
                .build()
                .also {
                    it.setSurfaceProvider(binding.previewView.surfaceProvider)
                }

            val imageCaptureUseCase = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                .setTargetResolution(android.util.Size(screenWidth, screenHeight))
                .setFlashMode(flashMode)
                .build()
            imageCapture = imageCaptureUseCase

            // 构建 CameraSelector
            val cameraSelector = CameraSelector.Builder()
                .requireLensFacing(lensFacing)
                .build()

            try {
                cameraProvider.unbindAll()
                camera = cameraProvider.bindToLifecycle(this, cameraSelector, preview, imageCaptureUseCase)

                // 更新闪光灯按钮
                updateFlashButton()

                // 打印相机信息
                camera?.cameraInfo?.let { info ->
                    Log.d(TAG, "使用的摄像头: lensFacing=${info.lensFacing}")
                    Log.d(TAG, "传感器旋转角度: ${info.sensorRotationDegrees}")
                }

                // 启用自动对焦
                camera?.cameraControl?.let { control ->
                    binding.previewView.post {
                        val centerPoint = binding.previewView.meteringPointFactory.createPoint(
                            binding.previewView.width / 2f,
                            binding.previewView.height / 2f
                        )
                        control.startFocusAndMetering(
                            androidx.camera.core.FocusMeteringAction.Builder(centerPoint).build()
                        )
                    }
                }

                // 点击对焦 + 双指缩放
                binding.previewView.setOnTouchListener { _, event ->
                    // 先处理缩放手势
                    scaleGestureDetector.onTouchEvent(event)

                    // 单指点击对焦
                    if (event.action == MotionEvent.ACTION_UP && event.pointerCount == 1) {
                        val point = binding.previewView.meteringPointFactory.createPoint(event.x, event.y)
                        camera?.cameraControl?.startFocusAndMetering(
                            androidx.camera.core.FocusMeteringAction.Builder(point)
                                .setAutoCancelDuration(3, java.util.concurrent.TimeUnit.SECONDS)
                                .build()
                        )?.addListener({
                            Log.d(TAG, "对焦完成")
                        }, ContextCompat.getMainExecutor(this))
                    }
                    true
                }
            } catch (e: Exception) {
                Log.e(TAG, "相机启动失败: ${e.message}")
                finish()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun takePhoto() {
        val imageCapture = imageCapture ?: return

        // 检查存储空间
        if (!com.lingguang.catcher.util.StorageHelper.hasEnoughSpace(this)) {
            FeedbackUtil.showToast(this, com.lingguang.catcher.util.StorageHelper.getInsufficientSpaceMessage(this))
            return
        }

        binding.btnCapture.isEnabled = false

        Log.d(TAG, "开始拍照，ImageCapture 旋转角度: ${imageCapture.targetRotation}")

        val photoFile = File(cacheDir, "photo_${System.currentTimeMillis()}.jpg")
        imageCapture.takePicture(
            ImageCapture.OutputFileOptions.Builder(photoFile).build(),
            cameraExecutor,
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                    FeedbackUtil.vibrate(this@CameraCaptureActivity, 80)
                    runOnUiThread { showPreview(photoFile) }
                }
                override fun onError(exc: ImageCaptureException) {
                    runOnUiThread {
                        binding.btnCapture.isEnabled = true
                        FeedbackUtil.captureError(this@CameraCaptureActivity, "拍照失败")
                    }
                }
            })
    }

    private fun showPreview(file: File) {
        capturedFile = file
        // 读取 EXIF 旋转角度，纠正方向
        val bitmap = correctBitmapOrientation(file)
        binding.ivPreview.setImageBitmap(bitmap)

        binding.previewView.visibility = View.GONE
        binding.ivPreview.visibility = View.VISIBLE
        binding.barViewfinder.visibility = View.GONE
        binding.barPreview.visibility = View.VISIBLE
    }

    private fun showViewfinder() {
        capturedFile?.delete()
        capturedFile = null
        binding.previewView.visibility = View.VISIBLE
        binding.ivPreview.visibility = View.GONE
        binding.barViewfinder.visibility = View.VISIBLE
        binding.barPreview.visibility = View.GONE
        binding.btnCapture.isEnabled = true

        // 重置缩放
        currentZoomRatio = 1f
        camera?.cameraControl?.setZoomRatio(1f)
    }

    private fun showVoiceInput() {
        binding.barPreview.visibility = View.GONE
        binding.barVoice.visibility = View.VISIBLE
        binding.layoutVoiceHint.visibility = View.VISIBLE
    }

    // ---- 语音录制 ----

    private fun startVoiceRecording() {
        if (!hasAudioPermission()) return
        try {
            val f = File(cacheDir, "voice_note_${System.currentTimeMillis()}.m4a")
            voiceFile = f
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
                setOutputFile(f.absolutePath)
                prepare()
                start()
            }
            isRecording = true
            FeedbackUtil.vibrate(this, 50)
            binding.tvVoiceStatus.text = "录音中... 松开结束"
        } catch (e: Exception) {
            Log.e(TAG, "录音失败: ${e.message}")
        }
    }

    private fun stopVoiceRecording() {
        if (!isRecording) return
        isRecording = false
        try {
            mediaRecorder?.stop()
            mediaRecorder?.release()
            mediaRecorder = null
        } catch (e: Exception) {
            Log.e(TAG, "录音 stop 异常: ${e.message}")
            mediaRecorder = null
            // 不删文件，让 STT 尝试处理已录制的内容
        }
        FeedbackUtil.vibrate(this, 80)
        binding.tvVoiceStatus.text = "✅ 已录制，正在处理..."
        binding.btnRecordVoice.isEnabled = false
        binding.btnSkipVoice.isEnabled = false

        val photo = capturedFile ?: return
        processCapture(photo, voiceFile)
    }

    // ---- 处理 ----

    private fun processCapture(photoFile: File, voiceFile: File?) {
        FeedbackUtil.captureSuccess(this)

        scope.launch(Dispatchers.IO) {
            try {
                // 持久化图片文件并压缩
                val imageDir = File(filesDir, "images")
                if (!imageDir.exists()) imageDir.mkdirs()
                val destPhoto = File(imageDir, photoFile.name)
                photoFile.copyTo(destPhoto, overwrite = true)
                photoFile.delete()

                // 压缩图片（减少存储和上传流量）
                ImageCompressor.compress(destPhoto)
                Log.d(TAG, "图片已压缩: ${destPhoto.length()} bytes")

                // 如果有语音，持久化语音文件并记录路径
                var voiceNotePath: String? = null
                if (voiceFile != null && voiceFile.exists()) {
                    val audioDir = File(filesDir, "audio")
                    if (!audioDir.exists()) audioDir.mkdirs()
                    val destVoice = File(audioDir, voiceFile.name)
                    voiceFile.copyTo(destVoice, overwrite = true)
                    voiceFile.delete()
                    voiceNotePath = destVoice.absolutePath
                }

                val metadataJson = org.json.JSONObject().apply {
                    if (voiceNotePath != null) put("voice_audio_path", voiceNotePath)
                }

                val entity = com.lingguang.catcher.data.local.CaptureEntity(
                    id = UUID.randomUUID().toString(),
                    type = CaptureType.IMAGE,
                    rawContent = destPhoto.absolutePath,
                    metadata = metadataJson.toString(),
                    status = com.lingguang.catcher.data.local.ProcessStatus.PENDING,
                    createdAt = System.currentTimeMillis(),
                    updatedAt = System.currentTimeMillis()
                )
                database.captureDao().insert(entity)
                Log.d(TAG, "图片已加入后台队列: ${entity.id}")

                val workRequest = androidx.work.OneTimeWorkRequestBuilder<com.lingguang.catcher.worker.SyncWorker>()
                    .addTag("sync").build()
                androidx.work.WorkManager.getInstance(applicationContext)
                    .enqueueUniqueWork("sync_queue", androidx.work.ExistingWorkPolicy.REPLACE, workRequest)

                runOnUiThread {
                    FeedbackUtil.captureSuccess(this@CameraCaptureActivity)
                    finish()
                }
            } catch (e: Exception) {
                Log.e(TAG, "保存到队列失败: ${e.message}", e)
                runOnUiThread {
                    FeedbackUtil.showToast(this@CameraCaptureActivity, "保存失败: ${e.message}")
                    finish()
                }
            }
        }
    }

    // ---- 工具 ----

    /** 读取 EXIF 旋转信息，返回方向正确的 Bitmap */
    private fun correctBitmapOrientation(file: File): Bitmap {
        val bitmap = BitmapFactory.decodeFile(file.absolutePath)
        val exif = ExifInterface(file.absolutePath)
        val orientation = exif.getAttributeInt(
            ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL
        )
        val rotation = when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> 0f
        }
        if (rotation == 0f) return bitmap
        val matrix = Matrix().apply { postRotate(rotation) }
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }

    private fun hasAudioPermission() =
        ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 1001 && grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            startCamera()
        } else {
            FeedbackUtil.showToast(this, "需要相机权限")
            finish()
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_PERSPECTIVE_CROP) {
            if (resultCode == RESULT_OK) {
                val croppedPath = data?.getStringExtra(PerspectiveCropActivity.RESULT_CROPPED_PATH)
                if (croppedPath != null) {
                    // 删除原始文件，使用裁剪后的文件
                    capturedFile?.delete()
                    capturedFile = File(croppedPath as String)

                    // 检查是否配置了 STT 服务
                    val settings = com.lingguang.catcher.data.local.AppSettings.getInstance(this)
                    val hasSTT = settings.geminiApiKey.isNotEmpty() ||
                        settings.openaiApiKey.isNotEmpty() ||
                        settings.dashscopeApiKey.isNotEmpty()

                    Log.d(TAG, "检查 STT 配置: hasSTT=$hasSTT")

                    if (hasSTT) {
                        Log.d(TAG, "显示语音输入界面")
                        showVoiceInput()
                    } else {
                        Log.d(TAG, "跳过语音输入，直接处理")
                        processCapture(capturedFile!!, null)
                    }
                }
            } else {
                // 用户取消了裁剪，返回预览界面
                showPreview(capturedFile!!)
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
        if (isRecording) {
            try { mediaRecorder?.stop(); mediaRecorder?.release() } catch (e: Exception) { }
        }
    }

    private fun toggleFlash() {
        flashMode = when (flashMode) {
            ImageCapture.FLASH_MODE_OFF -> ImageCapture.FLASH_MODE_AUTO
            ImageCapture.FLASH_MODE_AUTO -> ImageCapture.FLASH_MODE_ON
            else -> ImageCapture.FLASH_MODE_OFF
        }
        imageCapture?.flashMode = flashMode
        updateFlashButton()
        FeedbackUtil.vibrate(this, 30)
    }

    private fun updateFlashButton() {
        // ImageButton 使用图标，通过 alpha 表示状态
        binding.btnFlash.alpha = when (flashMode) {
            ImageCapture.FLASH_MODE_OFF -> 0.5f
            ImageCapture.FLASH_MODE_AUTO -> 0.75f
            ImageCapture.FLASH_MODE_ON -> 1.0f
            else -> 0.5f
        }
    }

    private fun switchCamera() {
        lensFacing = if (lensFacing == CameraSelector.LENS_FACING_BACK) {
            CameraSelector.LENS_FACING_FRONT
        } else {
            CameraSelector.LENS_FACING_BACK
        }
        startCamera()
        FeedbackUtil.vibrate(this, 30)
    }

    private fun toggleGrid() {
        isGridVisible = !isGridVisible
        binding.gridOverlay.visibility = if (isGridVisible) View.VISIBLE else View.GONE
        binding.btnGrid.alpha = if (isGridVisible) 1.0f else 0.5f
        FeedbackUtil.vibrate(this, 30)
    }

    override fun finish() {
        super.finish()
        AnimUtil.exitPage(this)
    }
}
