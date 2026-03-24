package com.lingguang.catcher.ui

import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.ItemTouchHelper
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.lingguang.catcher.data.api.LifeOSService
import com.lingguang.catcher.data.local.AppSettings
import com.lingguang.catcher.data.model.GovernanceItem
import com.lingguang.catcher.data.model.PhysicalAction
import com.lingguang.catcher.data.model.SoulAction
import com.lingguang.catcher.databinding.ActivityGovernanceBinding
import com.lingguang.catcher.util.AnimUtil
import com.lingguang.catcher.util.FeedbackUtil
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class GovernanceActivity : AppCompatActivity() {

    private lateinit var binding: ActivityGovernanceBinding
    private lateinit var adapter: GovernanceAdapter
    private lateinit var lifeOSService: LifeOSService

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityGovernanceBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val settings = AppSettings.getInstance(this)
        val url = settings.lifeosUrl.ifEmpty { "http://192.168.31.246:3000" }
        lifeOSService = LifeOSService(url)

        setupToolbar()
        setupRecyclerView()
        setupSwipeRefresh()
        
        loadPendingActions()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener { finish() }
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefresh.setOnRefreshListener {
            loadPendingActions()
        }
    }

    private fun setupRecyclerView() {
        adapter = GovernanceAdapter()
        binding.rvGovernance.layoutManager = LinearLayoutManager(this)
        binding.rvGovernance.adapter = adapter

        val itemTouchHelper = ItemTouchHelper(object : ItemTouchHelper.SimpleCallback(0, ItemTouchHelper.LEFT or ItemTouchHelper.RIGHT) {
            override fun onMove(
                recyclerView: RecyclerView,
                viewHolder: RecyclerView.ViewHolder,
                target: RecyclerView.ViewHolder
            ): Boolean = false

            override fun onSwiped(viewHolder: RecyclerView.ViewHolder, direction: Int) {
                val position = viewHolder.adapterPosition
                val action = adapter.currentList[position]

                if (direction == ItemTouchHelper.RIGHT) {
                    approveAction(action)
                } else if (direction == ItemTouchHelper.LEFT) {
                    discardAction(action)
                }
            }
            
            override fun onChildDraw(
                c: android.graphics.Canvas,
                recyclerView: RecyclerView,
                viewHolder: RecyclerView.ViewHolder,
                dX: Float,
                dY: Float,
                actionState: Int,
                isCurrentlyActive: Boolean
            ) {
                if (actionState == ItemTouchHelper.ACTION_STATE_SWIPE) {
                    val itemView = viewHolder.itemView
                    val width = itemView.width.toFloat()
                    val alpha = 1.0f - Math.abs(dX) / width
                    itemView.alpha = alpha.coerceIn(0.2f, 1f)
                    
                    val scale = 1.0f - (Math.abs(dX) / width) * 0.1f
                    itemView.scaleX = scale.coerceIn(0.9f, 1f)
                    itemView.scaleY = scale.coerceIn(0.9f, 1f)
                }
                super.onChildDraw(c, recyclerView, viewHolder, dX, dY, actionState, isCurrentlyActive)
            }
        })
        itemTouchHelper.attachToRecyclerView(binding.rvGovernance)
    }

    private fun loadPendingActions() {
        binding.swipeRefresh.isRefreshing = true
        lifecycleScope.launch {
            val soulResultAsync = async(Dispatchers.IO) { lifeOSService.getPendingSoulActions() }
            val physicalResultAsync = async(Dispatchers.IO) { lifeOSService.getPendingPhysicalActions() }
            
            val soulResult = soulResultAsync.await()
            val physicalResult = physicalResultAsync.await()

            binding.swipeRefresh.isRefreshing = false

            val list = mutableListOf<GovernanceItem>()
            soulResult.getOrNull()?.let { list.addAll(it) }
            physicalResult.getOrNull()?.let { list.addAll(it) }

            if (list.isEmpty() && soulResult.isFailure && physicalResult.isFailure) {
                FeedbackUtil.showToast(this@GovernanceActivity, "加载审批列表失败")
                updateUI(emptyList())
            } else {
                updateUI(list)
            }
        }
    }

    private fun approveAction(action: GovernanceItem) {
        removeFromList(action)
        FeedbackUtil.showToast(this, "✅ 已批准: ${action.displayTitle}")

        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) {
                if (action.isPhysicalAction()) {
                    lifeOSService.approvePhysicalAction(action.id)
                } else {
                    lifeOSService.approveSoulAction(action.id)
                }
            }
            if (!result.isSuccess) {
                FeedbackUtil.showToast(this@GovernanceActivity, "批准提交失败")
                loadPendingActions()
            }
        }
    }

    private fun discardAction(action: GovernanceItem) {
        removeFromList(action)
        FeedbackUtil.showToast(this, "🗑 已拒绝: ${action.displayTitle}")

        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) {
                if (action.isPhysicalAction()) {
                    lifeOSService.discardPhysicalAction(action.id)
                } else {
                    lifeOSService.discardSoulAction(action.id)
                }
            }
            if (!result.isSuccess) {
                FeedbackUtil.showToast(this@GovernanceActivity, "拒绝提交失败")
                loadPendingActions()
            }
        }
    }

    private fun removeFromList(action: GovernanceItem) {
        val currentList = adapter.currentList.toMutableList()
        currentList.remove(action)
        adapter.submitList(currentList)
        if (currentList.isEmpty()) {
            binding.rvGovernance.visibility = View.GONE
            binding.layoutEmpty.visibility = View.VISIBLE
        }
    }

    private fun updateUI(actions: List<GovernanceItem>) {
        if (actions.isEmpty()) {
            binding.rvGovernance.visibility = View.GONE
            binding.layoutEmpty.visibility = View.VISIBLE
        } else {
            binding.rvGovernance.visibility = View.VISIBLE
            binding.layoutEmpty.visibility = View.GONE
            adapter.submitList(actions)
        }
    }

    override fun finish() {
        super.finish()
        AnimUtil.exitPage(this)
    }
}
