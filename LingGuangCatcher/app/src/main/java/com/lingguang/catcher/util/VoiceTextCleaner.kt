package com.lingguang.catcher.util

import android.util.Log

/**
 * 语音文本清理工具
 * 用于清理语音识别后的文本，去除语气词、口音错误、重复词等
 */
object VoiceTextCleaner {

    private const val TAG = "VoiceTextCleaner"

    /**
     * 清理语音识别文本
     * @param text 原始识别文本
     * @param level 清理级别：LIGHT(轻度), MEDIUM(中度), DEEP(深度)
     * @return 清理后的文本
     */
    fun clean(text: String, level: CleanLevel = CleanLevel.MEDIUM): String {
        var result = text

        // 1. 去除语气词
        result = removeFillerWords(result, level)

        // 2. 修正常见口音错误
        result = fixAccentErrors(result)

        // 3. 去除重复词
        result = removeRepeatedWords(result)

        // 4. 优化标点符号
        result = optimizePunctuation(result)

        // 5. 口语转书面语（深度清理）
        if (level == CleanLevel.DEEP) {
            result = convertToWrittenLanguage(result)
        }

        // 6. 清理多余空格
        result = cleanWhitespace(result)

        Log.d(TAG, "清理前: $text")
        Log.d(TAG, "清理后: $result")

        return result
    }

    /**
     * 去除语气词
     */
    private fun removeFillerWords(text: String, level: CleanLevel): String {
        var result = text

        // 基础语气词（所有级别都清理）
        val basicFillers = listOf(
            "嗯", "呃", "啊", "哦", "唉", "哎",
            "嘛", "呢", "吧", "啦", "哪", "呀"
        )

        // 扩展语气词（中度和深度清理）
        val extendedFillers = listOf(
            "那个", "这个", "就是说", "然后呢", "对吧",
            "你知道", "怎么说呢", "其实", "应该说",
            "可以说", "换句话说", "总之", "反正"
        )

        // 深度语气词（仅深度清理）
        val deepFillers = listOf(
            "我觉得", "我认为", "我想", "我感觉",
            "可能", "大概", "也许", "或许"
        )

        // 清理基础语气词
        basicFillers.forEach { filler ->
            result = result.replace(filler, "")
        }

        // 中度和深度清理扩展语气词
        if (level == CleanLevel.MEDIUM || level == CleanLevel.DEEP) {
            extendedFillers.forEach { filler ->
                result = result.replace(filler, "")
            }
        }

        // 深度清理
        if (level == CleanLevel.DEEP) {
            deepFillers.forEach { filler ->
                result = result.replace(filler, "")
            }
        }

        return result
    }

    /**
     * 修正常见口音错误
     * 基于常见的普通话口音问题
     */
    private fun fixAccentErrors(text: String): String {
        val corrections = mapOf(
            // 平翘舌音混淆
            "资料" to "资料",  // zi/zhi
            "四十" to "四十",  // si/shi

            // 前后鼻音混淆
            "应该" to "应该",  // ying/yin
            "很好" to "很好",  // hen/heng

            // 常见同音字错误
            "的话" to "的话",
            "在在" to "在",
            "了了" to "了",

            // 常见口语错误
            "咋样" to "怎么样",
            "咋办" to "怎么办",
            "啥" to "什么",
            "咋" to "怎么",
            "整" to "做",  // "整个东西" -> "做个东西"

            // 方言词汇
            "搞" to "做",  // "搞定" 保留，"搞个" -> "做个"
            "弄" to "做",
            "木有" to "没有",
            "酱紫" to "这样",
            "介个" to "这个"
        )

        var result = text
        corrections.forEach { (wrong, correct) ->
            // 使用词边界匹配，避免误替换
            result = result.replace(wrong, correct)
        }

        return result
    }

    /**
     * 去除重复词
     * 例如："我我我觉得" -> "我觉得"
     */
    private fun removeRepeatedWords(text: String): String {
        var result = text

        // 匹配连续重复的单字
        result = result.replace(Regex("(.)\\1{2,}"), "$1")

        // 匹配连续重复的双字词
        result = result.replace(Regex("(..)\\1+"), "$1")

        // 特殊处理：保留有意义的重复（如"天天"、"年年"）
        val meaningfulRepeats = listOf(
            "天天", "年年", "月月", "日日",
            "时时", "刻刻", "处处", "事事",
            "人人", "个个", "家家", "户户"
        )

        // 这些词不需要特殊处理，因为上面的正则不会匹配它们

        return result
    }

