package com.lingguang.catcher.util

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import androidx.exifinterface.media.ExifInterface
import java.io.File
import java.io.FileOutputStream
import kotlin.math.min

/**
 * 图片压缩工具
 * 减少存储空间和上传流量
 */
object ImageCompressor {

    private const val MAX_WIDTH = 1920
    private const val MAX_HEIGHT = 1920
    private const val QUALITY = 85

    /**
     * 压缩图片文件
     * @param sourceFile 原始图片文件
     * @param targetFile 目标文件（可以与源文件相同）
     * @return 压缩后的文件
     */
    fun compress(sourceFile: File, targetFile: File = sourceFile): File {
        // 读取 EXIF 信息
        val exif = ExifInterface(sourceFile.absolutePath)
        val orientation = exif.getAttributeInt(
            ExifInterface.TAG_ORIENTATION,
            ExifInterface.ORIENTATION_NORMAL
        )

        // 先获取图片尺寸，不加载到内存
        val options = BitmapFactory.Options().apply {
            inJustDecodeBounds = true
        }
        BitmapFactory.decodeFile(sourceFile.absolutePath, options)
        val originalWidth = options.outWidth
        val originalHeight = options.outHeight

        // 计算缩放比例
        val scale = calculateScale(originalWidth, originalHeight)

        // 加载并缩放图片
        val scaledOptions = BitmapFactory.Options().apply {
            inSampleSize = scale
            inJustDecodeBounds = false
        }
        var bitmap = BitmapFactory.decodeFile(sourceFile.absolutePath, scaledOptions)

        // 如果还是太大，再次缩放
        if (bitmap.width > MAX_WIDTH || bitmap.height > MAX_HEIGHT) {
            val ratio = min(
                MAX_WIDTH.toFloat() / bitmap.width,
                MAX_HEIGHT.toFloat() / bitmap.height
            )
            val matrix = Matrix().apply {
                postScale(ratio, ratio)
            }
            val resized = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
            if (resized != bitmap) bitmap.recycle()
            bitmap = resized
        }

        // 应用 EXIF 旋转
        val rotation = when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> 0f
        }
        if (rotation != 0f) {
            val matrix = Matrix().apply { postRotate(rotation) }
            val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
            if (rotated != bitmap) bitmap.recycle()
            bitmap = rotated
        }

        // 保存压缩后的图片
        FileOutputStream(targetFile).use { out ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, QUALITY, out)
        }
        bitmap.recycle()

        return targetFile
    }

    /**
     * 计算采样率（inSampleSize）
     */
    private fun calculateScale(width: Int, height: Int): Int {
        var scale = 1
        while (width / scale > MAX_WIDTH * 2 || height / scale > MAX_HEIGHT * 2) {
            scale *= 2
        }
        return scale
    }
}
