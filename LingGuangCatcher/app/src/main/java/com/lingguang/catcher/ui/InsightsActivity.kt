package com.lingguang.catcher.ui

import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.lingguang.catcher.data.api.LifeOSService
import com.lingguang.catcher.data.local.AppSettings
import com.lingguang.catcher.data.model.ReintegrationRecord
import com.lingguang.catcher.databinding.ActivityInsightsBinding
import com.lingguang.catcher.util.AnimUtil
import com.lingguang.catcher.util.FeedbackUtil
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class InsightsActivity : AppCompatActivity() {

    private lateinit var binding: ActivityInsightsBinding
    private lateinit var adapter: InsightsAdapter
    private lateinit var lifeOSService: LifeOSService

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityInsightsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val settings = AppSettings.getInstance(this)
        val url = settings.lifeosUrl.ifEmpty { "http://192.168.31.252:3000" }
        lifeOSService = LifeOSService(url)

        setupToolbar()
        setupRecyclerView()
        setupSwipeRefresh()
        
        loadInsights()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener { finish() }
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefresh.setOnRefreshListener {
            loadInsights()
        }
    }

    private fun setupRecyclerView() {
        adapter = InsightsAdapter()
        binding.rvInsights.layoutManager = LinearLayoutManager(this)
        binding.rvInsights.adapter = adapter
    }

    private fun loadInsights() {
        binding.swipeRefresh.isRefreshing = true
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) {
                lifeOSService.getReintegrationRecords()
            }
            binding.swipeRefresh.isRefreshing = false

            val list = result.getOrNull()
            if (list == null) {
                FeedbackUtil.showToast(this@InsightsActivity, "加载洞察列表失败")
                updateUI(emptyList())
            } else {
                updateUI(list)
            }
        }
    }

    private fun updateUI(records: List<ReintegrationRecord>) {
        if (records.isEmpty()) {
            binding.rvInsights.visibility = View.GONE
            binding.layoutEmpty.visibility = View.VISIBLE
        } else {
            binding.rvInsights.visibility = View.VISIBLE
            binding.layoutEmpty.visibility = View.GONE
            adapter.submitList(records)
        }
    }

    override fun finish() {
        super.finish()
        AnimUtil.exitPage(this)
    }
}
