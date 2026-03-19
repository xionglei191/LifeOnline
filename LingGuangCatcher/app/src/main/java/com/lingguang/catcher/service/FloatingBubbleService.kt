package com.lingguang.catcher.service

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.PixelFormat
import android.graphics.Point
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.animation.OvershootInterpolator
import com.lingguang.catcher.databinding.LayoutFloatingBubbleBinding
import com.lingguang.catcher.ui.CameraCaptureActivity
import com.lingguang.catcher.ui.TextCaptureActivity
import com.lingguang.catcher.ui.VoiceCaptureActivity
import com.lingguang.catcher.util.FeedbackUtil
import kotlin.math.abs
import kotlin.math.sqrt

class FloatingBubbleService : Service() {
    private enum class BubbleSide { LEFT, RIGHT }

    private lateinit var windowManager: WindowManager
    private lateinit var bubbleView: View
    private lateinit var binding: LayoutFloatingBubbleBinding
    private var menuView: View? = null
    private var menuBinding: LayoutFloatingBubbleBinding? = null
    private var params: WindowManager.LayoutParams? = null
    private var menuParams: WindowManager.LayoutParams? = null
    private lateinit var prefs: SharedPreferences

    // 拖动相关
    private var initialX = 0
    private var initialY = 0
    private var initialTouchX = 0f
    private var initialTouchY = 0f
    private var isDragging = false
    private var isLongPressing = false

    // 屏幕尺寸
    private var screenWidth = 0
    private var screenHeight = 0

    // 小气泡展开状态
    private var isExpanded = false
    private var currentHoveredBubble: View? = null
    private var currentSide = BubbleSide.RIGHT
    private var bubbleAnchorX = 0
    private var bubbleAnchorY = 0

    // 自动隐藏
    private val handler = Handler(Looper.getMainLooper())
    private val autoHideRunnable = Runnable {
        setTransparent(true)
    }

    // 长按检测
    private val longPressRunnable = Runnable {
        isLongPressing = true
        FeedbackUtil.vibrate(this, 50)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        prefs = getSharedPreferences("bubble_prefs", Context.MODE_PRIVATE)
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        getScreenSize()
        setupFloatingBubble()
    }

    private fun getScreenSize() {
        val display = windowManager.defaultDisplay
        val size = Point()
        display.getSize(size)
        screenWidth = size.x
        screenHeight = size.y
    }

    private fun setupFloatingBubble() {
        binding = LayoutFloatingBubbleBinding.inflate(LayoutInflater.from(this))
        bubbleView = binding.root

        // 设置窗口参数
        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        // 恢复保存的位置（保存的是主气泡左上角，不是菜单容器左上角）
        val iconSize = dpToPx(56)
        val savedX = prefs.getInt(KEY_BUBBLE_X, 100).coerceIn(0, screenWidth - iconSize)
        val savedY = prefs.getInt(KEY_BUBBLE_Y, 100).coerceIn(0, screenHeight - iconSize)
        bubbleAnchorX = savedX
        bubbleAnchorY = savedY

        params = WindowManager.LayoutParams(
            iconSize,
            iconSize,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = bubbleAnchorX
            y = bubbleAnchorY
        }

        // 添加到窗口
        windowManager.addView(bubbleView, params)
        setMainBubblePosition(binding, expanded = false)
        binding.bubbleCamera.visibility = View.GONE
        binding.bubbleVoice.visibility = View.GONE
        binding.bubbleText.visibility = View.GONE
        bubbleView.post {
            snapToEdge(animate = false)
            savePosition()
        }

        // 设置触摸监听
        setupTouchListener()

        // 启动自动隐藏
        scheduleAutoHide()
    }

