package com.lingguang.catcher.util

import android.content.Context
import android.widget.Toast
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.Build

/**
 * UI 反馈工具
 */
object FeedbackUtil {

    // 成功捕获的随机消息，保持新鲜感
    private val captureSuccessMessages = listOf(
        "灵光已捕获 ✨",
        "想法已入库 💡",
        "记下来了 👌",
        "捕获成功，继续闪光 🚀",
        "好主意，已保存 🎯",
        "灵感不会跑掉了 🔒"
    )

    private val brainstormSuccessMessages = listOf(
        "头脑风暴完成，思维已整理 🧠",
        "多段灵感已合并 ✨",
        "想法已汇聚成笔记 💫",
        "脑洞大开，已记录 🌊"
    )

    fun showToast(context: Context, message: String, duration: Int = Toast.LENGTH_SHORT) {
        Toast.makeText(context, message, duration).show()
    }

    /**
     * 轻触反馈（按钮点击）
     */
    fun vibrate(context: Context, durationMs: Long = 50) {
        val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        vibrator?.let {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                it.vibrate(VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                it.vibrate(durationMs)
            }
        }
    }

    /**
     * 成功双击反馈（轻-重，有节奏感）
     */
    fun vibrateSuccess(context: Context) {
        val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        vibrator?.let {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // 轻-停-重，像"完成"的节奏
                val pattern = longArrayOf(0, 40, 60, 80)
                val amplitudes = intArrayOf(0, 80, 0, 200)
                it.vibrate(VibrationEffect.createWaveform(pattern, amplitudes, -1))
            } else {
                @Suppress("DEPRECATION")
                it.vibrate(longArrayOf(0, 40, 60, 80), -1)
            }
        }
    }

    /**
     * 录音开始反馈（单次中等振动）
     */
    fun vibrateRecordStart(context: Context) {
        val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        vibrator?.let {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                it.vibrate(VibrationEffect.createOneShot(60, 180))
            } else {
                @Suppress("DEPRECATION")
                it.vibrate(60)
            }
        }
    }

    /**
     * 录音结束反馈（两次短振动）
     */
    fun vibrateRecordStop(context: Context) {
        val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        vibrator?.let {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val pattern = longArrayOf(0, 50, 50, 50)
                val amplitudes = intArrayOf(0, 150, 0, 150)
                it.vibrate(VibrationEffect.createWaveform(pattern, amplitudes, -1))
            } else {
                @Suppress("DEPRECATION")
                it.vibrate(longArrayOf(0, 50, 50, 50), -1)
            }
        }
    }

    /**
     * 成功捕获反馈（随机消息 + 节奏振动）
     */
    fun captureSuccess(context: Context) {
        showToast(context, captureSuccessMessages.random())
        vibrateSuccess(context)
    }

    /**
     * 头脑风暴完成反馈
     */
    fun brainstormSuccess(context: Context) {
        showToast(context, brainstormSuccessMessages.random())
        vibrateSuccess(context)
    }

    /**
     * 失败反馈
     */
    fun captureError(context: Context, error: String) {
        showToast(context, "捕获失败: $error", Toast.LENGTH_LONG)
        vibrate(context, 200)
    }
}
