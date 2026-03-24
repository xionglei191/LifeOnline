package com.lingguang.catcher.ui

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.lingguang.catcher.databinding.ActivityMainBinding
import com.lingguang.catcher.data.repository.ObsidianRepository
import com.lingguang.catcher.data.local.AppDatabase
import com.lingguang.catcher.data.local.AppSettings
import com.lingguang.catcher.service.FloatingBubbleService
import com.lingguang.catcher.service.LifeOSNotificationService
import com.lingguang.catcher.worker.SyncWorker
import com.lingguang.catcher.util.FeedbackUtil
import com.lingguang.catcher.util.PermissionUtil
import com.lingguang.catcher.util.ResultCache
import com.lingguang.catcher.util.AnimUtil
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var obsidianRepo: ObsidianRepository
    private val database by lazy { AppDatabase.getDatabase(this) }
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var isBubbleRunning = false

    private val pickVaultLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            result.data?.data?.let { uri ->
                obsidianRepo.saveVaultUri(uri)
                refreshVaultStatus()
                FeedbackUtil.showToast(this, "✅ Vault 已设置")
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        obsidianRepo = ObsidianRepository(this)
        setupUI()
        setupQueueObserver()
        setupNetworkMonitor()
        checkPermissions()
        checkFirstRun()
        startLifeOSNotificationService()
    }

    override fun onResume() {
        super.onResume()
        refreshResult()
        refreshVaultStatus()
        refreshQueueStatus()
    }

    override fun onDestroy() {
        super.onDestroy()
        networkCallback?.let {
            val cm = getSystemService(ConnectivityManager::class.java)
            cm?.unregisterNetworkCallback(it)
        }
    }

    private fun setupUI() {
        binding.btnSettings.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
            AnimUtil.enterPage(this)
        }

        binding.btnExport.setOnClickListener {
            startActivity(Intent(this, ExportActivity::class.java))
            AnimUtil.enterPage(this)
        }

        binding.btnHistory.setOnClickListener {
            startActivity(Intent(this, HistoryActivity::class.java))
            AnimUtil.enterPage(this)
        }

        binding.btnInsights.setOnClickListener {
            startActivity(Intent(this, InsightsActivity::class.java))
            AnimUtil.enterPage(this)
        }

        binding.btnGovernance.setOnClickListener {
            startActivity(Intent(this, GovernanceActivity::class.java))
            AnimUtil.enterPage(this)
        }

        binding.btnBubble.setOnClickListener {
            toggleFloatingBubble()
        }

        binding.btnVoiceCapture.setOnClickListener {
            if (PermissionUtil.hasRecordAudioPermission(this)) {
                startActivity(Intent(this, VoiceCaptureActivity::class.java))
                AnimUtil.enterPage(this)
            } else {
                requestRecordAudioPermission()
            }
        }

        // 长按语音按钮：直接进入头脑风暴模式
        binding.btnVoiceCapture.setOnLongClickListener {
            if (PermissionUtil.hasRecordAudioPermission(this)) {
                FeedbackUtil.vibrate(this, 50)
                startActivity(Intent(this, BrainstormActivity::class.java))
                AnimUtil.enterPage(this)
            } else {
                requestRecordAudioPermission()
            }
            true
        }

        binding.btnCameraCapture.setOnClickListener {
            if (PermissionUtil.hasCameraPermission(this)) {
                startActivity(Intent(this, CameraCaptureActivity::class.java))
                AnimUtil.enterPage(this)
            } else {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), PermissionUtil.REQUEST_CAMERA)
            }
        }

        // 长按拍照按钮：显示快捷菜单（前置/后置摄像头）
        binding.btnCameraCapture.setOnLongClickListener {
            if (PermissionUtil.hasCameraPermission(this)) {
                FeedbackUtil.vibrate(this, 50)
                showCameraQuickMenu()
            } else {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), PermissionUtil.REQUEST_CAMERA)
            }
            true
        }

        binding.btnLinkCapture.setOnClickListener {
            val intent = Intent(this, TextCaptureActivity::class.java)
            intent.putExtra("mode", "link")
            startActivity(intent)
            AnimUtil.enterPage(this)
        }

        binding.btnTextCapture.setOnClickListener {
            val intent = Intent(this, TextCaptureActivity::class.java)
            intent.putExtra("mode", "text")
            startActivity(intent)
            AnimUtil.enterPage(this)
        }
    }

    private fun refreshVaultStatus() {
        val uri = obsidianRepo.vaultUri
        binding.tvVaultStatus.text = if (uri != null) {
            "已连接: ${uri.lastPathSegment?.substringAfterLast(':') ?: uri.toString()}"
        } else {
            "未连接 Obsidian，请前往设置配置"
        }
    }

    private fun refreshResult() {
        lifecycleScope.launch {
            val latest = database.captureDao().getLatestSuccess()
            if (latest != null && latest.markdownContent != null) {
                binding.tvResultLabel.text = "最近捕获：${latest.filename ?: "未命名"}"
                binding.tvResult.text = latest.markdownContent
            } else {
                binding.tvResultLabel.text = "最近捕获"
                binding.tvResult.text = "等待捕获...\n\n点击上方任一入口，或从其他 App 分享内容过来。"
            }
        }
    }

    private fun checkPermissions() {
        val permissions = PermissionUtil.getRequiredPermissions()
        val needRequest = permissions.filter {
            ActivityCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (needRequest.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, needRequest.toTypedArray(), PermissionUtil.REQUEST_RECORD_AUDIO)
        }
    }

    private fun requestRecordAudioPermission() {
        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.RECORD_AUDIO),
            PermissionUtil.REQUEST_RECORD_AUDIO
        )
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PermissionUtil.REQUEST_RECORD_AUDIO) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startActivity(Intent(this, VoiceCaptureActivity::class.java))
            } else {
                FeedbackUtil.showToast(this, "需要录音权限才能使用语音捕获功能")
            }
        } else if (requestCode == PermissionUtil.REQUEST_CAMERA) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startActivity(Intent(this, CameraCaptureActivity::class.java))
            } else {
                FeedbackUtil.showToast(this, "需要相机权限才能使用拍照功能")
            }
        }
    }

    private fun setupQueueObserver() {
        // 监听队列状态变化
        lifecycleScope.launch {
            database.captureDao().getPendingCountFlow().collect { count ->
                refreshQueueStatus()
            }
        }

        // 重试按钮
        binding.btnRetryQueue.setOnClickListener {
            triggerSync()
            FeedbackUtil.showToast(this, "正在重试...")
        }

        // 点击队列卡片查看详情
        binding.cardQueueStatus.setOnClickListener {
            startActivity(Intent(this, QueueActivity::class.java))
        }
    }

    private fun setupNetworkMonitor() {
        val cm = getSystemService(ConnectivityManager::class.java) ?: return
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                // 网络恢复，触发同步
                runOnUiThread {
                    triggerSync()
                }
            }
        }

        cm.registerNetworkCallback(request, networkCallback!!)
    }

    private fun refreshQueueStatus() {
        lifecycleScope.launch {
            val allCaptures = database.captureDao().getPendingCaptures()
            val pendingCount = allCaptures.size
            if (pendingCount > 0) {
                binding.cardQueueStatus.visibility = View.VISIBLE
                binding.tvQueueStatus.text = "$pendingCount 条笔记待同步"
            } else {
                binding.cardQueueStatus.visibility = View.GONE
            }
        }
    }

    private fun triggerSync() {
        val workRequest = SyncWorker.buildWorkRequest()
        WorkManager.getInstance(this)
            .enqueueUniqueWork(
                "sync_queue",
                androidx.work.ExistingWorkPolicy.KEEP, // 如果已有任务在运行，保留旧任务
                workRequest
            )
    }

    private fun toggleFloatingBubble() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                // 请求悬浮窗权限
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:$packageName")
                )
                startActivityForResult(intent, REQUEST_OVERLAY_PERMISSION)
                return
            }
        }

        if (isBubbleRunning) {
            stopFloatingBubble()
        } else {
            startFloatingBubble()
        }
    }

    private fun startFloatingBubble() {
        val intent = Intent(this, FloatingBubbleService::class.java)
        startService(intent)
        isBubbleRunning = true
        binding.btnBubble.text = "💫"
        FeedbackUtil.showToast(this, "气泡已就位，随时捕获灵感 ✨")
    }

    private fun showCameraQuickMenu() {
        MaterialAlertDialogBuilder(this)
            .setTitle("快速拍照")
            .setItems(arrayOf("📸 后置摄像头", "🤳 前置摄像头")) { _, which ->
                val intent = Intent(this, CameraCaptureActivity::class.java)
                intent.putExtra("camera_facing", if (which == 0) "back" else "front")
                startActivity(intent)
            }
            .show()
    }

    private fun stopFloatingBubble() {
        val intent = Intent(this, FloatingBubbleService::class.java)
        stopService(intent)
        isBubbleRunning = false
        binding.btnBubble.text = "✨"
        FeedbackUtil.showToast(this, "气泡已收起")
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_OVERLAY_PERMISSION) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (Settings.canDrawOverlays(this)) {
                    startFloatingBubble()
                } else {
                    FeedbackUtil.showToast(this, "需要悬浮窗权限才能使用气泡功能")
                }
            }
        }
    }

    private fun startLifeOSNotificationService() {
        val intent = Intent(this, LifeOSNotificationService::class.java)
        ContextCompat.startForegroundService(this, intent)
    }

    companion object {
        private const val REQUEST_OVERLAY_PERMISSION = 1001
    }

    private fun checkFirstRun() {
        val settings = AppSettings.getInstance(this)
        val hasAnyKey = settings.dashscopeApiKey.isNotEmpty() ||
                        settings.geminiApiKey.isNotEmpty() ||
                        settings.openaiApiKey.isNotEmpty()
        if (hasAnyKey) return

        MaterialAlertDialogBuilder(this)
            .setTitle("👋 欢迎使用灵光捕手")
            .setMessage(
                "使用前需要配置 AI 服务的 API Key。\n\n" +
                "推荐使用 Gemini（免费额度充足）：\n" +
                "1. 访问 aistudio.google.com/apikey\n" +
                "2. 创建并复制 API Key\n" +
                "3. 在设置页面填入\n\n" +
                "也支持阿里云 DashScope。"
            )
            .setPositiveButton("去设置") { _, _ ->
                startActivity(Intent(this, SettingsActivity::class.java))
            }
            .setNegativeButton("稍后再说", null)
            .show()
    }
}
