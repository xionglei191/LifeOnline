package com.lingguang.catcher.data.model

/**
 * 语音笔记类型
 */
enum class VoiceNoteType(
    val label: String,
    val icon: String,
    val tag: String,
    val description: String,
    val lifeosType: String,
    val lifeosDimension: String
) {
    INSPIRATION(
        label = "灵感",
        icon = "💡",
        tag = "灵感",
        description = "突然的想法、创意火花",
        lifeosType = "note",
        lifeosDimension = "_inbox"
    ),
    TASK(
        label = "任务",
        icon = "📝",
        tag = "任务",
        description = "需要执行的事项",
        lifeosType = "task",
        lifeosDimension = "_inbox"
    ),
    SCHEDULE(
        label = "日程",
        icon = "📅",
        tag = "日程",
        description = "时间相关的安排",
        lifeosType = "schedule",
        lifeosDimension = "_inbox"
    ),
    LEARNING(
        label = "学习",
        icon = "📚",
        tag = "学习",
        description = "知识点、概念、笔记",
        lifeosType = "note",
        lifeosDimension = "_inbox"
    ),
    THOUGHT(
        label = "随想",
        icon = "💭",
        tag = "随想",
        description = "日常思考、感悟",
        lifeosType = "note",
        lifeosDimension = "_inbox"
    ),
    EXCERPT(
        label = "摘录",
        icon = "🔖",
        tag = "摘录",
        description = "书籍、文章的精彩片段",
        lifeosType = "note",
        lifeosDimension = "_inbox"
    ),
    GOAL(
        label = "目标",
        icon = "🎯",
        tag = "目标",
        description = "长期目标、计划",
        lifeosType = "milestone",
        lifeosDimension = "_inbox"
    ),
    QUESTION(
        label = "问题",
        icon = "❓",
        tag = "问题",
        description = "待解决的疑问",
        lifeosType = "note",
        lifeosDimension = "_inbox"
    ),
    CONTACT(
        label = "人脉",
        icon = "🤝",
        tag = "人脉",
        description = "人际交往、联系人信息",
        lifeosType = "record",
        lifeosDimension = "_inbox"
    ),
    LIFE(
        label = "生活",
        icon = "🏠",
        tag = "生活",
        description = "日常生活、家庭琐事",
        lifeosType = "record",
        lifeosDimension = "_inbox"
    ),
    WORK(
        label = "工作",
        icon = "💼",
        tag = "工作",
        description = "工作相关、职场记录",
        lifeosType = "record",
        lifeosDimension = "_inbox"
    ),
    BRAINSTORM(
        label = "头脑风暴",
        icon = "🧠",
        tag = "头脑风暴",
        description = "多段录音，汇总为结构化笔记",
        lifeosType = "note",
        lifeosDimension = "_inbox"
    );

    /**
     * 获取显示文本（图标 + 标签）
     */
    fun getDisplayText(): String = "$icon $label"

    companion object {
        /**
         * 根据标签获取类型
         */
        fun fromTag(tag: String): VoiceNoteType? {
            return values().find { it.tag == tag }
        }

        /**
         * 获取默认类型
         */
        fun getDefault(): VoiceNoteType = INSPIRATION
    }
}
