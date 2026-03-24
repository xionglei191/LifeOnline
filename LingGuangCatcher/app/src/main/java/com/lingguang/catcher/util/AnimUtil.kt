package com.lingguang.catcher.util

import android.app.Activity
import com.lingguang.catcher.R

/**
 * 页面过渡动画工具类
 * Apple 风格：轻柔、克制、自然
 */
object AnimUtil {

    /** 进入子页面：新页面从右滑入，旧页面向左淡出 */
    fun enterPage(activity: Activity) {
        activity.overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left)
    }

    /** 返回上级页面：旧页面从左滑入，当前页面向右淡出 */
    fun exitPage(activity: Activity) {
        activity.overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right)
    }

    /** 淡入淡出（用于同级页面切换） */
    fun crossFade(activity: Activity) {
        activity.overridePendingTransition(R.anim.fade_in, R.anim.fade_out)
    }

    // 平滑弹性阻尼的 Interpolator
    val springInterpolator = android.view.animation.OvershootInterpolator(1.2f)
    
    // 模拟 iOS 丝滑拖动的 Interpolator
    val smoothInterpolator = androidx.core.view.animation.PathInterpolatorCompat.create(0.2f, 0.8f, 0.2f, 1f)

    fun scaleIn(view: android.view.View, startScale: Float = 0.8f) {
        view.scaleX = startScale
        view.scaleY = startScale
        view.alpha = 0f
        view.animate()
            .scaleX(1f).scaleY(1f).alpha(1f)
            .setDuration(400)
            .setInterpolator(springInterpolator)
            .start()
    }
}
