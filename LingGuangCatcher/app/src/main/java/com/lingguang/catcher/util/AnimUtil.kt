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
}
