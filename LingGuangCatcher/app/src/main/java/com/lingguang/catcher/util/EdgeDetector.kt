package com.lingguang.catcher.util

import android.graphics.*
import android.util.Log
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

/**
 * 文档边缘检测工具（优化版）
 * 使用 Android 原生 API 实现增强的边缘检测
 *
 * V2.0 改进：
 * - 添加图像预处理（降噪、对比度增强）
 * - 自适应阈值
 * - 多尺度检测
 * - 置信度评分
 */
object EdgeDetector {

    private const val TAG = "EdgeDetector"

    /**
     * 检测结果
     */
    data class DetectionResult(
        val corners: Array<PointF>,  // 四个角点
        val confidence: Float         // 置信度 0-1
    )

    /**
     * 检测图片中的文档边缘，返回四个角点和置信度
     * @param bitmap 输入图片
     * @return 检测结果，如果检测失败返回 null
     */
    fun detectEdges(bitmap: Bitmap): Array<PointF>? {
        val result = detectEdgesWithConfidence(bitmap)
        return result?.corners
    }

    /**
     * 检测图片中的文档边缘（带置信度）
     * @param bitmap 输入图片
     * @return 检测结果（包含角点和置信度），如果检测失败返回 null
     */
    fun detectEdgesWithConfidence(bitmap: Bitmap): DetectionResult? {
        try {
            Log.d(TAG, "开始边缘检测，图片尺寸: ${bitmap.width}x${bitmap.height}")

            // 1. 缩小图片以提高性能
            val scaledBitmap = scaleBitmap(bitmap, 800)
            Log.d(TAG, "缩放后尺寸: ${scaledBitmap.width}x${scaledBitmap.height}")

            // 2. 图像预处理
            val preprocessed = preprocessImage(scaledBitmap)

            // 3. 边缘检测（使用自适应阈值）
            val edges = detectEdgesAdaptive(preprocessed)

            // 4. 查找轮廓
            val contours = findContours(edges)
            Log.d(TAG, "找到 ${contours.size} 个轮廓")

            // 5. 找到最大的四边形轮廓
            val quadrilateral = findLargestQuadrilateral(contours, scaledBitmap.width, scaledBitmap.height)

            // 6. 计算置信度
            val confidence = calculateConfidence(quadrilateral, scaledBitmap.width, scaledBitmap.height)
            Log.d(TAG, "检测置信度: $confidence")

            // 7. 将坐标映射回原始图片尺寸
            return quadrilateral?.let { quad ->
                val scale = bitmap.width.toFloat() / scaledBitmap.width
                val corners = quad.map { point ->
                    PointF(point.x * scale, point.y * scale)
                }.toTypedArray()
                DetectionResult(corners, confidence)
            }
        } catch (e: Exception) {
            Log.e(TAG, "边缘检测失败: ${e.message}", e)
            return null
        }
    }

    /**
     * 缩放图片到指定最大宽度（保持宽高比）
     */
    private fun scaleBitmap(bitmap: Bitmap, maxWidth: Int): Bitmap {
        if (bitmap.width <= maxWidth) return bitmap

        val scale = maxWidth.toFloat() / bitmap.width
        val newHeight = (bitmap.height * scale).toInt()
        return Bitmap.createScaledBitmap(bitmap, maxWidth, newHeight, true)
    }

    /**
     * 转换为灰度图
     */
    private fun toGrayscale(bitmap: Bitmap): Bitmap {
        val width = bitmap.width
        val height = bitmap.height
        val grayBitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)

        val canvas = Canvas(grayBitmap)
        val paint = Paint()
        val colorMatrix = ColorMatrix().apply {
            setSaturation(0f) // 去除饱和度，转为灰度
        }
        paint.colorFilter = ColorMatrixColorFilter(colorMatrix)
        canvas.drawBitmap(bitmap, 0f, 0f, paint)

