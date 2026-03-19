package com.lingguang.catcher.util

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.util.Log

/**
 * 网络状态监听器
 * 监听网络连接状态变化，并在网络恢复时触发回调
 */
class NetworkMonitor(private val context: Context) {

    private val TAG = "NetworkMonitor"
    private val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var onNetworkAvailableCallback: (() -> Unit)? = null

    /**
     * 开始监听网络状态
     * @param onNetworkAvailable 网络恢复时的回调
     */
    fun startMonitoring(onNetworkAvailable: () -> Unit) {
        this.onNetworkAvailableCallback = onNetworkAvailable

        val networkRequest = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                Log.d(TAG, "网络已连接")
                onNetworkAvailable()
            }

            override fun onLost(network: Network) {
                Log.d(TAG, "网络已断开")
            }
        }

        connectivityManager.registerNetworkCallback(networkRequest, networkCallback!!)
        Log.d(TAG, "开始监听网络状态")
    }

    /**
     * 停止监听网络状态
     */
    fun stopMonitoring() {
        networkCallback?.let {
            try {
                connectivityManager.unregisterNetworkCallback(it)
                Log.d(TAG, "停止监听网络状态")
            } catch (e: Exception) {
                Log.e(TAG, "停止监听失败: ${e.message}")
            }
        }
        networkCallback = null
        onNetworkAvailableCallback = null
    }

    companion object {
        /**
         * 检查当前是否有网络连接
         */
        fun isNetworkAvailable(context: Context): Boolean {
            val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val network = connectivityManager.activeNetwork ?: return false
            val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
            return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        }

        /**
         * 检查当前是否连接到 WiFi
         */
        fun isWifiConnected(context: Context): Boolean {
            val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val network = connectivityManager.activeNetwork ?: return false
            val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
            return capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
        }
    }
}
