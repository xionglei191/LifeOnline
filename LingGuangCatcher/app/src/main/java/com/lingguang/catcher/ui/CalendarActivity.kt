package com.lingguang.catcher.ui

import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.lingguang.catcher.data.api.LifeOSService
import com.lingguang.catcher.data.local.AppSettings
import com.lingguang.catcher.data.model.PhysicalAction
import com.lingguang.catcher.databinding.ActivityCalendarBinding
import com.lingguang.catcher.util.AnimUtil
import com.lingguang.catcher.util.FeedbackUtil
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Calendar

class CalendarActivity : AppCompatActivity() {

    private lateinit var binding: ActivityCalendarBinding
    private lateinit var adapter: CalendarAdapter
    private lateinit var lifeOSService: LifeOSService
    private var allActions: List<PhysicalAction> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCalendarBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val settings = AppSettings.getInstance(this)
        val url = settings.lifeosUrl.ifEmpty { "http://192.168.31.252:3000" }
        lifeOSService = LifeOSService(url)

        setupToolbar()
        setupRecyclerView()
        setupCalendar()
        
        loadActions()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener { finish() }
    }

    private fun setupRecyclerView() {
        adapter = CalendarAdapter()
        binding.rvCalendarEvents.layoutManager = LinearLayoutManager(this)
        binding.rvCalendarEvents.adapter = adapter
    }

    private fun setupCalendar() {
        binding.calendarView.setOnDateChangeListener { _, year, month, dayOfMonth ->
            filterActionsForDate(year, month, dayOfMonth)
        }
    }

    private fun loadActions() {
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) {
                lifeOSService.getPendingPhysicalActions() // In a real scenario, this would be a GET api/physical-actions with all statuses
            }
            
            val list = result.getOrNull()
            if (list == null) {
                FeedbackUtil.showToast(this@CalendarActivity, "加载排期列表失败")
                updateUI(emptyList())
            } else {
                allActions = list
                val cal = Calendar.getInstance()
                filterActionsForDate(cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH))
            }
        }
    }

    private fun filterActionsForDate(year: Int, month: Int, dayOfMonth: Int) {
        // Simple mock filtering logic for demonstration
        val filtered = allActions.filter { it.actionType == "calendar_event" }
        updateUI(filtered)
    }

    private fun updateUI(actions: List<PhysicalAction>) {
        if (actions.isEmpty()) {
            binding.rvCalendarEvents.visibility = View.GONE
            binding.tvEmpty.visibility = View.VISIBLE
        } else {
            binding.rvCalendarEvents.visibility = View.VISIBLE
            binding.tvEmpty.visibility = View.GONE
            adapter.submitList(actions)
        }
    }

    override fun finish() {
        super.finish()
        AnimUtil.exitPage(this)
    }
}
