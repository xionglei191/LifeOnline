package com.lingguang.catcher.data.api

import android.util.Log
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class LifeOSService(private val lifeosUrl: String) {
    private val TAG = "LifeOSService"
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .build()

    /**
     * Call POST /api/index to trigger the indexer
     */
    fun triggerIndex(): Result<Boolean> {
        return try {
            val url = "${lifeosUrl.trimEnd('/')}/api/index"
            val body = "{}".toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url(url)
                .post(body)
                .build()

            Log.d(TAG, "Triggering LifeOS index: $url")
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val respBody = response.body?.string() ?: ""
                    Log.d(TAG, "Trigger index success: $respBody")
                    Result.success(true)
                } else {
                    val errorMsg = "Trigger index failed with code ${response.code}: ${response.message}"
                    Log.e(TAG, errorMsg)
                    Result.failure(Exception(errorMsg))
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Trigger index error: ${e.message}", e)
            Result.failure(e)
        }
    }
}
