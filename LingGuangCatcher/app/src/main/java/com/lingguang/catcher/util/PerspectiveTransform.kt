package com.lingguang.catcher.util

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.PointF
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

object PerspectiveTransform {

    /**
     * 对图片进行透视变换
     * @param source 原始图片
     * @param corners 四个角点（左上、右上、右下、左下）
     * @return 变换后的图片
     */
    fun transform(source: Bitmap, corners: Array<PointF>): Bitmap {
        if (corners.size != 4) {
            throw IllegalArgumentException("需要提供 4 个角点")
        }

        // 计算目标矩形的宽高
        val width = max(
            hypot(corners[0].x - corners[1].x, corners[0].y - corners[1].y),
            hypot(corners[3].x - corners[2].x, corners[3].y - corners[2].y)
        ).toInt()

        val height = max(
            hypot(corners[0].x - corners[3].x, corners[0].y - corners[3].y),
            hypot(corners[1].x - corners[2].x, corners[1].y - corners[2].y)
        ).toInt()

        // 使用 Android Matrix 进行透视变换
        val matrix = Matrix()

        // 源点和目标点
        val src = floatArrayOf(
            corners[0].x, corners[0].y,  // 左上
            corners[1].x, corners[1].y,  // 右上
            corners[2].x, corners[2].y,  // 右下
            corners[3].x, corners[3].y   // 左下
        )

        val dst = floatArrayOf(
            0f, 0f,                      // 左上
            width.toFloat(), 0f,         // 右上
            width.toFloat(), height.toFloat(),  // 右下
            0f, height.toFloat()         // 左下
        )

        matrix.setPolyToPoly(src, 0, dst, 0, 4)

        // 创建结果 Bitmap
        val result = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(result)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)

        canvas.drawBitmap(source, matrix, paint)

        return result
    }

    /**
     * 自动检测文档边缘（简化版本，不依赖 OpenCV）
     * 返回图片四个角的默认位置（留 5% 边距）
     */
    fun detectEdges(source: Bitmap): Array<PointF> {
        val margin = min(source.width, source.height) * 0.05f

        return arrayOf(
            PointF(margin, margin),                                    // 左上
            PointF(source.width - margin, margin),                     // 右上
            PointF(source.width - margin, source.height - margin),     // 右下
            PointF(margin, source.height - margin)                     // 左下
        )
    }
}
