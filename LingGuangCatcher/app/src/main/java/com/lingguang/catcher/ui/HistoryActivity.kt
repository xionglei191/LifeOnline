package com.lingguang.catcher.ui

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.lingguang.catcher.data.local.AppDatabase
import com.lingguang.catcher.data.local.CaptureEntity
import com.lingguang.catcher.data.local.ProcessStatus
import com.lingguang.catcher.data.model.CaptureType
import com.lingguang.catcher.databinding.ActivityHistoryBinding
import com.lingguang.catcher.util.AnimUtil
import com.lingguang.catcher.util.FeedbackUtil
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class HistoryActivity : AppCompatActivity() {

    private lateinit var binding: ActivityHistoryBinding
    private lateinit var adapter: HistoryAdapter
    private lateinit var searchHistoryAdapter: SearchHistoryAdapter
    private val database by lazy { AppDatabase.getDatabase(applicationContext) }
    private var allCaptures = listOf<CaptureEntity>()
    private var filteredCaptures = listOf<CaptureEntity>()
    private var filterTag: String? = null
    private var currentSortOrder = SortOrder.TIME_DESC
    private var searchFilter = SearchFilter()
    private var searchJob: kotlinx.coroutines.Job? = null

    enum class SortOrder {
        TIME_DESC,  // 时间降序 (最新)
        TIME_ASC,   // 时间升序 (最旧)
        TITLE_ASC   // 标题升序
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityHistoryBinding.inflate(layoutInflater)
        setContentView(binding.root)

        filterTag = intent.getStringExtra("FILTER_TAG")

        // 加载保存的筛选条件
        searchFilter = SearchFilter.load(this)

        setupToolbar()
        setupRecyclerView()
        setupSearch()
        setupFilters()
        setupActions()
        loadHistory()

        // 更新筛选按钮文本
        updateFilterButtonText()
    }

    override fun onResume() {
        super.onResume()
        loadHistory()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener { finish() }

        // 如果有标签筛选，显示在标题中
        filterTag?.let {
            binding.toolbar.title = "标签: $it"
        }
    }

    private fun setupSearch() {
        // 设置搜索历史 RecyclerView
        searchHistoryAdapter = SearchHistoryAdapter(
            onItemClick = { query ->
                binding.etSearch.setText(query)
                binding.etSearch.setSelection(query.length)
                binding.cardSearchHistory.visibility = View.GONE
            },
            onDeleteClick = { query ->
                com.lingguang.catcher.util.SearchHistoryManager.removeHistory(this, query)
                updateSearchHistory()
            }
        )
        binding.rvSearchHistory.layoutManager = LinearLayoutManager(this)
        binding.rvSearchHistory.adapter = searchHistoryAdapter

        // 清空历史按钮
        binding.btnClearHistory.setOnClickListener {
            com.lingguang.catcher.util.SearchHistoryManager.clearHistory(this)
            updateSearchHistory()
        }

        // 搜索框获得焦点时显示历史
        binding.etSearch.setOnFocusChangeListener { _, hasFocus ->
            if (hasFocus && binding.etSearch.text.isNullOrEmpty()) {
                updateSearchHistory()
            }
        }

        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                val query = s?.toString() ?: ""
                if (query.isEmpty()) {
                    updateSearchHistory()
                } else {
                    binding.cardSearchHistory.visibility = View.GONE
                }
                performSearch(query)
            }
        })

        // 搜索框提交时保存历史
        binding.etSearch.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH) {
                val query = binding.etSearch.text.toString()
                if (query.isNotBlank()) {
                    com.lingguang.catcher.util.SearchHistoryManager.addHistory(this, query)
                    binding.cardSearchHistory.visibility = View.GONE
                }
                true
            } else {
                false
            }
        }
    }

    private fun updateSearchHistory() {
        val history = com.lingguang.catcher.util.SearchHistoryManager.getHistory(this)
        if (history.isEmpty()) {
            binding.cardSearchHistory.visibility = View.GONE
        } else {
            binding.cardSearchHistory.visibility = View.VISIBLE
            searchHistoryAdapter.submitList(history)
        }
    }

    private fun performSearch(query: String) {
        searchJob?.cancel()
        searchJob = lifecycleScope.launch {
            // 防抖 300ms
            kotlinx.coroutines.delay(300)
            if (query.isEmpty()) {
                applyFilter()
            } else {
                // 全文搜索移到后台线程
                filteredCaptures = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) {
                    allCaptures.filter { capture ->
                        val titleMatch = capture.title?.contains(query, ignoreCase = true) == true
                        val contentMatch = capture.markdownContent?.contains(query, ignoreCase = true) == true
                        val rawContentMatch = capture.rawContent?.contains(query, ignoreCase = true) == true
                        val tagsMatch = try {
                            val metadata = org.json.JSONObject(capture.metadata ?: "{}")
                            val tags = metadata.optString("tags", "")
                            tags.contains(query, ignoreCase = true)
                        } catch (e: Exception) {
                            false
                        }
                        titleMatch || contentMatch || rawContentMatch || tagsMatch
                    }
                }
                applySortAndUpdate()
            }
        }
    }

    private fun setupActions() {
        binding.btnSort.setOnClickListener {
            showSortDialog()
        }

        binding.btnFilter.setOnClickListener {
            showFilterDialog()
        }

        binding.btnBatchDelete.setOnClickListener {
            if (adapter.isSelectionMode()) {
                deleteSelectedItems()
            } else {
                showBatchDeleteDialog()
            }
        }

        // 添加全选按钮（在多选模式下显示）
        binding.btnSelectAll.setOnClickListener {
            adapter.selectAll()
            updateSelectionUI()
        }

        // 添加取消按钮（在多选模式下显示）
        binding.btnCancelSelection.setOnClickListener {
            exitSelectionMode()
        }
    }

    private fun enterSelectionMode(capture: CaptureEntity) {
        adapter.setSelectionMode(true)
        adapter.toggleSelection(capture.id)
        updateSelectionUI()
        FeedbackUtil.vibrate(this, 50)
    }

    private fun exitSelectionMode() {
        adapter.setSelectionMode(false)
        updateSelectionUI()
    }

    private fun updateSelectionUI() {
        val isSelectionMode = adapter.isSelectionMode()
        val selectedCount = adapter.getSelectedCount()

        if (isSelectionMode) {
            binding.toolbar.title = "已选择 $selectedCount 项"
            binding.btnSelectAll.visibility = View.VISIBLE
            binding.btnCancelSelection.visibility = View.VISIBLE
            binding.btnSort.visibility = View.GONE
            binding.btnFilter.visibility = View.GONE
            binding.btnBatchDelete.text = "删除选中"
            // 多选模式下隐藏搜索框
            binding.tilSearch.visibility = View.GONE
            binding.cardSearchHistory.visibility = View.GONE
        } else {
            binding.toolbar.title = "历史记录"
            binding.btnSelectAll.visibility = View.GONE
            binding.btnCancelSelection.visibility = View.GONE
            binding.btnSort.visibility = View.VISIBLE
            binding.btnFilter.visibility = View.VISIBLE
            binding.btnBatchDelete.text = "批量"
            // 退出多选模式时显示搜索框
            binding.tilSearch.visibility = View.VISIBLE
        }
    }

    private fun deleteSelectedItems() {
        val selectedItems = adapter.getSelectedItems()
        if (selectedItems.isEmpty()) {
            FeedbackUtil.showToast(this, "请选择要删除的项目")
            return
        }

        MaterialAlertDialogBuilder(this)
            .setTitle("确认删除")
            .setMessage("确定要删除选中的 ${selectedItems.size} 条记录吗？")
            .setPositiveButton("删除") { _, _ ->
                batchDelete(selectedItems)
                exitSelectionMode()
            }
            .setNegativeButton("取消", null)
            .show()
    }

    private fun showSortDialog() {
        val options = arrayOf("最新优先", "最旧优先", "标题排序")
        val currentIndex = when (currentSortOrder) {
            SortOrder.TIME_DESC -> 0
            SortOrder.TIME_ASC -> 1
            SortOrder.TITLE_ASC -> 2
        }

        MaterialAlertDialogBuilder(this)
            .setTitle("排序方式")
            .setSingleChoiceItems(options, currentIndex) { dialog, which ->
                currentSortOrder = when (which) {
                    0 -> SortOrder.TIME_DESC
                    1 -> SortOrder.TIME_ASC
                    2 -> SortOrder.TITLE_ASC
                    else -> SortOrder.TIME_DESC
                }
                applySortAndUpdate()
                dialog.dismiss()
            }
            .show()
    }

    private fun showBatchDeleteDialog() {
        val options = arrayOf(
            "删除所有失败记录",
            "删除所有成功记录",
            "删除 7 天前的记录",
            "删除 30 天前的记录"
        )

        MaterialAlertDialogBuilder(this)
            .setTitle("批量删除")
            .setItems(options) { _, which ->
                when (which) {
                    0 -> confirmBatchDelete("失败记录") { it.status == ProcessStatus.FAILED }
                    1 -> confirmBatchDelete("成功记录") { it.status == ProcessStatus.SUCCESS }
                    2 -> confirmBatchDelete("7 天前的记录") {
                        System.currentTimeMillis() - it.createdAt > 7 * 24 * 60 * 60 * 1000
                    }
                    3 -> confirmBatchDelete("30 天前的记录") {
                        System.currentTimeMillis() - it.createdAt > 30 * 24 * 60 * 60 * 1000
                    }
                }
            }
            .show()
    }

    private fun confirmBatchDelete(description: String, predicate: (CaptureEntity) -> Boolean) {
        val toDelete = allCaptures.filter(predicate)
        if (toDelete.isEmpty()) {
            FeedbackUtil.showToast(this, "没有符合条件的记录")
            return
        }

        MaterialAlertDialogBuilder(this)
            .setTitle("确认删除")
            .setMessage("确定要删除 ${toDelete.size} 条${description}吗？")
            .setPositiveButton("删除") { _, _ ->
                batchDelete(toDelete)
            }
            .setNegativeButton("取消", null)
            .show()
    }

    private fun batchDelete(captures: List<CaptureEntity>) {
        lifecycleScope.launch {
            withContext(Dispatchers.IO) {
                captures.forEach { capture ->
                    database.captureDao().delete(capture.id)
                }
            }
            FeedbackUtil.showToast(this@HistoryActivity, "✅ 已删除 ${captures.size} 条记录")
            loadHistory()
        }
    }

    private fun applySortAndUpdate() {
        val sorted = when (currentSortOrder) {
            SortOrder.TIME_DESC -> filteredCaptures.sortedByDescending { it.createdAt }
            SortOrder.TIME_ASC -> filteredCaptures.sortedBy { it.createdAt }
            SortOrder.TITLE_ASC -> filteredCaptures.sortedBy { it.title ?: "" }
        }
        updateUI(sorted)
    }

    private fun setupRecyclerView() {
        adapter = HistoryAdapter(
            onItemClick = null,
            onDeleteClick = { capture ->
                deleteCapture(capture)
            },
            onItemLongClick = { capture ->
                enterSelectionMode(capture)
            }
        )
        binding.rvHistory.layoutManager = LinearLayoutManager(this)
        binding.rvHistory.adapter = adapter
    }

    private fun setupFilters() {
        binding.chipAll.setOnClickListener { filterByType(null) }
        binding.chipImage.setOnClickListener { filterByType(CaptureType.IMAGE) }
        binding.chipLink.setOnClickListener { filterByType(CaptureType.LINK) }
        binding.chipText.setOnClickListener { filterByType(CaptureType.TEXT) }
    }

    private fun loadHistory() {
        lifecycleScope.launch {
            allCaptures = database.captureDao().getRecentCaptures(1000)

            // 应用筛选条件
            applyFilter()
        }
    }

    private fun filterByType(type: CaptureType?) {
        val filtered = if (type == null) {
            allCaptures
        } else {
            allCaptures.filter { it.type == type }
        }

        // 如果有标签筛选，进一步过滤
        filteredCaptures = if (filterTag != null) {
            filtered.filter { capture ->
                capture.markdownContent?.contains(filterTag!!) == true
            }
        } else {
            filtered
        }

        // 应用搜索
        val searchQuery = binding.etSearch.text.toString()
        if (searchQuery.isNotEmpty()) {
            performSearch(searchQuery)
        } else {
            applySortAndUpdate()
        }
    }

    private fun updateUI(captures: List<CaptureEntity>) {
        binding.tvCount.text = "共 ${captures.size} 条记录"

        if (captures.isEmpty()) {
            binding.rvHistory.visibility = View.GONE
            binding.layoutEmpty.visibility = View.VISIBLE

            // 根据搜索/筛选状态显示不同的空状态提示
            val hasSearch = binding.etSearch.text?.isNotEmpty() == true
            val hasFilter = searchFilter.hasAnyFilter()

            if (hasSearch || hasFilter) {
                binding.tvEmptyIcon.setImageResource(com.lingguang.catcher.R.drawable.ic_info)
                binding.tvEmptyMessage.text = "未找到匹配的记录"
                binding.btnClearFilters.visibility = View.VISIBLE
                binding.btnClearFilters.setOnClickListener {
                    // 清除搜索和筛选
                    binding.etSearch.setText("")
                    searchFilter.clear()
                    searchFilter.save(this)
                    updateFilterButtonText()
                    loadHistory()
                }
            } else {
                binding.tvEmptyIcon.setImageResource(com.lingguang.catcher.R.drawable.ic_history)
                binding.tvEmptyMessage.text = "暂无捕获记录"
                binding.btnClearFilters.visibility = View.GONE
            }
        } else {
            binding.rvHistory.visibility = View.VISIBLE
            binding.layoutEmpty.visibility = View.GONE
            adapter.submitList(captures)
        }
    }

    private fun deleteCapture(capture: CaptureEntity) {
        lifecycleScope.launch {
            withContext(Dispatchers.IO) {
                database.captureDao().delete(capture.id)
            }
            // 重新加载列表
            loadHistory()
        }
    }

    private fun showFilterDialog() {
        val dialogView = layoutInflater.inflate(com.lingguang.catcher.R.layout.dialog_search_filter, null)
        val dialog = MaterialAlertDialogBuilder(this)
            .setTitle("筛选条件")
            .setView(dialogView)
            .create()

        // 初始化 Chip 状态
        val chipVoice = dialogView.findViewById<com.google.android.material.chip.Chip>(com.lingguang.catcher.R.id.chipVoice)
        val chipImage = dialogView.findViewById<com.google.android.material.chip.Chip>(com.lingguang.catcher.R.id.chipImage)
        val chipText = dialogView.findViewById<com.google.android.material.chip.Chip>(com.lingguang.catcher.R.id.chipText)
        val chipLink = dialogView.findViewById<com.google.android.material.chip.Chip>(com.lingguang.catcher.R.id.chipLink)

        chipVoice.isChecked = searchFilter.types.contains(CaptureType.VOICE)
        chipImage.isChecked = searchFilter.types.contains(CaptureType.IMAGE)
        chipText.isChecked = searchFilter.types.contains(CaptureType.TEXT)
        chipLink.isChecked = searchFilter.types.contains(CaptureType.LINK)

        val chipCompleted = dialogView.findViewById<com.google.android.material.chip.Chip>(com.lingguang.catcher.R.id.chipCompleted)
        val chipFailed = dialogView.findViewById<com.google.android.material.chip.Chip>(com.lingguang.catcher.R.id.chipFailed)
        val chipProcessing = dialogView.findViewById<com.google.android.material.chip.Chip>(com.lingguang.catcher.R.id.chipProcessing)
        val chipPending = dialogView.findViewById<com.google.android.material.chip.Chip>(com.lingguang.catcher.R.id.chipPending)

        chipCompleted.isChecked = searchFilter.statuses.contains(ProcessStatus.SUCCESS)
        chipFailed.isChecked = searchFilter.statuses.contains(ProcessStatus.FAILED)
        chipProcessing.isChecked = searchFilter.statuses.contains(ProcessStatus.PROCESSING)
        chipPending.isChecked = searchFilter.statuses.contains(ProcessStatus.PENDING)

        val radioGroup = dialogView.findViewById<android.widget.RadioGroup>(com.lingguang.catcher.R.id.radioGroupDateRange)
        when (searchFilter.dateRange) {
            SearchFilter.DateRange.ALL -> radioGroup.check(com.lingguang.catcher.R.id.radioAll)
            SearchFilter.DateRange.TODAY -> radioGroup.check(com.lingguang.catcher.R.id.radioToday)
            SearchFilter.DateRange.WEEK -> radioGroup.check(com.lingguang.catcher.R.id.radioWeek)
            SearchFilter.DateRange.MONTH -> radioGroup.check(com.lingguang.catcher.R.id.radioMonth)
            else -> radioGroup.check(com.lingguang.catcher.R.id.radioAll)
        }

        // 清空按钮
        dialogView.findViewById<com.google.android.material.button.MaterialButton>(com.lingguang.catcher.R.id.btnClearFilter).setOnClickListener {
            searchFilter.clear()
            dialog.dismiss()
            applyFilter()
        }

        // 应用按钮
        dialogView.findViewById<com.google.android.material.button.MaterialButton>(com.lingguang.catcher.R.id.btnApplyFilter).setOnClickListener {
            // 收集类型筛选
            val types = mutableSetOf<CaptureType>()
            if (chipVoice.isChecked) types.add(CaptureType.VOICE)
            if (chipImage.isChecked) types.add(CaptureType.IMAGE)
            if (chipText.isChecked) types.add(CaptureType.TEXT)
            if (chipLink.isChecked) types.add(CaptureType.LINK)
            searchFilter.types = types

            // 收集状态筛选
            val statuses = mutableSetOf<ProcessStatus>()
            if (chipCompleted.isChecked) statuses.add(ProcessStatus.SUCCESS)
            if (chipFailed.isChecked) statuses.add(ProcessStatus.FAILED)
            if (chipProcessing.isChecked) statuses.add(ProcessStatus.PROCESSING)
            if (chipPending.isChecked) statuses.add(ProcessStatus.PENDING)
            searchFilter.statuses = statuses

            // 收集日期范围
            searchFilter.dateRange = when (radioGroup.checkedRadioButtonId) {
                com.lingguang.catcher.R.id.radioToday -> SearchFilter.DateRange.TODAY
                com.lingguang.catcher.R.id.radioWeek -> SearchFilter.DateRange.WEEK
                com.lingguang.catcher.R.id.radioMonth -> SearchFilter.DateRange.MONTH
                else -> SearchFilter.DateRange.ALL
            }

            searchFilter.save(this)
            dialog.dismiss()
            applyFilter()
        }

        dialog.show()
    }

    private fun applyFilter() {
        filteredCaptures = allCaptures.filter { capture ->
            // 类型筛选
            val typeMatch = searchFilter.types.isEmpty() || searchFilter.types.contains(capture.type)

            // 状态筛选
            val statusMatch = searchFilter.statuses.isEmpty() || searchFilter.statuses.contains(capture.status)

            // 日期筛选
            val startTime = searchFilter.getStartTimestamp()
            val endTime = searchFilter.getEndTimestamp()
            val dateMatch = (startTime == null || capture.createdAt >= startTime) &&
                           (endTime == null || capture.createdAt <= endTime)

            // 标签筛选（如果有）
            val tagMatch = filterTag == null || capture.markdownContent?.contains(filterTag!!) == true

            typeMatch && statusMatch && dateMatch && tagMatch
        }

        // 更新筛选按钮文本
        updateFilterButtonText()

        // 应用搜索
        val searchQuery = binding.etSearch.text.toString()
        if (searchQuery.isNotEmpty()) {
            performSearch(searchQuery)
        } else {
            applySortAndUpdate()
        }
    }

    private fun updateFilterButtonText() {
        val count = searchFilter.getFilterCount()
        binding.btnFilter.text = if (count > 0) "筛选($count)" else "筛选"
    }

    override fun finish() {
        super.finish()
        AnimUtil.exitPage(this)
    }
}
