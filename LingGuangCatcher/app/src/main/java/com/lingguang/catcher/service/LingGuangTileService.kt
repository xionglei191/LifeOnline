package com.lingguang.catcher.service

import android.content.Intent
import android.service.quicksettings.TileService
import com.lingguang.catcher.ui.VoiceCaptureActivity

/**
 * 快捷设置面板 Tile
 * 点击：打开语音采集
 * 长按：打开主界面
 */
class LingGuangTileService : TileService() {

    override fun onClick() {
        super.onClick()
        // 点击 Tile 直接打开语音采集
        val intent = Intent(this, VoiceCaptureActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        startActivityAndCollapse(intent)
    }
}
