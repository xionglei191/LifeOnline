package com.lingguang.catcher.util

import android.content.Context
import android.provider.CalendarContract
import java.util.Calendar

data class CalendarEventSnapshot(
    val title: String,
    val description: String,
    val startTime: Long,
    val endTime: Long,
    val location: String
)

object CalendarResolver {

    /**
     * 读取未来 [days] 天内的日历事件
     */
    fun fetchUpcomingEvents(context: Context, days: Int): List<CalendarEventSnapshot> {
        val events = mutableListOf<CalendarEventSnapshot>()

        val projection = arrayOf(
            CalendarContract.Events.TITLE,
            CalendarContract.Events.DESCRIPTION,
            CalendarContract.Events.DTSTART,
            CalendarContract.Events.DTEND,
            CalendarContract.Events.EVENT_LOCATION
        )

        val now = Calendar.getInstance().timeInMillis
        val future = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, days) }.timeInMillis

        val selection = "(${CalendarContract.Events.DTSTART} >= ?) AND (${CalendarContract.Events.DTSTART} <= ?) AND (${CalendarContract.Events.DELETED} != 1)"
        val selectionArgs = arrayOf(now.toString(), future.toString())

        try {
            val cursor = context.contentResolver.query(
                CalendarContract.Events.CONTENT_URI,
                projection,
                selection,
                selectionArgs,
                "${CalendarContract.Events.DTSTART} ASC"
            )

            cursor?.use {
                val titleIndex = it.getColumnIndexOrThrow(CalendarContract.Events.TITLE)
                val descIndex = it.getColumnIndexOrThrow(CalendarContract.Events.DESCRIPTION)
                val startIndex = it.getColumnIndexOrThrow(CalendarContract.Events.DTSTART)
                val endIndex = it.getColumnIndexOrThrow(CalendarContract.Events.DTEND)
                val locIndex = it.getColumnIndexOrThrow(CalendarContract.Events.EVENT_LOCATION)

                while (it.moveToNext()) {
                    events.add(
                        CalendarEventSnapshot(
                            title = it.getString(titleIndex) ?: "",
                            description = it.getString(descIndex) ?: "",
                            startTime = it.getLong(startIndex),
                            endTime = it.getLong(endIndex),
                            location = it.getString(locIndex) ?: ""
                        )
                    )
                }
            }
        } catch (e: SecurityException) {
            e.printStackTrace()
            // 无权限时返回空列表
        } catch (e: Exception) {
            e.printStackTrace()
        }

        return events
    }
}
