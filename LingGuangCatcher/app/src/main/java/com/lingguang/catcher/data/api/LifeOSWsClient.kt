package com.lingguang.catcher.data.api

import android.util.Log
import okhttp3.*
import org.json.JSONObject
import java.util.concurrent.TimeUnit

interface LifeOSWsListener {
    fun onConnected()
    fun onDisconnected()
    fun onIndexFinished(summary: String, successCount: Int)
    fun onSoulActionCreated(actionDesc: String)
    fun onExecutionCompleted(actionId: String, actionType: String, summary: String)
    fun onExecutionFailed(actionId: String, actionType: String, errorMsg: String)
    fun onBreakerTriggered(actionType: String)
}

class LifeOSWsClient(private val lifeosUrl: String, private val listener: LifeOSWsListener) {
    private val TAG = "LifeOSWsClient"
    private var webSocket: WebSocket? = null
    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    fun connect() {
        if (webSocket != null) return

        val wsUrl = lifeosUrl.replace("http://", "ws://").replace("https://", "wss://").trimEnd('/') + "/ws"
        val request = Request.Builder().url(wsUrl).build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d(TAG, "WebSocket connected: $wsUrl")
                listener.onConnected()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.d(TAG, "Received WS msg: $text")
                try {
                    val json = JSONObject(text)
                    val type = json.optString("type")
                    val data = json.optJSONObject("data")

                    when (type) {
                        "index-finished" -> {
                            val summary = data?.optString("summary") ?: "认知分析完成"
                            val eventsSize = data?.optJSONArray("events")?.length() ?: 0
                            listener.onIndexFinished(summary, eventsSize)
                        }
                        "soul-action-created" -> {
                            val actionDesc = data?.optString("actionType") ?: "新动作"
                            listener.onSoulActionCreated(actionDesc)
                        }
                        "execution-completed" -> {
                            val actionId = data?.optString("actionId") ?: ""
                            val actionType = data?.optString("actionType") ?: "unknown"
                            val summary = data?.optString("summary") ?: "执行完成"
                            listener.onExecutionCompleted(actionId, actionType, summary)
                        }
                        "execution-failed" -> {
                            val actionId = data?.optString("actionId") ?: ""
                            val actionType = data?.optString("actionType") ?: "unknown"
                            val errorMsg = data?.optString("error") ?: "未知错误"
                            listener.onExecutionFailed(actionId, actionType, errorMsg)
                        }
                        "breaker-triggered" -> {
                            val actionType = data?.optString("actionType") ?: "unknown"
                            listener.onBreakerTriggered(actionType)
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Parse WS msg failed: ${e.message}")
                }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket closed: $code $reason")
                this@LifeOSWsClient.webSocket = null
                listener.onDisconnected()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket failed: ${t.message}", t)
                this@LifeOSWsClient.webSocket = null
                listener.onDisconnected()
            }
        })
    }

    fun disconnect() {
        webSocket?.close(1000, "Normal closure")
        webSocket = null
    }
}
