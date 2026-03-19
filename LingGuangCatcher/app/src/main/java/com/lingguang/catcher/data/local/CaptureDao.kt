package com.lingguang.catcher.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface CaptureDao {

    @Query("SELECT * FROM capture_queue WHERE status = 'PENDING' ORDER BY createdAt ASC")
    suspend fun getPendingCaptures(): List<CaptureEntity>

    @Query("SELECT * FROM capture_queue WHERE id = :id")
    suspend fun getById(id: String): CaptureEntity?

    @Query("SELECT * FROM capture_queue WHERE status = 'PROCESSING' AND updatedAt < :timestamp")
    suspend fun getStuckProcessingRecords(timestamp: Long): List<CaptureEntity>

    @Query("SELECT * FROM capture_queue ORDER BY createdAt DESC")
    fun getAllCapturesFlow(): Flow<List<CaptureEntity>>

    @Query("SELECT * FROM capture_queue ORDER BY createdAt DESC LIMIT :limit")
    suspend fun getRecentCaptures(limit: Int = 50): List<CaptureEntity>

    @Query("SELECT * FROM capture_queue WHERE status = 'SUCCESS' AND markdownContent IS NOT NULL ORDER BY updatedAt DESC LIMIT 1")
    suspend fun getLatestSuccess(): CaptureEntity?

    @Query("SELECT COUNT(*) FROM capture_queue WHERE status = 'PENDING'")
    fun getPendingCountFlow(): Flow<Int>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(capture: CaptureEntity)

    @Update
    suspend fun update(capture: CaptureEntity)

    @Query("DELETE FROM capture_queue WHERE id = :id")
    suspend fun delete(id: String)

    @Query("DELETE FROM capture_queue WHERE status = 'SUCCESS' AND updatedAt < :timestamp")
    suspend fun deleteOldSuccessRecords(timestamp: Long)
}
