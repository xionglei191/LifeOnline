package com.lingguang.catcher.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(entities = [CaptureEntity::class, STTCacheEntity::class], version = 5, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {

    abstract fun captureDao(): CaptureDao
    abstract fun sttCacheDao(): STTCacheDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(database: SupportSQLiteDatabase) {
                database.execSQL(
                    "ALTER TABLE capture_queue ADD COLUMN markdownContent TEXT"
                )
                database.execSQL(
                    "ALTER TABLE capture_queue ADD COLUMN filename TEXT"
                )
                database.execSQL(
                    "ALTER TABLE capture_queue ADD COLUMN title TEXT"
                )
            }
        }

        private val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(database: SupportSQLiteDatabase) {
                database.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS custom_tags (
                        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                        name TEXT NOT NULL,
                        icon TEXT NOT NULL,
                        color TEXT NOT NULL,
                        `group` TEXT NOT NULL,
                        description TEXT NOT NULL,
                        usageCount INTEGER NOT NULL,
                        lastUsedAt INTEGER NOT NULL,
                        createdAt INTEGER NOT NULL,
                        isSystem INTEGER NOT NULL,
                        isFavorite INTEGER NOT NULL
                    )
                    """.trimIndent()
                )
            }
        }

        private val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(database: SupportSQLiteDatabase) {
                database.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS stt_cache (
                        audioHash TEXT PRIMARY KEY NOT NULL,
                        transcription TEXT NOT NULL,
                        createdAt INTEGER NOT NULL,
                        audioSize INTEGER NOT NULL
                    )
                    """.trimIndent()
                )
            }
        }

        private val MIGRATION_4_5 = object : Migration(4, 5) {
            override fun migrate(database: SupportSQLiteDatabase) {
                // 移除 custom_tags 表
                database.execSQL("DROP TABLE IF EXISTS custom_tags")
            }
        }

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "lingguang_database"
                )
                    .addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4, MIGRATION_4_5)
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
