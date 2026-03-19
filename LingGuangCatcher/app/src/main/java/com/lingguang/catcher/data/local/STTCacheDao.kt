package com.lingguang.catcher.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface STTCacheDao {
    @Query("SELECT * FROM stt_cache WHERE audioHash = :hash AND audioSize = :size LIMIT 1")
    suspend fun getByHash(hash: String, size: Long): STTCacheEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(cache: STTCacheEntity)

    @Query("DELETE FROM stt_cache WHERE createdAt < :timestamp")
    suspend fun deleteOldCache(timestamp: Long)

    @Query("SELECT COUNT(*) FROM stt_cache")
    suspend fun getCacheCount(): Int
}