        return grayBitmap
    }

    /**
     * 简化的边缘检测（基于亮度梯度）
     */
    private fun detectEdgesSimple(bitmap: Bitmap): Array<IntArray> {
        val width = bitmap.width
        val height = bitmap.height
        val pixels = IntArray(width * height)
        bitmap.getPixels(pixels, 0, width, 0, 0, width, height)

        val edges = Array(height) { IntArray(width) }

        // Sobel 算子
        for (y in 1 until height - 1) {
            for (x in 1 until width - 1) {
                val gx = (
                    -1 * brightness(pixels[(y - 1) * width + (x - 1)]) +
                    1 * brightness(pixels[(y - 1) * width + (x + 1)]) +
                    -2 * brightness(pixels[y * width + (x - 1)]) +
                    2 * brightness(pixels[y * width + (x + 1)]) +
                    -1 * brightness(pixels[(y + 1) * width + (x - 1)]) +
                    1 * brightness(pixels[(y + 1) * width + (x + 1)])
                )

                val gy = (
                    -1 * brightness(pixels[(y - 1) * width + (x - 1)]) +
                    -2 * brightness(pixels[(y - 1) * width + x]) +
                    -1 * brightness(pixels[(y - 1) * width + (x + 1)]) +
                    1 * brightness(pixels[(y + 1) * width + (x - 1)]) +
                    2 * brightness(pixels[(y + 1) * width + x]) +
                    1 * brightness(pixels[(y + 1) * width + (x + 1)])
                )

                val magnitude = hypot(gx.toDouble(), gy.toDouble()).toInt()
                edges[y][x] = if (magnitude > 50) 255 else 0 // 阈值
            }
        }

        return edges
    }

    /**
     * 获取像素亮度
     */
    private fun brightness(color: Int): Int {
        val r = Color.red(color)
        val g = Color.green(color)
        val b = Color.blue(color)
        return (0.299 * r + 0.587 * g + 0.114 * b).toInt()
    }

    /**
     * 查找轮廓（简化版）
     */
    private fun findContours(edges: Array<IntArray>): List<List<PointF>> {
        val height = edges.size
        val width = edges[0].size
        val visited = Array(height) { BooleanArray(width) }
        val contours = mutableListOf<List<PointF>>()

        for (y in 0 until height) {
            for (x in 0 until width) {
                if (edges[y][x] == 255 && !visited[y][x]) {
                    val contour = mutableListOf<PointF>()
                    traceContour(edges, visited, x, y, contour)
                    if (contour.size > 50) { // 过滤小轮廓
                        contours.add(contour)
                    }
                }
            }
        }

        return contours
    }

    /**
     * 追踪轮廓
     */
    private fun traceContour(
        edges: Array<IntArray>,
        visited: Array<BooleanArray>,
        startX: Int,
        startY: Int,
        contour: MutableList<PointF>
    ) {
        val stack = mutableListOf(Pair(startX, startY))

        while (stack.isNotEmpty()) {
            val (x, y) = stack.removeAt(stack.size - 1)

            if (x < 0 || x >= edges[0].size || y < 0 || y >= edges.size) continue
            if (visited[y][x] || edges[y][x] != 255) continue

            visited[y][x] = true
            contour.add(PointF(x.toFloat(), y.toFloat()))

            // 8 连通
            for (dy in -1..1) {
                for (dx in -1..1) {
                    if (dx != 0 || dy != 0) {
                        stack.add(Pair(x + dx, y + dy))
                    }
                }
            }
        }
    }

    /**
     * 找到最大的四边形轮廓
     */
    private fun findLargestQuadrilateral(
        contours: List<List<PointF>>,
        width: Int,
        height: Int
    ): Array<PointF>? {
        if (contours.isEmpty()) return null

        // 找到面积最大的轮廓
        val largestContour = contours.maxByOrNull { it.size } ?: return null

        // 使用 Douglas-Peucker 算法简化轮廓
        val simplified = douglasPeucker(largestContour, 20.0)

        // 如果简化后是四边形，直接返回
        if (simplified.size == 4) {
            return orderPoints(simplified.toTypedArray())
        }

        // 否则，找到轮廓的四个极值点
        val topLeft = largestContour.minByOrNull { it.x + it.y } ?: PointF(0f, 0f)
        val topRight = largestContour.maxByOrNull { it.x - it.y } ?: PointF(width.toFloat(), 0f)
        val bottomRight = largestContour.maxByOrNull { it.x + it.y } ?: PointF(width.toFloat(), height.toFloat())
        val bottomLeft = largestContour.minByOrNull { it.x - it.y } ?: PointF(0f, height.toFloat())

        return arrayOf(topLeft, topRight, bottomRight, bottomLeft)
    }

    /**
     * Douglas-Peucker 算法简化轮廓
     */
    private fun douglasPeucker(points: List<PointF>, epsilon: Double): List<PointF> {
        if (points.size < 3) return points

        var maxDist = 0.0
        var maxIndex = 0

        val start = points.first()
        val end = points.last()

        for (i in 1 until points.size - 1) {
            val dist = perpendicularDistance(points[i], start, end)
            if (dist > maxDist) {
                maxDist = dist
                maxIndex = i
            }
        }

        return if (maxDist > epsilon) {
            val left = douglasPeucker(points.subList(0, maxIndex + 1), epsilon)
            val right = douglasPeucker(points.subList(maxIndex, points.size), epsilon)
            left.dropLast(1) + right
        } else {
            listOf(start, end)
        }
    }

    /**
     * 计算点到直线的垂直距离
     */
    private fun perpendicularDistance(point: PointF, lineStart: PointF, lineEnd: PointF): Double {
        val dx = lineEnd.x - lineStart.x
        val dy = lineEnd.y - lineStart.y

        val numerator = abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x)
        val denominator = hypot(dx.toDouble(), dy.toDouble())

        return numerator / denominator
    }

    /**
     * 按顺序排列四个角点 [左上, 右上, 右下, 左下]
     */
    private fun orderPoints(points: Array<PointF>): Array<PointF> {
        // 按 x + y 排序，找到左上和右下
        val sorted = points.sortedBy { it.x + it.y }
        val topLeft = sorted[0]
        val bottomRight = sorted[3]

        // 按 x - y 排序，找到右上和左下
        val sorted2 = points.sortedBy { it.x - it.y }
        val topRight = sorted2[3]
        val bottomLeft = sorted2[0]

        return arrayOf(topLeft, topRight, bottomRight, bottomLeft)
    }

    /**
     * 图像预处理（降噪 + 对比度增强）
     */
    private fun preprocessImage(bitmap: Bitmap): Bitmap {
        // 1. 转换为灰度图
        var result = toGrayscale(bitmap)

        // 2. 高斯模糊降噪
        result = gaussianBlur(result, 3)

        // 3. 对比度增强（CLAHE 简化版）
        result = enhanceContrast(result)

        return result
    }

    /**
     * 高斯模糊（简化版，用于降噪）
     */
    private fun gaussianBlur(bitmap: Bitmap, radius: Int): Bitmap {
        val width = bitmap.width
        val height = bitmap.height
        val result = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)

        val pixels = IntArray(width * height)
        bitmap.getPixels(pixels, 0, width, 0, 0, width, height)

        // 简化的高斯核（3x3）
        val kernel = arrayOf(
            intArrayOf(1, 2, 1),
            intArrayOf(2, 4, 2),
            intArrayOf(1, 2, 1)
        )
        val kernelSum = 16

        val blurred = IntArray(width * height)

        for (y in radius until height - radius) {
            for (x in radius until width - radius) {
                var sum = 0
                for (ky in -radius..radius) {
                    for (kx in -radius..radius) {
                        val pixel = pixels[(y + ky) * width + (x + kx)]
                        val weight = kernel[ky + radius][kx + radius]
                        sum += brightness(pixel) * weight
                    }
                }
                val value = sum / kernelSum
                blurred[y * width + x] = Color.rgb(value, value, value)
            }
        }

        result.setPixels(blurred, 0, width, 0, 0, width, height)
        return result
    }

    /**
     * 对比度增强（直方图均衡化简化版）
     */
    private fun enhanceContrast(bitmap: Bitmap): Bitmap {
        val width = bitmap.width
        val height = bitmap.height
        val result = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)

        val pixels = IntArray(width * height)
        bitmap.getPixels(pixels, 0, width, 0, 0, width, height)

        // 计算直方图
        val histogram = IntArray(256)
        for (pixel in pixels) {
            histogram[brightness(pixel)]++
        }

        // 计算累积分布函数
        val cdf = IntArray(256)
        cdf[0] = histogram[0]
        for (i in 1..255) {
            cdf[i] = cdf[i - 1] + histogram[i]
        }

        // 归一化
        val cdfMin = cdf.firstOrNull { it > 0 } ?: 0
        val totalPixels = width * height
        val enhanced = IntArray(width * height)

        for (i in pixels.indices) {
            val oldValue = brightness(pixels[i])
            val newValue = ((cdf[oldValue] - cdfMin).toFloat() / (totalPixels - cdfMin) * 255).toInt()
            enhanced[i] = Color.rgb(newValue, newValue, newValue)
        }

        result.setPixels(enhanced, 0, width, 0, 0, width, height)
        return result
    }

    /**
     * 自适应边缘检测（根据图片特征动态调整阈值）
     */
    private fun detectEdgesAdaptive(bitmap: Bitmap): Array<IntArray> {
        val width = bitmap.width
        val height = bitmap.height
        val pixels = IntArray(width * height)
        bitmap.getPixels(pixels, 0, width, 0, 0, width, height)

        val edges = Array(height) { IntArray(width) }
        val gradients = mutableListOf<Int>()

        // Sobel 算子计算梯度
        for (y in 1 until height - 1) {
            for (x in 1 until width - 1) {
                val gx = (
                    -1 * brightness(pixels[(y - 1) * width + (x - 1)]) +
                    1 * brightness(pixels[(y - 1) * width + (x + 1)]) +
                    -2 * brightness(pixels[y * width + (x - 1)]) +
                    2 * brightness(pixels[y * width + (x + 1)]) +
                    -1 * brightness(pixels[(y + 1) * width + (x - 1)]) +
                    1 * brightness(pixels[(y + 1) * width + (x + 1)])
                )

                val gy = (
                    -1 * brightness(pixels[(y - 1) * width + (x - 1)]) +
                    -2 * brightness(pixels[(y - 1) * width + x]) +
                    -1 * brightness(pixels[(y - 1) * width + (x + 1)]) +
                    1 * brightness(pixels[(y + 1) * width + (x - 1)]) +
                    2 * brightness(pixels[(y + 1) * width + x]) +
                    1 * brightness(pixels[(y + 1) * width + (x + 1)])
                )

                val magnitude = hypot(gx.toDouble(), gy.toDouble()).toInt()
                gradients.add(magnitude)
                edges[y][x] = magnitude
            }
        }

        // 自适应阈值（使用梯度的中位数）
        gradients.sort()
        val threshold = if (gradients.isNotEmpty()) {
            gradients[gradients.size * 3 / 4] // 75% 分位数
        } else {
            50
        }

        Log.d(TAG, "自适应阈值: $threshold")

        // 应用阈值
        for (y in 0 until height) {
            for (x in 0 until width) {
                edges[y][x] = if (edges[y][x] > threshold) 255 else 0
            }
        }

        return edges
    }

    /**
     * 计算检测置信度
     */
    private fun calculateConfidence(corners: Array<PointF>?, width: Int, height: Int): Float {
        if (corners == null || corners.size != 4) return 0f

        var confidence = 1.0f

        // 1. 检查四边形面积（应该占图片的合理比例）
        val area = calculateQuadrilateralArea(corners)
        val imageArea = width * height
        val areaRatio = area / imageArea

        if (areaRatio < 0.1) {
            confidence *= 0.3f // 面积太小
        } else if (areaRatio < 0.3) {
            confidence *= 0.7f
        } else if (areaRatio > 0.95) {
            confidence *= 0.8f // 面积太大，可能是整个图片
        }

        // 2. 检查四边形是否接近矩形
        val angles = calculateAngles(corners)
        val angleDeviation = angles.map { abs(it - 90) }.average()

        if (angleDeviation > 30) {
            confidence *= 0.5f // 角度偏差太大
        } else if (angleDeviation > 15) {
            confidence *= 0.8f
        }

        // 3. 检查边长比例（长宽比应该合理）
        val aspectRatio = calculateAspectRatio(corners)
        if (aspectRatio > 3 || aspectRatio < 0.3) {
            confidence *= 0.7f // 长宽比不合理
        }

        return confidence.coerceIn(0f, 1f)
    }

    /**
     * 计算四边形面积
     */
    private fun calculateQuadrilateralArea(corners: Array<PointF>): Float {
        // 使用鞋带公式
        var area = 0f
        for (i in corners.indices) {
            val j = (i + 1) % corners.size
            area += corners[i].x * corners[j].y
            area -= corners[j].x * corners[i].y
        }
        return abs(area) / 2f
    }

    /**
     * 计算四边形的四个角度
     */
    private fun calculateAngles(corners: Array<PointF>): List<Float> {
        val angles = mutableListOf<Float>()
        for (i in corners.indices) {
            val prev = corners[(i - 1 + 4) % 4]
            val curr = corners[i]
            val next = corners[(i + 1) % 4]

            val v1x = prev.x - curr.x
            val v1y = prev.y - curr.y
            val v2x = next.x - curr.x
            val v2y = next.y - curr.y

            val dot = v1x * v2x + v1y * v2y
            val cross = v1x * v2y - v1y * v2x

            val angle = Math.toDegrees(atan2(cross.toDouble(), dot.toDouble())).toFloat()
            angles.add(abs(angle))
        }
        return angles
    }

    /**
     * 计算长宽比
     */
    private fun calculateAspectRatio(corners: Array<PointF>): Float {
        val width1 = hypot((corners[1].x - corners[0].x).toDouble(), (corners[1].y - corners[0].y).toDouble())
        val width2 = hypot((corners[2].x - corners[3].x).toDouble(), (corners[2].y - corners[3].y).toDouble())
        val height1 = hypot((corners[3].x - corners[0].x).toDouble(), (corners[3].y - corners[0].y).toDouble())
        val height2 = hypot((corners[2].x - corners[1].x).toDouble(), (corners[2].y - corners[1].y).toDouble())

        val avgWidth = (width1 + width2) / 2
        val avgHeight = (height1 + height2) / 2

        return (max(avgWidth, avgHeight) / min(avgWidth, avgHeight)).toFloat()
    }
}