    private fun setupTouchListener() {
        binding.bubbleIcon.setOnTouchListener { view, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = params?.x ?: 0
                    initialY = params?.y ?: 0
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    isDragging = false
                    isLongPressing = false

                    // 取消自动隐藏
                    cancelAutoHide()
                    // 恢复不透明
                    setTransparent(false)

                    // 展开小气泡
                    expandMiniBubbles()

                    // 启动长按检测（2秒）
                    handler.postDelayed(longPressRunnable, 2000)
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val deltaX = event.rawX - initialTouchX
                    val deltaY = event.rawY - initialTouchY

                    // 长按后允许拖动
                    if (isLongPressing) {
                        if (!isDragging) {
                            isDragging = true
                            collapseMiniBubbles(immediate = true)
                        }
                        params?.x = initialX + deltaX.toInt()
                        params?.y = initialY + deltaY.toInt()
                        bubbleAnchorX = params?.x ?: bubbleAnchorX
                        bubbleAnchorY = params?.y ?: bubbleAnchorY
                        windowManager.updateViewLayout(bubbleView, params)
                    } else if (isExpanded) {
                        // 未长按时，滑动选择小气泡
                        checkHoverOnMiniBubbles(event.rawX, event.rawY)
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    // 取消长按检测
                    handler.removeCallbacks(longPressRunnable)

                    if (isDragging) {
                        // 拖动结束,吸附到边缘
                        snapToEdge(animate = true)
                        // 保存位置
                        savePosition()
                        // 重新启动自动隐藏
                        scheduleAutoHide()
                    } else if (isExpanded) {
                        // 检查是否在小气泡上释放
                        val hoveredBubble = currentHoveredBubble
                        collapseMiniBubbles()

                        if (hoveredBubble != null) {
                            // 触发对应功能
                            triggerBubbleAction(hoveredBubble)
                        }
                        scheduleAutoHide()
                    }
                    true
                }
                MotionEvent.ACTION_CANCEL -> {
                    handler.removeCallbacks(longPressRunnable)
                    collapseMiniBubbles()
                    scheduleAutoHide()
                    true
                }
                else -> false
            }
        }
    }

    private fun expandMiniBubbles() {
        if (isExpanded) return
        isExpanded = true
        showMenuOverlay()

        val expandedBinding = menuBinding ?: return

        binding.bubbleIcon.animate()
            .alpha(0f)
            .setDuration(120)
            .start()

        // 小气泡弹出动画
        animateBubbleExpand(expandedBinding.bubbleCamera, 0)
        animateBubbleExpand(expandedBinding.bubbleVoice, 50)
        animateBubbleExpand(expandedBinding.bubbleText, 100)

        FeedbackUtil.vibrate(this, 30)
    }

    private fun updateMiniBubblePositions(expandedBinding: LayoutFloatingBubbleBinding, side: BubbleSide) {
        if (side == BubbleSide.LEFT) {
            setBubblePosition(expandedBinding.bubbleCamera, 45, 22)
            setBubblePosition(expandedBinding.bubbleVoice, 60, 57)
            setBubblePosition(expandedBinding.bubbleText, 45, 92)
        } else {
            setBubblePosition(expandedBinding.bubbleCamera, 69, 22)
            setBubblePosition(expandedBinding.bubbleVoice, 54, 57)
            setBubblePosition(expandedBinding.bubbleText, 69, 92)
        }
    }

    private fun setBubblePosition(bubble: View, startDp: Int, topDp: Int) {
        val layoutParams = bubble.layoutParams as? android.widget.FrameLayout.LayoutParams ?: return
        layoutParams.marginStart = dpToPx(startDp)
        layoutParams.topMargin = dpToPx(topDp)
        bubble.layoutParams = layoutParams
    }

    private fun dpToPx(dp: Int): Int = (dp * resources.displayMetrics.density).toInt()

    private fun setMainBubblePosition(targetBinding: LayoutFloatingBubbleBinding, expanded: Boolean) {
        val layoutParams = targetBinding.bubbleIcon.layoutParams as? android.widget.FrameLayout.LayoutParams ?: return
        if (!expanded) {
            layoutParams.marginStart = 0
            layoutParams.topMargin = 0
        } else {
            layoutParams.marginStart = if (currentSide == BubbleSide.LEFT) 0 else dpToPx(94)
            layoutParams.topMargin = dpToPx(47)
        }
        targetBinding.bubbleIcon.layoutParams = layoutParams
    }

    private fun showMenuOverlay() {
        val menuSize = dpToPx(150)
        val iconSize = dpToPx(56)
        val topOffset = dpToPx(47)
        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val expandedBinding = LayoutFloatingBubbleBinding.inflate(LayoutInflater.from(this))
        menuBinding = expandedBinding
        menuView = expandedBinding.root
        setMainBubblePosition(expandedBinding, expanded = true)
        updateMiniBubblePositions(expandedBinding, currentSide)
        expandedBinding.bubbleCamera.visibility = View.VISIBLE
        expandedBinding.bubbleVoice.visibility = View.VISIBLE
        expandedBinding.bubbleText.visibility = View.VISIBLE
        expandedBinding.bubbleCamera.scaleX = 0f
        expandedBinding.bubbleCamera.scaleY = 0f
        expandedBinding.bubbleVoice.scaleX = 0f
        expandedBinding.bubbleVoice.scaleY = 0f
        expandedBinding.bubbleText.scaleX = 0f
        expandedBinding.bubbleText.scaleY = 0f

        menuParams = WindowManager.LayoutParams(
            menuSize,
            menuSize,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = if (currentSide == BubbleSide.LEFT) bubbleAnchorX else bubbleAnchorX - (menuSize - iconSize)
            y = bubbleAnchorY - topOffset
        }

        windowManager.addView(menuView, menuParams)
    }

    private fun hideMenuOverlay() {
        menuView?.let { windowManager.removeView(it) }
        menuView = null
        menuBinding = null
        menuParams = null
    }

    private fun collapseMiniBubbles(immediate: Boolean = false) {
        if (!isExpanded) return
        isExpanded = false
        currentHoveredBubble = null
        val expandedBinding = menuBinding

        // 主气泡恢复
        binding.bubbleIcon.animate()
            .alpha(1.0f)
            .setDuration(120)
            .start()

        if (expandedBinding == null) {
            hideMenuOverlay()
            return
        }

        // 小气泡收起动画
        animateBubbleCollapse(expandedBinding.bubbleCamera)
        animateBubbleCollapse(expandedBinding.bubbleVoice)
        animateBubbleCollapse(expandedBinding.bubbleText)

        val finishCollapse = {
            hideMenuOverlay()
        }

        if (immediate) {
            finishCollapse()
        } else {
            handler.postDelayed(finishCollapse, 200)
        }
    }

    private fun animateBubbleExpand(bubble: View, delay: Long) {
        bubble.animate()
            .scaleX(1f)
            .scaleY(1f)
            .setDuration(250)
            .setStartDelay(delay)
            .setInterpolator(OvershootInterpolator(2f))
            .start()
    }

    private fun animateBubbleCollapse(bubble: View) {
        bubble.animate()
            .scaleX(0f)
            .scaleY(0f)
            .setDuration(150)
            .setStartDelay(0)
            .start()
    }

    private fun checkHoverOnMiniBubbles(touchX: Float, touchY: Float) {
        val expandedBinding = menuBinding ?: return
        val bubbles = listOf(
            expandedBinding.bubbleCamera,
            expandedBinding.bubbleVoice,
            expandedBinding.bubbleText
        )

        var newHoveredBubble: View? = null

        for (bubble in bubbles) {
            if (isTouchInsideBubble(bubble, touchX, touchY)) {
                newHoveredBubble = bubble
                break
            }
        }

        // 如果悬停的气泡改变了
        if (newHoveredBubble != currentHoveredBubble) {
            // 恢复之前的气泡
            currentHoveredBubble?.let {
                it.animate()
                    .scaleX(1f)
                    .scaleY(1f)
                    .setDuration(100)
                    .start()
            }

            // 放大新的气泡
            newHoveredBubble?.let {
                it.animate()
                    .scaleX(1.3f)
                    .scaleY(1.3f)
                    .setDuration(100)
                    .start()
                FeedbackUtil.vibrate(this, 20)
            }

            currentHoveredBubble = newHoveredBubble
        }
    }

    private fun isTouchInsideBubble(bubble: View, touchX: Float, touchY: Float): Boolean {
        val location = IntArray(2)
        bubble.getLocationOnScreen(location)

        val bubbleCenterX = location[0] + bubble.width / 2f
        val bubbleCenterY = location[1] + bubble.height / 2f

        val distance = sqrt(
            (touchX - bubbleCenterX) * (touchX - bubbleCenterX) +
            (touchY - bubbleCenterY) * (touchY - bubbleCenterY)
        )

        return distance < bubble.width / 2f + 20 // 增加20px的触摸容差
    }

    private fun triggerBubbleAction(bubble: View) {
        FeedbackUtil.vibrate(this, 50)
        val expandedBinding = menuBinding

        when (bubble.id) {
            expandedBinding?.bubbleCamera?.id -> {
                startActivity(Intent(this, CameraCaptureActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                })
            }
            expandedBinding?.bubbleVoice?.id -> {
                startActivity(Intent(this, VoiceCaptureActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                })
            }
            expandedBinding?.bubbleText?.id -> {
                startActivity(Intent(this, TextCaptureActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    putExtra("mode", "text")
                })
            }
        }
    }

    private fun snapToEdge(animate: Boolean) {
        val currentX = bubbleAnchorX
        val bubbleWidth = dpToPx(56)

        // 计算主气泡中心位置
        val bubbleCenterX = currentX + bubbleWidth / 2

        // 判断靠近左边还是右边
        val targetX = if (bubbleCenterX < screenWidth / 2) {
            0
        } else {
            screenWidth - bubbleWidth
        }
        currentSide = if (targetX == 0) BubbleSide.LEFT else BubbleSide.RIGHT
        bubbleAnchorX = targetX

        if (!animate) {
            params?.x = bubbleAnchorX
            params?.y = bubbleAnchorY
            windowManager.updateViewLayout(bubbleView, params)
            return
        }

        bubbleView.animate()
            .translationX((targetX - currentX).toFloat())
            .setDuration(180)
            .withEndAction {
                bubbleView.translationX = 0f
                params?.x = bubbleAnchorX
                params?.y = bubbleAnchorY
                windowManager.updateViewLayout(bubbleView, params)
            }
            .start()
    }

    private fun savePosition() {
        prefs.edit()
            .putInt(KEY_BUBBLE_X, bubbleAnchorX)
            .putInt(KEY_BUBBLE_Y, bubbleAnchorY)
            .apply()
    }

    private fun setTransparent(transparent: Boolean) {
        val alpha = if (transparent) 0.3f else 1.0f
        binding.bubbleIcon.animate()
            .alpha(alpha)
            .setDuration(200)
            .start()
    }

    private fun scheduleAutoHide() {
        handler.removeCallbacks(autoHideRunnable)
        handler.postDelayed(autoHideRunnable, AUTO_HIDE_DELAY)
    }

    private fun cancelAutoHide() {
        handler.removeCallbacks(autoHideRunnable)
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(autoHideRunnable)
        handler.removeCallbacks(longPressRunnable)
        hideMenuOverlay()
        if (::bubbleView.isInitialized) {
            windowManager.removeView(bubbleView)
        }
    }

    companion object {
        private const val KEY_BUBBLE_X = "bubble_x"
        private const val KEY_BUBBLE_Y = "bubble_y"
        private const val AUTO_HIDE_DELAY = 3000L // 3秒后自动半透明
    }
}
