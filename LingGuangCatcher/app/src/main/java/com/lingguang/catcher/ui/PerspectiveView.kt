package com.lingguang.catcher.ui

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View
import kotlin.math.hypot

/**
 * 透视校正视图
 * 显示图片并允许用户拖动四个角点进行透视变换
 */
class PerspectiveView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private var bitmap: Bitmap? = null
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#4CAF50")
        strokeWidth = 4f
        style = Paint.Style.STROKE
    }
    private val pointPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#4CAF50")
        style = Paint.Style.FILL
    }
    private val pointStrokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        strokeWidth = 4f
        style = Paint.Style.STROKE
    }

    // 四个角点（相对于 View 的坐标）
    private val points = arrayOf(
        PointF(0f, 0f),      // 左上
        PointF(0f, 0f),      // 右上
        PointF(0f, 0f),      // 右下
        PointF(0f, 0f)       // 左下
    )

    private var draggedPointIndex = -1
    private val touchRadius = 120f  // 增大触摸响应范围

    // 图片在 View 中的显示区域
    private val imageRect = RectF()

    fun setBitmap(bmp: Bitmap) {
        bitmap = bmp
        post {
            initializePoints()
            invalidate()
        }
    }

    /**
     * 自动检测文档边缘并设置角点
     * @return 是否检测成功
     */
    /**
     * 自动检测边缘
     * @return 检测是否成功
     */
    fun autoDetectEdges(): Boolean {
        val bmp = bitmap ?: return false

        val result = com.lingguang.catcher.util.EdgeDetector.detectEdgesWithConfidence(bmp)
        if (result != null && result.corners.size == 4) {
            // 将检测到的点（图片坐标）转换为 View 坐标
            val scaleX = imageRect.width() / bmp.width
            val scaleY = imageRect.height() / bmp.height

            for (i in 0..3) {
                points[i].x = imageRect.left + result.corners[i].x * scaleX
                points[i].y = imageRect.top + result.corners[i].y * scaleY
            }

            invalidate()

            // 记录置信度（可用于显示给用户）
            android.util.Log.d("PerspectiveView", "边缘检测置信度: ${result.confidence}")

            return true
        }

        return false
    }

    /**
     * 获取最后一次检测的置信度
     */
    fun getLastDetectionConfidence(): Float {
        val bmp = bitmap ?: return 0f
        val result = com.lingguang.catcher.util.EdgeDetector.detectEdgesWithConfidence(bmp)
        return result?.confidence ?: 0f
    }

    private fun initializePoints() {
        val bmp = bitmap ?: return

        // 计算图片在 View 中的显示位置（保持宽高比，居中显示）
        val viewWidth = width.toFloat()
        val viewHeight = height.toFloat()
        val bmpWidth = bmp.width.toFloat()
        val bmpHeight = bmp.height.toFloat()

        val scale = minOf(viewWidth / bmpWidth, viewHeight / bmpHeight)
        val scaledWidth = bmpWidth * scale
        val scaledHeight = bmpHeight * scale

        val left = (viewWidth - scaledWidth) / 2
        val top = (viewHeight - scaledHeight) / 2

        imageRect.set(left, top, left + scaledWidth, top + scaledHeight)

        // 初始化四个角点为图片的四个角（留一点边距）
        val margin = 20f
        points[0].set(imageRect.left + margin, imageRect.top + margin)
        points[1].set(imageRect.right - margin, imageRect.top + margin)
        points[2].set(imageRect.right - margin, imageRect.bottom - margin)
        points[3].set(imageRect.left + margin, imageRect.bottom - margin)
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        // 绘制图片
        bitmap?.let {
            canvas.drawBitmap(it, null, imageRect, paint)
        }

        // 绘制半透明遮罩（选区外的部分）
        val path = Path().apply {
            moveTo(points[0].x, points[0].y)
            lineTo(points[1].x, points[1].y)
            lineTo(points[2].x, points[2].y)
            lineTo(points[3].x, points[3].y)
            close()
        }

        val maskPaint = Paint().apply {
            color = Color.parseColor("#80000000")
            style = Paint.Style.FILL
        }
        canvas.save()
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            canvas.clipOutPath(path)
        } else {
            @Suppress("DEPRECATION")
            canvas.clipPath(path, Region.Op.DIFFERENCE)
        }
        canvas.drawRect(imageRect, maskPaint)
        canvas.restore()

        // 绘制选区边框
        canvas.drawPath(path, linePaint)

        // 绘制四个角点
        for (point in points) {
            canvas.drawCircle(point.x, point.y, 24f, pointPaint)
            canvas.drawCircle(point.x, point.y, 24f, pointStrokePaint)
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.action) {
            MotionEvent.ACTION_DOWN -> {
                // 查找最近的角点
                draggedPointIndex = findNearestPoint(event.x, event.y)
                return draggedPointIndex != -1
            }
            MotionEvent.ACTION_MOVE -> {
                if (draggedPointIndex != -1) {
                    // 限制在图片范围内
                    points[draggedPointIndex].x = event.x.coerceIn(imageRect.left, imageRect.right)
                    points[draggedPointIndex].y = event.y.coerceIn(imageRect.top, imageRect.bottom)
                    invalidate()
                    return true
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                draggedPointIndex = -1
            }
        }
        return super.onTouchEvent(event)
    }

    private fun findNearestPoint(x: Float, y: Float): Int {
        var minDist = Float.MAX_VALUE
        var nearestIndex = -1

        for (i in points.indices) {
            val dist = hypot(points[i].x - x, points[i].y - y)
            if (dist < touchRadius && dist < minDist) {
                minDist = dist
                nearestIndex = i
            }
        }
        return nearestIndex
    }

    /**
     * 获取四个角点在原始图片中的坐标
     */
    fun getImagePoints(): Array<PointF> {
        val bmp = bitmap ?: return emptyArray()

        // 计算从 View 坐标到图片坐标的映射
        val scaleX = bmp.width / imageRect.width()
        val scaleY = bmp.height / imageRect.height()

        return points.map { viewPoint ->
            PointF(
                (viewPoint.x - imageRect.left) * scaleX,
                (viewPoint.y - imageRect.top) * scaleY
            )
        }.toTypedArray()
    }
}
