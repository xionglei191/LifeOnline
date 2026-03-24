package com.lingguang.catcher.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.lingguang.catcher.R
import com.lingguang.catcher.data.local.AIServiceType
import com.lingguang.catcher.data.local.AppSettings
import com.lingguang.catcher.data.local.STTServiceType
import com.lingguang.catcher.data.repository.ObsidianRepository
import com.lingguang.catcher.databinding.ActivitySettingsBinding
import com.lingguang.catcher.util.AnimUtil
import com.lingguang.catcher.util.FeedbackUtil

class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding
    private lateinit var settings: AppSettings
    private lateinit var obsidianRepo: ObsidianRepository

    private val vaultPicker = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        if (uri != null) {
            obsidianRepo.saveVaultUri(uri)
            updateVaultPathDisplay()
            FeedbackUtil.showToast(this, "✅ Vault 目录已更新")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        settings = AppSettings.getInstance(this)
        obsidianRepo = ObsidianRepository(this)

        setupToolbar()
        loadSettings()
        setupListeners()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener {
            finish()
        }
    }

    private fun loadSettings() {
        // API Key 配置
        binding.etDashscopeKey.setText(settings.dashscopeApiKey)
        binding.etDashscopeModel.setText(settings.dashscopeModel)
        binding.etOpenaiKey.setText(settings.openaiApiKey)
        binding.etOpenaiBaseUrl.setText(settings.openaiBaseUrl)
        binding.etOpenaiModel.setText(settings.openaiModel)
        binding.etGeminiKey.setText(settings.geminiApiKey)
        binding.etGeminiModel.setText(settings.geminiModel)

        // STT 服务类型
        when (settings.sttServiceType) {
            STTServiceType.GEMINI -> binding.toggleSttService.check(R.id.btn_stt_gemini)
            STTServiceType.OPENAI_WHISPER -> binding.toggleSttService.check(R.id.btn_stt_whisper)
            STTServiceType.DASHSCOPE -> binding.toggleSttService.check(R.id.btn_stt_dashscope)
        }

        // AI 服务类型
        when (settings.aiServiceType) {
            AIServiceType.DASHSCOPE -> binding.toggleAiService.check(R.id.btn_ai_dashscope)
            AIServiceType.OPENAI -> binding.toggleAiService.check(R.id.btn_ai_openai)
            AIServiceType.GEMINI -> binding.toggleAiService.check(R.id.btn_ai_gemini)
            AIServiceType.MOCK -> binding.toggleAiService.check(R.id.btn_ai_dashscope)
        }

        // Obsidian 配置
        updateVaultPathDisplay()
        binding.etFilenameFormat.setText(settings.filenameFormat)

        // LifeOS 配置
        binding.etLifeosUrl.setText(settings.lifeosUrl)

        // 应用配置
        binding.switchAutoClean.isChecked = settings.autoCleanVoiceText
        binding.switchSmartTag.isChecked = settings.smartTagRecommendation

        // 图片配置
        binding.sliderImageQuality.value = settings.imageQuality.toFloat()
        binding.tvImageQuality.text = settings.imageQuality.toString()
        binding.switchAutoEdge.isChecked = settings.autoEdgeDetection
        binding.sliderEdgeThreshold.value = settings.edgeDetectionThreshold
        binding.tvEdgeThreshold.text = String.format("%.2f", settings.edgeDetectionThreshold)

        // 离线队列配置
        binding.switchAutoRetry.isChecked = settings.autoRetry
        binding.switchWifiOnly.isChecked = settings.wifiOnlySync

        // 更新状态
        updateSTTStatus()
        updateAIStatus()
    }

    private fun setupListeners() {
        // 图片质量滑块
        binding.sliderImageQuality.addOnChangeListener { _, value, _ ->
            binding.tvImageQuality.text = value.toInt().toString()
        }

        // 边缘检测阈值滑块
        binding.sliderEdgeThreshold.addOnChangeListener { _, value, _ ->
            binding.tvEdgeThreshold.text = String.format("%.2f", value)
        }

        // 选择 Vault 目录
        binding.btnSelectVault.setOnClickListener {
            vaultPicker.launch(null)
        }

        // 查看日志按钮
        binding.btnViewLogs.setOnClickListener {
            startActivity(Intent(this, CrashLogActivity::class.java))
        }

        // 保存按钮
        binding.btnSave.setOnClickListener {
            saveSettings()
        }
    }

    private fun saveSettings() {
        // API Key 配置
        settings.dashscopeApiKey = binding.etDashscopeKey.text.toString()
        settings.dashscopeModel = binding.etDashscopeModel.text.toString()
        settings.openaiApiKey = binding.etOpenaiKey.text.toString()
        settings.openaiBaseUrl = binding.etOpenaiBaseUrl.text.toString()
        settings.openaiModel = binding.etOpenaiModel.text.toString()
        settings.geminiApiKey = binding.etGeminiKey.text.toString()
        settings.geminiModel = binding.etGeminiModel.text.toString()

        // STT 服务类型
        settings.sttServiceType = when (binding.toggleSttService.checkedButtonId) {
            R.id.btn_stt_gemini -> STTServiceType.GEMINI
            R.id.btn_stt_whisper -> STTServiceType.OPENAI_WHISPER
            R.id.btn_stt_dashscope -> STTServiceType.DASHSCOPE
            else -> STTServiceType.GEMINI
        }

        // AI 服务类型
        settings.aiServiceType = when (binding.toggleAiService.checkedButtonId) {
            R.id.btn_ai_dashscope -> AIServiceType.DASHSCOPE
            R.id.btn_ai_openai -> AIServiceType.OPENAI
            R.id.btn_ai_gemini -> AIServiceType.GEMINI
            else -> AIServiceType.DASHSCOPE
        }

        // Obsidian 配置
        settings.filenameFormat = binding.etFilenameFormat.text.toString()

        // LifeOS 配置
        settings.lifeosUrl = binding.etLifeosUrl.text.toString()

        // 应用配置
        settings.autoCleanVoiceText = binding.switchAutoClean.isChecked
        settings.smartTagRecommendation = binding.switchSmartTag.isChecked

        // 图片配置
        settings.imageQuality = binding.sliderImageQuality.value.toInt()
        settings.autoEdgeDetection = binding.switchAutoEdge.isChecked
        settings.edgeDetectionThreshold = binding.sliderEdgeThreshold.value

        // 离线队列配置
        settings.autoRetry = binding.switchAutoRetry.isChecked
        settings.wifiOnlySync = binding.switchWifiOnly.isChecked

        // 更新状态提示
        updateSTTStatus()
        updateAIStatus()

        FeedbackUtil.showToast(this, "✅ 设置已保存")
        FeedbackUtil.vibrate(this)
        finish()
    }

    private fun updateVaultPathDisplay() {
        val uri = obsidianRepo.vaultUri
        binding.tvVaultPath.text = if (uri != null) {
            uri.lastPathSegment?.replace(":", "/") ?: uri.toString()
        } else {
            "未选择 Vault 目录"
        }
    }

    private fun updateSTTStatus() {
        val selectedType = when (binding.toggleSttService.checkedButtonId) {
            R.id.btn_stt_gemini -> STTServiceType.GEMINI
            R.id.btn_stt_whisper -> STTServiceType.OPENAI_WHISPER
            R.id.btn_stt_dashscope -> STTServiceType.DASHSCOPE
            else -> settings.sttServiceType
        }

        val geminiOk = binding.etGeminiKey.text.toString().isNotEmpty()
        val openaiOk = binding.etOpenaiKey.text.toString().isNotEmpty()
        val dashscopeOk = binding.etDashscopeKey.text.toString().isNotEmpty()

        val hasApiKey = when (selectedType) {
            STTServiceType.GEMINI -> geminiOk
            STTServiceType.OPENAI_WHISPER -> openaiOk
            STTServiceType.DASHSCOPE -> dashscopeOk
        }

        val serviceName = when (selectedType) {
            STTServiceType.GEMINI -> "Gemini"
            STTServiceType.OPENAI_WHISPER -> "OpenAI Whisper"
            STTServiceType.DASHSCOPE -> "DashScope"
        }

        binding.tvSttStatus.text = if (hasApiKey) "✅ 当前使用: $serviceName"
                                   else "⚠️ 请先配置 $serviceName API Key"
        binding.tvSttStatus.setTextColor(getColor(if (hasApiKey) R.color.success else R.color.error))

        binding.btnSttGemini.isEnabled = geminiOk
        binding.btnSttWhisper.isEnabled = openaiOk
        binding.btnSttDashscope.isEnabled = dashscopeOk
    }

    private fun updateAIStatus() {
        val selectedType = when (binding.toggleAiService.checkedButtonId) {
            R.id.btn_ai_dashscope -> AIServiceType.DASHSCOPE
            R.id.btn_ai_openai -> AIServiceType.OPENAI
            R.id.btn_ai_gemini -> AIServiceType.GEMINI
            else -> settings.aiServiceType
        }

        val geminiOk = binding.etGeminiKey.text.toString().isNotEmpty()
        val openaiOk = binding.etOpenaiKey.text.toString().isNotEmpty()
        val dashscopeOk = binding.etDashscopeKey.text.toString().isNotEmpty()

        val hasApiKey = when (selectedType) {
            AIServiceType.DASHSCOPE -> dashscopeOk
            AIServiceType.OPENAI -> openaiOk
            AIServiceType.GEMINI -> geminiOk
            AIServiceType.MOCK -> false
        }

        val serviceName = when (selectedType) {
            AIServiceType.DASHSCOPE -> "DashScope"
            AIServiceType.OPENAI -> "OpenAI"
            AIServiceType.GEMINI -> "Gemini"
            AIServiceType.MOCK -> "Mock"
        }

        binding.tvAiStatus.text = if (hasApiKey) "✅ 当前使用: $serviceName"
                                  else "⚠️ 请先配置 $serviceName API Key"
        binding.tvAiStatus.setTextColor(getColor(if (hasApiKey) R.color.success else R.color.error))

        binding.btnAiDashscope.isEnabled = dashscopeOk
        binding.btnAiOpenai.isEnabled = openaiOk
        binding.btnAiGemini.isEnabled = geminiOk
    }

    override fun finish() {
        super.finish()
        AnimUtil.exitPage(this)
    }
}
