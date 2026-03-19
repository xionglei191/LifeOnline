package com.lingguang.catcher.data.api

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Cloudflare R2 文件上传服务
 * 用于临时存储音频文件，生成公网可访问的 URL 供 DashScope STT 使用
 */
class CloudflareR2Service(
    private val accountId: String,
    private val accessKeyId: String,
    private val secretAccessKey: String,
    private val bucketName: String,
    private val publicDomain: String // R2 公开访问域名，如 https://your-bucket.r2.dev
) {
    private val TAG = "LingGuang"

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    /**
     * 上传文件到 R2，返回公网可访问的 URL
     * @param file 要上传的文件
     * @param objectKey R2 对象键（文件路径），如 "audio/voice_123.m4a"
     * @return 公网 URL，如 "https://your-bucket.r2.dev/audio/voice_123.m4a"
     */
    suspend fun uploadFile(file: File, objectKey: String): String? = withContext(Dispatchers.IO) {
        try {
            val endpoint = "https://$accountId.r2.cloudflarestorage.com"
            val url = "$endpoint/$bucketName/$objectKey"

            // 生成 AWS Signature V4
            val now = Date()
            val dateFormat = SimpleDateFormat("yyyyMMdd'T'HHmmss'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
            val dateStamp = SimpleDateFormat("yyyyMMdd", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }.format(now)
            val amzDate = dateFormat.format(now)

            val region = "auto"
            val service = "s3"

            // 计算 payload hash
            val payloadHash = sha256Hex(file.readBytes())

            // 构建 canonical request
            val canonicalRequest = """
                PUT
                /$bucketName/$objectKey

                host:$accountId.r2.cloudflarestorage.com
                x-amz-acl:public-read
                x-amz-content-sha256:$payloadHash
                x-amz-date:$amzDate

                host;x-amz-acl;x-amz-content-sha256;x-amz-date
                $payloadHash
            """.trimIndent()

            val canonicalRequestHash = sha256Hex(canonicalRequest.toByteArray())

            // 构建 string to sign
            val credentialScope = "$dateStamp/$region/$service/aws4_request"
            val stringToSign = """
                AWS4-HMAC-SHA256
                $amzDate
                $credentialScope
                $canonicalRequestHash
            """.trimIndent()

            // 计算签名
            val signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service)
            val signature = hmacSha256Hex(stringToSign, signingKey)

            // 构建 Authorization header
            val authorization = "AWS4-HMAC-SHA256 Credential=$accessKeyId/$credentialScope, SignedHeaders=host;x-amz-acl;x-amz-content-sha256;x-amz-date, Signature=$signature"

            // 上传文件
            val requestBody = file.asRequestBody("audio/mp4".toMediaType())
            val request = Request.Builder()
                .url(url)
                .put(requestBody)
                .header("Host", "$accountId.r2.cloudflarestorage.com")
                .header("x-amz-content-sha256", payloadHash)
                .header("x-amz-date", amzDate)
                .header("x-amz-acl", "public-read")
                .header("Authorization", authorization)
                .header("Content-Type", "audio/mp4")
                .build()

            val response = client.newCall(request).execute()
            if (response.isSuccessful) {
                val publicUrl = "$publicDomain/$objectKey"
                Log.d(TAG, "✅ R2 上传成功: $publicUrl")
                publicUrl
            } else {
                Log.e(TAG, "R2 上传失败: ${response.code} ${response.body?.string()}")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "R2 上传异常: ${e.message}", e)
            null
        }
    }

    /**
     * 删除 R2 中的文件（清理临时文件）
     */
    suspend fun deleteFile(objectKey: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val endpoint = "https://$accountId.r2.cloudflarestorage.com"
            val url = "$endpoint/$bucketName/$objectKey"

            // 生成 AWS Signature V4
            val now = Date()
            val dateFormat = SimpleDateFormat("yyyyMMdd'T'HHmmss'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
            val dateStamp = SimpleDateFormat("yyyyMMdd", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }.format(now)
            val amzDate = dateFormat.format(now)

            val region = "auto"
            val service = "s3"

            // 构建 canonical request
            val canonicalRequest = """
                DELETE
                /$bucketName/$objectKey

                host:$accountId.r2.cloudflarestorage.com
                x-amz-date:$amzDate

                host;x-amz-date
                UNSIGNED-PAYLOAD
            """.trimIndent()

            val canonicalRequestHash = sha256Hex(canonicalRequest.toByteArray())

            // 构建 string to sign
            val credentialScope = "$dateStamp/$region/$service/aws4_request"
            val stringToSign = """
                AWS4-HMAC-SHA256
                $amzDate
                $credentialScope
                $canonicalRequestHash
            """.trimIndent()

            // 计算签名
            val signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service)
            val signature = hmacSha256Hex(stringToSign, signingKey)

            // 构建 Authorization header
            val authorization = "AWS4-HMAC-SHA256 Credential=$accessKeyId/$credentialScope, SignedHeaders=host;x-amz-date, Signature=$signature"

            val request = Request.Builder()
                .url(url)
                .delete()
                .header("Host", "$accountId.r2.cloudflarestorage.com")
                .header("x-amz-date", amzDate)
                .header("Authorization", authorization)
                .build()

            val response = client.newCall(request).execute()
            if (response.isSuccessful) {
                Log.d(TAG, "✅ R2 删除成功: $objectKey")
                true
            } else {
                Log.e(TAG, "R2 删除失败: ${response.code}")
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "R2 删除异常: ${e.message}")
            false
        }
    }

    private fun sha256Hex(data: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(data)
        return hash.joinToString("") { "%02x".format(it) }
    }

    private fun hmacSha256(data: String, key: ByteArray): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(key, "HmacSHA256"))
        return mac.doFinal(data.toByteArray())
    }

    private fun hmacSha256Hex(data: String, key: ByteArray): String {
        val hash = hmacSha256(data, key)
        return hash.joinToString("") { "%02x".format(it) }
    }

    private fun getSignatureKey(key: String, dateStamp: String, regionName: String, serviceName: String): ByteArray {
        val kDate = hmacSha256(dateStamp, "AWS4$key".toByteArray())
        val kRegion = hmacSha256(regionName, kDate)
        val kService = hmacSha256(serviceName, kRegion)
        return hmacSha256("aws4_request", kService)
    }
}
