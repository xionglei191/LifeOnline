package com.lingguang.catcher.data.api

import android.util.Log
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit
import com.lingguang.catcher.data.model.SoulAction
import com.lingguang.catcher.data.model.ReintegrationRecord
import com.lingguang.catcher.data.model.PhysicalAction

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

    fun getPendingSoulActions(): Result<List<SoulAction>> {
        return try {
            val url = "${lifeosUrl.trimEnd('/')}/api/soul-actions?governanceStatus=pending_review"
            val request = Request.Builder().url(url).get().build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val respBody = response.body?.string() ?: "{}"
                    val json = JSONObject(respBody)
                    val actionsArray = json.optJSONArray("soulActions") ?: JSONArray()
                    val resultList = mutableListOf<SoulAction>()
                    for (i in 0 until actionsArray.length()) {
                        resultList.add(SoulAction.fromJson(actionsArray.getJSONObject(i)))
                    }
                    Result.success(resultList)
                } else {
                    Result.failure(Exception("Get soul actions failed: ${response.code}"))
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "getPendingSoulActions error: ${e.message}", e)
            Result.failure(e)
        }
    }

    fun getReintegrationRecords(): Result<List<ReintegrationRecord>> {
        return try {
            val url = "${lifeosUrl.trimEnd('/')}/api/reintegration-records"
            val request = Request.Builder().url(url).get().build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val respBody = response.body?.string() ?: "{}"
                    val json = JSONObject(respBody)
                    val recordsArray = json.optJSONArray("reintegrationRecords") ?: JSONArray()
                    val resultList = mutableListOf<ReintegrationRecord>()
                    for (i in 0 until recordsArray.length()) {
                        resultList.add(ReintegrationRecord.fromJson(recordsArray.getJSONObject(i)))
                    }
                    Result.success(resultList)
                } else {
                    Result.failure(Exception("Get reintegration records failed: ${response.code}"))
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "getReintegrationRecords error: ${e.message}", e)
            Result.failure(e)
        }
    }

    fun approveSoulAction(id: String, reason: String? = null): Result<Boolean> {
        return postSoulActionAction(id, "approve", reason)
    }

    fun discardSoulAction(id: String, reason: String? = null): Result<Boolean> {
        return postSoulActionAction(id, "discard", reason)
    }

    private fun postSoulActionAction(id: String, action: String, reason: String?): Result<Boolean> {
        return try {
            val url = "${lifeosUrl.trimEnd('/')}/api/soul-actions/$id/$action"
            val jsonBody = JSONObject().apply {
                if (reason != null) put("reason", reason)
            }
            val body = jsonBody.toString().toRequestBody("application/json".toMediaType())
            val request = Request.Builder().url(url).post(body).build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    Result.success(true)
                } else {
                    Result.failure(Exception("Action $action failed: ${response.code}"))
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "postSoulActionAction error: ${e.message}", e)
            Result.failure(e)
        }
    }

    fun getPendingPhysicalActions(): Result<List<PhysicalAction>> {
        return try {
            val url = "${lifeosUrl.trimEnd('/')}/api/physical-actions?status=pending_auth"
            val request = Request.Builder().url(url).get().build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val respBody = response.body?.string() ?: "{}"
                    val json = JSONObject(respBody)
                    val actionsArray = json.optJSONArray("actions") ?: JSONArray()
                    val resultList = mutableListOf<PhysicalAction>()
                    for (i in 0 until actionsArray.length()) {
                        resultList.add(PhysicalAction.fromJson(actionsArray.getJSONObject(i)))
                    }
                    Result.success(resultList)
                } else {
                    Result.failure(Exception("Get physical actions failed: ${response.code}"))
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "getPendingPhysicalActions error: ${e.message}", e)
            Result.failure(e)
        }
    }

    fun approvePhysicalAction(id: String, autoApproveNext: Boolean = false): Result<Boolean> {
        return postPhysicalAction(id, "approve", autoApproveNext)
    }

    fun discardPhysicalAction(id: String): Result<Boolean> {
        return postPhysicalAction(id, "reject", false)
    }

    private fun postPhysicalAction(id: String, action: String, autoApproveNext: Boolean): Result<Boolean> {
        return try {
            val url = "${lifeosUrl.trimEnd('/')}/api/physical-actions/${id}/$action"
            val payload = JSONObject().apply {
                if (action == "approve" && autoApproveNext) {
                    put("autoApproveNext", true)
                }
            }
            val body = RequestBody.create(
                "application/json; charset=utf-8".toMediaTypeOrNull(),
                payload.toString()
            )
            val request = Request.Builder().url(url).post(body).build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    Result.success(true)
                } else {
                    Result.failure(Exception("Action $action on PA $id failed: ${response.code}"))
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "postPhysicalAction error: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Call POST /api/environment/sync
     */
    fun syncEnvironmentData(payload: JSONObject): Result<Boolean> {
        return try {
            val url = "${lifeosUrl.trimEnd('/')}/api/environment/sync"
            val body = RequestBody.create(
                "application/json; charset=utf-8".toMediaTypeOrNull(),
                payload.toString()
            )
            val request = Request.Builder().url(url).post(body).build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    Result.success(true)
                } else {
                    Result.failure(Exception("Sync environment failed: ${response.code}"))
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "syncEnvironmentData error: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Call POST /api/physical-actions/emergency-stop
     */
    fun emergencyStop(): Result<Boolean> {
        return try {
            val url = "${lifeosUrl.trimEnd('/')}/api/physical-actions/emergency-stop"
            val body = RequestBody.create(
                "application/json; charset=utf-8".toMediaTypeOrNull(),
                "{}"
            )
            val request = Request.Builder().url(url).post(body).build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    Result.success(true)
                } else {
                    Result.failure(Exception("Emergency stop failed: ${response.code}"))
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "emergencyStop error: ${e.message}", e)
            Result.failure(e)
        }
    }
}
