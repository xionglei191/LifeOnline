package com.lingguang.catcher.data.repository

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.documentfile.provider.DocumentFile
import com.lingguang.catcher.data.model.MarkdownDocument
import java.io.File

class ObsidianRepository(private val context: Context) {

    private val TAG = "LingGuang"
    private val prefs = context.getSharedPreferences("lingguang_prefs", Context.MODE_PRIVATE)

    val vaultUri: Uri?
        get() = prefs.getString(KEY_VAULT_URI, null)?.let { Uri.parse(it) }

    fun saveVaultUri(uri: Uri) {
        // 持久化 SAF 权限
        context.contentResolver.takePersistableUriPermission(
            uri,
            Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        )
        prefs.edit().putString(KEY_VAULT_URI, uri.toString()).apply()
        Log.d(TAG, "Vault 路径已保存: $uri")
    }

    /**
     * 写入 Markdown 并可选地复制图片到同目录
     * 返回写入的 md 文件名
     */
    fun writeToInbox(markdown: MarkdownDocument, imageFile: File? = null): Result<String> {
        val uri = vaultUri ?: return Result.failure(Exception("未设置 Obsidian Vault 路径"))

        return try {
            val vaultDir = DocumentFile.fromTreeUri(context, uri)
                ?: return Result.failure(Exception("无法访问 Vault 目录"))

            val inboxDir = vaultDir.findFile("_Inbox")
                ?: vaultDir.createDirectory("_Inbox")
                ?: return Result.failure(Exception("无法创建 _Inbox 目录"))

            // 复制图片，文件名从 markdown 的 fullText 中提取（与 ![[xxx]] 保持一致）
            if (imageFile != null && imageFile.exists()) {
                val imgFilename = extractImageFilename(markdown.fullText) ?: imageFile.name
                val resolvedImgFilename = resolveFilename(inboxDir, imgFilename, ".jpg")
                val imgDoc = inboxDir.createFile("image/jpeg", resolvedImgFilename)
                imgDoc?.let {
                    context.contentResolver.openOutputStream(it.uri)?.use { out ->
                        imageFile.inputStream().use { inp -> inp.copyTo(out) }
                    }
                    Log.d(TAG, "✅ 图片已保存: _Inbox/$resolvedImgFilename")
                }
            }

            // 写入 Markdown
            val filename = resolveFilename(inboxDir, markdown.filename, ".md")
            val file = inboxDir.createFile("text/markdown", filename)
                ?: return Result.failure(Exception("无法创建文件"))

            context.contentResolver.openOutputStream(file.uri)?.use { stream ->
                stream.write(markdown.fullText.toByteArray(Charsets.UTF_8))
            } ?: return Result.failure(Exception("无法写入文件"))

            Log.d(TAG, "✅ 已写入 Obsidian: _Inbox/$filename")
            Result.success(filename)
        } catch (e: Exception) {
            Log.e(TAG, "写入失败: ${e.message}")
            Result.failure(e)
        }
    }

    private fun resolveFilename(dir: DocumentFile, desired: String, ext: String): String {
        if (dir.findFile(desired) == null) return desired
        val base = desired.removeSuffix(ext)
        var i = 1
        while (dir.findFile("${base}_$i$ext") != null) i++
        return "${base}_$i$ext"
    }

    /** 从 fullText 中提取 ![[xxx.jpg]] 里的文件名 */
    private fun extractImageFilename(fullText: String): String? {
        val match = Regex("""!\[\[(.+?\.jpg)]]""").find(fullText)
        return match?.groupValues?.get(1)
    }

    /**
     * 更新已存在的文件
     * @param filename 文件名（相对于 _Inbox）
     * @param content 新的内容
     */
    fun updateFile(filename: String, content: String): Result<Unit> {
        val uri = vaultUri ?: return Result.failure(Exception("未设置 Obsidian Vault 路径"))

        return try {
            val vaultDir = DocumentFile.fromTreeUri(context, uri)
                ?: return Result.failure(Exception("无法访问 Vault 目录"))

            val inboxDir = vaultDir.findFile("_Inbox")
                ?: return Result.failure(Exception("_Inbox 目录不存在"))

            val file = inboxDir.findFile(filename)
                ?: return Result.failure(Exception("文件不存在: $filename"))

            context.contentResolver.openOutputStream(file.uri, "wt")?.use { stream ->
                stream.write(content.toByteArray(Charsets.UTF_8))
            } ?: return Result.failure(Exception("无法写入文件"))

            Log.d(TAG, "✅ 已更新文件: _Inbox/$filename")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e(TAG, "更新文件失败: ${e.message}")
            Result.failure(e)
        }
    }

    fun fileExists(filename: String): Boolean {
        val uri = vaultUri ?: return false
        return try {
            val vaultDir = DocumentFile.fromTreeUri(context, uri) ?: return false
            val inboxDir = vaultDir.findFile("_Inbox") ?: return false
            inboxDir.findFile(filename) != null
        } catch (e: Exception) {
            Log.e(TAG, "检测文件失败: ${e.message}")
            false
        }
    }

    /**
     * 读取 _Inbox 中的文件内容
     */
    fun readFile(filename: String): Result<String> {
        val uri = vaultUri ?: return Result.failure(Exception("未设置 Obsidian Vault 路径"))

        return try {
            val vaultDir = DocumentFile.fromTreeUri(context, uri)
                ?: return Result.failure(Exception("无法访问 Vault 目录"))

            val inboxDir = vaultDir.findFile("_Inbox")
                ?: return Result.failure(Exception("_Inbox 目录不存在"))

            val file = inboxDir.findFile(filename)
                ?: return Result.failure(Exception("文件不存在: $filename"))

            val content = context.contentResolver.openInputStream(file.uri)?.use { stream ->
                stream.bufferedReader().use { it.readText() }
            } ?: return Result.failure(Exception("无法读取文件"))

            Log.d(TAG, "✅ 已读取文件: _Inbox/$filename")
            Result.success(content)
        } catch (e: Exception) {
            Log.e(TAG, "读取文件失败: ${e.message}")
            Result.failure(e)
        }
    }

    companion object {
        private const val KEY_VAULT_URI = "vault_uri"
    }
}
