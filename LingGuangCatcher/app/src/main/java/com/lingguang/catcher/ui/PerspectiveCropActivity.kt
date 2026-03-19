package com.lingguang.catcher.ui

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import androidx.exifinterface.media.ExifInterface
import com.lingguang.catcher.databinding.ActivityPerspectiveCropBinding
import com.lingguang.catcher.util.FeedbackUtil
import com.lingguang.catcher.util.PerspectiveTransform
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

/**
 * 透视校正 Activity
 * 允许用户调整四个角点进行透视变换
 */
class PerspectiveCropActivity : AppCompatActivity() {

    private lateinit var binding: ActivityPerspectiveCropBinding
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val TAG = "LingGuang"

    private var originalBitmap: Bitmap? = null
    private var imagePath: String? = null

    companion object {
        const val EXTRA_IMAGE_PATH = "image_path"
        const val RESULT_CROPPED_PATH = "cropped_path"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPerspectiveCropBinding.inflate(layoutInflater)
        setContentView(binding.root)

        imagePath = intent.getStringExtra(EXTRA_IMAGE_PATH)
        if (imagePath == null) {
            finish()
            return
        }

        loadImage()
        setupButtons()
    }

    private fun loadImage() {
        scope.launch {
            val bitmap = withContext(Dispatchers.IO) {
                val rawBitmap = BitmapFactory.decodeFile(imagePath)
                // 读取 EXIF 并校正方向
                if (rawBitmap != null) {
                    correctBitmapOrientation(File(imagePath!!), rawBitmap)
                } else {
                    null
                }
            }

            if (bitmap == null) {
                FeedbackUtil.showToast(this@PerspectiveCropActivity, "加载图片失败")
                finish()
                return@launch
            }

            originalBitmap = bitmap
            binding.perspectiveView.setBitmap(bitmap)

            // 尝试自动检测边缘
            tryAutoDetect(silent = true)
        }
    }

    private fun setupButtons() {
        binding.btnAutoDetect.setOnClickListener {
            tryAutoDetect(silent = false)
        }

        binding.btnCancel.setOnClickListener {
            setResult(Activity.RESULT_CANCELED)
            finish()
        }

        binding.btnConfirm.setOnClickListener {
            performCrop()
        }
    }

    private fun tryAutoDetect(silent: Boolean) {
        val bitmap = originalBitmap ?: return

        scope.launch {
            binding.btnAutoDetect.isEnabled = false
            binding.tvHint.text = "正在检测边缘..."

            val success = withContext(Dispatchers.IO) {
                binding.perspectiveView.autoDetectEdges()
            }

            if (success) {
                if (!silent) {
                    FeedbackUtil.showToast(this@PerspectiveCropActivity, "✅ 自动检测成功")
                }
                binding.tvHint.text = "拖动四个角点调整裁剪区域"
            } else {
                if (!silent) {
                    FeedbackUtil.showToast(this@PerspectiveCropActivity, "⚠️ 自动检测失败，已设置默认边缘")
                }
                binding.tvHint.text = "拖动四个角点调整裁剪区域"
            }

            binding.btnAutoDetect.isEnabled = true
        }
    }

    private fun performCrop() {
        val bitmap = originalBitmap ?: return
        val corners = binding.perspectiveView.getImagePoints()

        if (corners.size != 4) {
            FeedbackUtil.showToast(this, "角点数据错误")
            return
        }

        binding.btnConfirm.isEnabled = false
        binding.tvHint.text = "正在处理..."

        scope.launch {
            try {
                val croppedBitmap = withContext(Dispatchers.IO) {
                    PerspectiveTransform.transform(bitmap, corners)
                }

                // 保存裁剪后的图片
                val outputFile = File(cacheDir, "cropped_${System.currentTimeMillis()}.jpg")
                withContext(Dispatchers.IO) {
                    outputFile.outputStream().use { out ->
                        croppedBitmap.compress(Bitmap.CompressFormat.JPEG, 95, out)
                    }
                }

                // 返回结果
                val resultIntent = Intent().apply {
                    putExtra(RESULT_CROPPED_PATH, outputFile.absolutePath)
                }
                setResult(Activity.RESULT_OK, resultIntent)
                finish()

            } catch (e: Exception) {
                Log.e(TAG, "透视变换失败: ${e.message}")
                FeedbackUtil.showToast(this@PerspectiveCropActivity, "处理失败: ${e.message}")
                binding.btnConfirm.isEnabled = true
                binding.tvHint.text = "拖动四个角点调整裁剪区域"
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        originalBitmap?.recycle()
    }

    /** 读取 EXIF 旋转信息，返回方向正确的 Bitmap */
    private fun correctBitmapOrientation(file: File, bitmap: Bitmap): Bitmap {
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
}
