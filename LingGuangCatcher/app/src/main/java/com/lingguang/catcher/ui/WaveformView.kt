package com.lingguang.catcher.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.util.AttributeSet
import android.view.View
import com.lingguang.catcher.R

/**
 * 录音波形可视化 View
 * 使用 drawLines() 批量绘制，减少 JNI 调用次数
 */
class WaveformView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = context.getColor(R.color.md_theme_primary)
        strokeWidth = 4f
        strokeCap = Paint.Cap.ROUND
    }

    private val amplitudes = mutableListOf<Float>()
    private val maxAmplitudes = 100
    private var maxAmplitude = 1f

    // 预分配 lines 数组，避免每帧 GC（上下各一条线，每条线 4 个坐标）
    private var linesBuffer = FloatArray(maxAmplitudes * 8)

    fun addAmplitude(amplitude: Float) {
        amplitudes.add(amplitude.coerceIn(0f, 1f))
        if (amplitudes.size > maxAmplitudes) {
            amplitudes.removeAt(0)
        }
        // 增量更新 maxAmplitude，避免每次全量 maxOrNull()
        if (amplitude > maxAmplitude) {
            maxAmplitude = amplitude
        } else if (maxAmplitude > 0 && amplitudes.size == maxAmplitudes) {
            maxAmplitude = amplitudes.max()
        }
        invalidate()
    }

    fun clear() {
        amplitudes.clear()
        maxAmplitude = 1f
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (amplitudes.isEmpty()) return

        val w = width.toFloat()
        val h = height.toFloat()
        val centerY = h / 2
        val barWidth = w / maxAmplitudes
        val maxBarHeight = centerY * 0.8f
        val invMax = if (maxAmplitude > 0) 1f / maxAmplitude else 0f

        val count = amplitudes.size
        var i = 0
        amplitudes.forEach { amplitude ->
            val x = i * barWidth + barWidth / 2
            val barHeight = amplitude * invMax * maxBarHeight
            val base = i * 8
            // 上半线
            linesBuffer[base]     = x
            linesBuffer[base + 1] = centerY
            linesBuffer[base + 2] = x
            linesBuffer[base + 3] = centerY - barHeight
            // 下半线（镜像）
            linesBuffer[base + 4] = x
            linesBuffer[base + 5] = centerY
            linesBuffer[base + 6] = x
            linesBuffer[base + 7] = centerY + barHeight
            i++
        }
        canvas.drawLines(linesBuffer, 0, count * 8, paint)
    }
}
