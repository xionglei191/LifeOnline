package com.lingguang.catcher.data.local

import android.content.Context
import android.content.SharedPreferences

/**
 * 应用配置管理
 * 统一管理所有配置项，支持运行时修改
 */
class AppSettings private constructor(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    // ==================== AI 配置 ====================

    /** AI 服务类型 */
    var aiServiceType: AIServiceType
        get() = AIServiceType.valueOf(prefs.getString(KEY_AI_SERVICE_TYPE, AIServiceType.DASHSCOPE.name) ?: AIServiceType.DASHSCOPE.name)
        set(value) = prefs.edit().putString(KEY_AI_SERVICE_TYPE, value.name).apply()

    /** DashScope API Key */
    var dashscopeApiKey: String
        get() = prefs.getString(KEY_DASHSCOPE_API_KEY, "") ?: ""
        set(value) = prefs.edit().putString(KEY_DASHSCOPE_API_KEY, value).apply()

    /** DashScope 模型 */
    var dashscopeModel: String
        get() = prefs.getString(KEY_DASHSCOPE_MODEL, "qwen-plus") ?: "qwen-plus"
        set(value) = prefs.edit().putString(KEY_DASHSCOPE_MODEL, value).apply()

    /** OpenAI API Key */
    var openaiApiKey: String
        get() = prefs.getString(KEY_OPENAI_API_KEY, "") ?: ""
        set(value) = prefs.edit().putString(KEY_OPENAI_API_KEY, value).apply()

    /** OpenAI Base URL */
    var openaiBaseUrl: String
        get() = prefs.getString(KEY_OPENAI_BASE_URL, "https://api.openai.com/v1") ?: "https://api.openai.com/v1"
        set(value) = prefs.edit().putString(KEY_OPENAI_BASE_URL, value).apply()

    /** OpenAI 模型 */
    var openaiModel: String
        get() = prefs.getString(KEY_OPENAI_MODEL, "gpt-4o") ?: "gpt-4o"
        set(value) = prefs.edit().putString(KEY_OPENAI_MODEL, value).apply()

    /** Gemini API Key */
    var geminiApiKey: String
        get() = prefs.getString(KEY_GEMINI_API_KEY, "") ?: ""
        set(value) = prefs.edit().putString(KEY_GEMINI_API_KEY, value).apply()

    /** Gemini 模型 */
    var geminiModel: String
        get() = prefs.getString(KEY_GEMINI_MODEL, "gemini-2.0-flash-exp") ?: "gemini-2.0-flash-exp"
        set(value) = prefs.edit().putString(KEY_GEMINI_MODEL, value).apply()

    // ==================== STT 配置 ====================

    /** STT 服务类型 */
    var sttServiceType: STTServiceType
        get() = STTServiceType.valueOf(prefs.getString(KEY_STT_SERVICE_TYPE, STTServiceType.GEMINI.name) ?: STTServiceType.GEMINI.name)
        set(value) = prefs.edit().putString(KEY_STT_SERVICE_TYPE, value.name).apply()

    // ==================== R2 配置 ====================

    /** R2 Account ID */
    var r2AccountId: String
        get() = prefs.getString(KEY_R2_ACCOUNT_ID, "") ?: ""
        set(value) = prefs.edit().putString(KEY_R2_ACCOUNT_ID, value).apply()

    /** R2 Access Key ID */
    var r2AccessKeyId: String
        get() = prefs.getString(KEY_R2_ACCESS_KEY_ID, "") ?: ""
        set(value) = prefs.edit().putString(KEY_R2_ACCESS_KEY_ID, value).apply()

    /** R2 Secret Access Key */
    var r2SecretAccessKey: String
        get() = prefs.getString(KEY_R2_SECRET_ACCESS_KEY, "") ?: ""
        set(value) = prefs.edit().putString(KEY_R2_SECRET_ACCESS_KEY, value).apply()

    /** R2 Bucket Name */
    var r2BucketName: String
        get() = prefs.getString(KEY_R2_BUCKET_NAME, "") ?: ""
        set(value) = prefs.edit().putString(KEY_R2_BUCKET_NAME, value).apply()

    /** R2 Public Domain */
    var r2PublicDomain: String
        get() = prefs.getString(KEY_R2_PUBLIC_DOMAIN, "") ?: ""
        set(value) = prefs.edit().putString(KEY_R2_PUBLIC_DOMAIN, value).apply()

    // ==================== Obsidian 配置 ====================

    /** 默认文件夹 */
    var defaultFolder: String
        get() = prefs.getString(KEY_DEFAULT_FOLDER, "_Inbox") ?: "_Inbox"
        set(value) = prefs.edit().putString(KEY_DEFAULT_FOLDER, value).apply()

    /** 文件命名格式 */
    var filenameFormat: String
        get() = prefs.getString(KEY_FILENAME_FORMAT, "yyyyMMdd_HHmmss") ?: "yyyyMMdd_HHmmss"
        set(value) = prefs.edit().putString(KEY_FILENAME_FORMAT, value).apply()

    // ==================== LifeOS API 配置 ====================

    /** LifeOS API URL */
    var lifeosUrl: String
        get() = prefs.getString(KEY_LIFEOS_URL, "http://192.168.31.252:3000") ?: "http://192.168.31.252:3000"
        set(value) = prefs.edit().putString(KEY_LIFEOS_URL, value).apply()

    // ==================== 应用配置 ====================

    /** 默认笔记类型 */
    var defaultNoteType: String
        get() = prefs.getString(KEY_DEFAULT_NOTE_TYPE, "INSPIRATION") ?: "INSPIRATION"
        set(value) = prefs.edit().putString(KEY_DEFAULT_NOTE_TYPE, value).apply()

    /** 自动清理语音文本 */
    var autoCleanVoiceText: Boolean
        get() = prefs.getBoolean(KEY_AUTO_CLEAN_VOICE_TEXT, true)
        set(value) = prefs.edit().putBoolean(KEY_AUTO_CLEAN_VOICE_TEXT, value).apply()

    /** 智能推荐标签 */
    var smartTagRecommendation: Boolean
        get() = prefs.getBoolean(KEY_SMART_TAG_RECOMMENDATION, true)
        set(value) = prefs.edit().putBoolean(KEY_SMART_TAG_RECOMMENDATION, value).apply()

    // ==================== 图片配置 ====================

    /** 图片质量 (1-100) */
    var imageQuality: Int
        get() = prefs.getInt(KEY_IMAGE_QUALITY, 85)
        set(value) = prefs.edit().putInt(KEY_IMAGE_QUALITY, value.coerceIn(1, 100)).apply()

    /** 自动边缘检测 */
    var autoEdgeDetection: Boolean
        get() = prefs.getBoolean(KEY_AUTO_EDGE_DETECTION, true)
        set(value) = prefs.edit().putBoolean(KEY_AUTO_EDGE_DETECTION, value).apply()

    /** 边缘检测置信度阈值 (0.0-1.0) */
    var edgeDetectionThreshold: Float
        get() = prefs.getFloat(KEY_EDGE_DETECTION_THRESHOLD, 0.7f)
        set(value) = prefs.edit().putFloat(KEY_EDGE_DETECTION_THRESHOLD, value.coerceIn(0f, 1f)).apply()

    // ==================== 离线队列配置 ====================

    /** 自动重试 */
    var autoRetry: Boolean
        get() = prefs.getBoolean(KEY_AUTO_RETRY, true)
        set(value) = prefs.edit().putBoolean(KEY_AUTO_RETRY, value).apply()

    /** 最大重试次数 */
    var maxRetryCount: Int
        get() = prefs.getInt(KEY_MAX_RETRY_COUNT, 3)
        set(value) = prefs.edit().putInt(KEY_MAX_RETRY_COUNT, value.coerceIn(1, 10)).apply()

    /** 仅 WiFi 同步 */
    var wifiOnlySync: Boolean
        get() = prefs.getBoolean(KEY_WIFI_ONLY_SYNC, false)
        set(value) = prefs.edit().putBoolean(KEY_WIFI_ONLY_SYNC, value).apply()

    // ==================== 自动化配置 ====================

    /** 全局自动化总开关 */
    var autoGlobalEnabled: Boolean
        get() = prefs.getBoolean(KEY_AUTO_GLOBAL_ENABLED, true)
        set(value) = prefs.edit().putBoolean(KEY_AUTO_GLOBAL_ENABLED, value).apply()

    /** 日期日程自动同步开关 */
    var autoCalendarEnabled: Boolean
        get() = prefs.getBoolean(KEY_AUTO_CALENDAR_ENABLED, true)
        set(value) = prefs.edit().putBoolean(KEY_AUTO_CALENDAR_ENABLED, value).apply()

    /** 邮件通信自动执行开关 */
    var autoCommunicationEnabled: Boolean
        get() = prefs.getBoolean(KEY_AUTO_COMMUNICATION_ENABLED, true)
        set(value) = prefs.edit().putBoolean(KEY_AUTO_COMMUNICATION_ENABLED, value).apply()

    // ==================== 辅助方法 ====================

    /** 检查 AI 配置是否完整 */
    fun isAIConfigured(): Boolean {
        return when (aiServiceType) {
            AIServiceType.DASHSCOPE -> dashscopeApiKey.isNotEmpty()
            AIServiceType.OPENAI -> openaiApiKey.isNotEmpty()
            AIServiceType.GEMINI -> geminiApiKey.isNotEmpty()
            AIServiceType.MOCK -> true
        }
    }

    /** 检查 STT 配置是否完整 */
    fun isSTTConfigured(): Boolean {
        return when (sttServiceType) {
            STTServiceType.GEMINI -> geminiApiKey.isNotEmpty()
            STTServiceType.OPENAI_WHISPER -> openaiApiKey.isNotEmpty()
            STTServiceType.DASHSCOPE -> dashscopeApiKey.isNotEmpty() && r2AccountId.isNotEmpty()
        }
    }

    /** 检查 R2 配置是否完整 */
    fun isR2Configured(): Boolean {
        return r2AccountId.isNotEmpty() &&
                r2AccessKeyId.isNotEmpty() &&
                r2SecretAccessKey.isNotEmpty() &&
                r2BucketName.isNotEmpty() &&
                r2PublicDomain.isNotEmpty()
    }

    /** 重置所有配置 */
    fun resetAll() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val PREFS_NAME = "lingguang_settings"

        // AI 配置
        private const val KEY_AI_SERVICE_TYPE = "ai_service_type"
        private const val KEY_DASHSCOPE_API_KEY = "dashscope_api_key"
        private const val KEY_DASHSCOPE_MODEL = "dashscope_model"
        private const val KEY_OPENAI_API_KEY = "openai_api_key"
        private const val KEY_OPENAI_BASE_URL = "openai_base_url"
        private const val KEY_OPENAI_MODEL = "openai_model"
        private const val KEY_GEMINI_API_KEY = "gemini_api_key"
        private const val KEY_GEMINI_MODEL = "gemini_model"

        // STT 配置
        private const val KEY_STT_SERVICE_TYPE = "stt_service_type"

        // R2 配置
        private const val KEY_R2_ACCOUNT_ID = "r2_account_id"
        private const val KEY_R2_ACCESS_KEY_ID = "r2_access_key_id"
        private const val KEY_R2_SECRET_ACCESS_KEY = "r2_secret_access_key"
        private const val KEY_R2_BUCKET_NAME = "r2_bucket_name"
        private const val KEY_R2_PUBLIC_DOMAIN = "r2_public_domain"

        // Obsidian 配置
        private const val KEY_DEFAULT_FOLDER = "default_folder"
        private const val KEY_FILENAME_FORMAT = "filename_format"

        // LifeOS 配置
        private const val KEY_LIFEOS_URL = "lifeos_url"

        // 应用配置
        private const val KEY_DEFAULT_NOTE_TYPE = "default_note_type"
        private const val KEY_AUTO_CLEAN_VOICE_TEXT = "auto_clean_voice_text"
        private const val KEY_SMART_TAG_RECOMMENDATION = "smart_tag_recommendation"

        // 图片配置
        private const val KEY_IMAGE_QUALITY = "image_quality"
        private const val KEY_AUTO_EDGE_DETECTION = "auto_edge_detection"
        private const val KEY_EDGE_DETECTION_THRESHOLD = "edge_detection_threshold"

        // 离线队列配置
        private const val KEY_AUTO_RETRY = "auto_retry"
        private const val KEY_MAX_RETRY_COUNT = "max_retry_count"
        private const val KEY_WIFI_ONLY_SYNC = "wifi_only_sync"

        // 自动化配置
        private const val KEY_AUTO_GLOBAL_ENABLED = "auto_global_enabled"
        private const val KEY_AUTO_CALENDAR_ENABLED = "auto_calendar_enabled"
        private const val KEY_AUTO_COMMUNICATION_ENABLED = "auto_communication_enabled"

        @Volatile
        private var instance: AppSettings? = null

        fun getInstance(context: Context): AppSettings {
            return instance ?: synchronized(this) {
                instance ?: AppSettings(context.applicationContext).also { instance = it }
            }
        }
    }
}

/** AI 服务类型 */
enum class AIServiceType {
    DASHSCOPE,
    OPENAI,
    GEMINI,
    MOCK
}

/** STT 服务类型 */
enum class STTServiceType {
    GEMINI,
    OPENAI_WHISPER,
    DASHSCOPE
}