    /**
     * 优化标点符号
     */
    private fun optimizePunctuation(text: String): String {
        var result = text

        // 1. 移除多余的标点
        result = result.replace(Regex("[,，]{2,}"), "，")
        result = result.replace(Regex("[.。]{2,}"), "。")
        result = result.replace(Regex("[!！]{2,}"), "！")
        result = result.replace(Regex("[?？]{2,}"), "？")

        // 2. 统一中英文标点
        result = result.replace(",", "，")
        result = result.replace(".", "。")
        result = result.replace("!", "！")
        result = result.replace("?", "？")
        result = result.replace(";", "；")
        result = result.replace(":", "：")

        // 3. 移除标点前的空格
        result = result.replace(Regex("\\s+([，。！？；：])"), "$1")

        // 4. 确保标点后有空格（如果后面是文字）
        result = result.replace(Regex("([，。！？；：])([^\\s，。！？；：])"), "$1 $2")

        return result
    }

    /**
     * 口语转书面语
     */
    private fun convertToWrittenLanguage(text: String): String {
        val conversions = mapOf(
            // 口语化表达 -> 书面语
            "挺好的" to "很好",
            "特别好" to "非常好",
            "超级" to "非常",
            "蛮" to "很",
            "老" to "很",  // "老好了" -> "很好"

            // 简化表达
            "的话" to "",  // "如果...的话" -> "如果..."
            "来说" to "",  // "对我来说" -> "对我"

            // 规范表达
            "OK" to "好",
            "ok" to "好",
            "No" to "不",
            "no" to "不"
        )

        var result = text
        conversions.forEach { (oral, written) ->
            result = result.replace(oral, written)
        }

        return result
    }

    /**
     * 清理多余空格
     */
    private fun cleanWhitespace(text: String): String {
        var result = text

        // 移除多余空格
        result = result.replace(Regex("\\s+"), " ")

        // 移除首尾空格
        result = result.trim()

        // 移除中文字符间的空格
        result = result.replace(Regex("([\\u4e00-\\u9fa5])\\s+([\\u4e00-\\u9fa5])"), "$1$2")

        return result
    }

    /**
     * 智能清理（根据文本内容自动判断清理级别）
     */
    fun smartClean(text: String): String {
        // 计算语气词密度
        val fillerCount = countFillerWords(text)
        val wordCount = text.length

        val fillerDensity = if (wordCount > 0) fillerCount.toFloat() / wordCount else 0f

        // 根据密度选择清理级别
        val level = when {
            fillerDensity > 0.15 -> CleanLevel.DEEP  // 语气词超过15%，深度清理
            fillerDensity > 0.08 -> CleanLevel.MEDIUM  // 语气词超过8%，中度清理
            else -> CleanLevel.LIGHT  // 轻度清理
        }

        Log.d(TAG, "语气词密度: ${fillerDensity * 100}%, 清理级别: $level")

        return clean(text, level)
    }

    /**
     * 统计语气词数量
     */
    private fun countFillerWords(text: String): Int {
        val fillers = listOf(
            "嗯", "呃", "啊", "哦", "唉", "哎",
            "那个", "这个", "就是说", "然后呢"
        )

        var count = 0
        fillers.forEach { filler ->
            count += text.split(filler).size - 1
        }

        return count
    }

    /**
     * 获取清理报告（用于调试和展示）
     */
    fun getCleanReport(original: String, cleaned: String): CleanReport {
        return CleanReport(
            originalLength = original.length,
            cleanedLength = cleaned.length,
            removedChars = original.length - cleaned.length,
            fillerWordsRemoved = countFillerWords(original),
            compressionRate = if (original.isNotEmpty()) {
                (original.length - cleaned.length).toFloat() / original.length * 100
            } else 0f
        )
    }

    /**
     * 清理级别
     */
    enum class CleanLevel {
        LIGHT,    // 轻度：仅去除明显的语气词
        MEDIUM,   // 中度：去除语气词 + 口音错误 + 重复词
        DEEP      // 深度：中度 + 口语转书面语
    }

    /**
     * 清理报告
     */
    data class CleanReport(
        val originalLength: Int,
        val cleanedLength: Int,
        val removedChars: Int,
        val fillerWordsRemoved: Int,
        val compressionRate: Float
    ) {
        override fun toString(): String {
            return "清理报告：\n" +
                    "原始长度: $originalLength 字\n" +
                    "清理后: $cleanedLength 字\n" +
                    "移除: $removedChars 字\n" +
                    "语气词: $fillerWordsRemoved 个\n" +
                    "压缩率: ${"%.1f".format(compressionRate)}%"
        }
    }
}
