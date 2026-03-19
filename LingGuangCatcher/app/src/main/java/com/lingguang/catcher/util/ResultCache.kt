package com.lingguang.catcher.util

/**
 * 简单的内存缓存，存储最近一次捕获的 Markdown 结果
 * MainActivity 在 onResume 时读取并展示
 */
object ResultCache {
    var latestMarkdown: String? = null
    var latestFilename: String? = null
}
