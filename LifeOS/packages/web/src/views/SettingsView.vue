<template>
  <div class="settings-view">
    <h2>设置</h2>

    <div class="settings-card">
      <h3>Vault 配置</h3>
      <div class="form-group">
        <label>Vault 路径</label>
        <div class="input-row">
          <input
            v-model="vaultPath"
            type="text"
            placeholder="输入 Obsidian Vault 路径，如 /home/user/MyVault"
            :disabled="saving"
          />
          <button @click="handleSave" :disabled="saving || !vaultPath">
            {{ saving ? '保存中...' : '保存并重新索引' }}
          </button>
        </div>
        <p class="hint">设置你的 Obsidian Vault 目录路径，系统会自动扫描其中的 .md 文件</p>
      </div>

      <div v-if="message" :class="['message', messageType]">
        {{ message }}
      </div>

      <div v-if="indexResult" class="index-result">
        <h4>索引结果</h4>
        <div class="stats-row">
          <span class="stat">总文件: {{ indexResult.total }}</span>
          <span class="stat indexed">已索引: {{ indexResult.indexed }}</span>
          <span class="stat skipped">跳过: {{ indexResult.skipped }}</span>
          <span class="stat deleted">删除: {{ indexResult.deleted }}</span>
          <span v-if="indexResult.errors.length" class="stat errors">
            错误: {{ indexResult.errors.length }}
          </span>
        </div>
      </div>
    </div>

    <div class="settings-card">
      <h3>索引管理</h3>
      <div class="action-row">
        <button @click="handleReindex" :disabled="reindexing" class="btn-reindex">
          {{ reindexing ? '索引中...' : '手动重新索引' }}
        </button>
        <span v-if="indexStatus" class="queue-info">
          队列: {{ indexStatus.queueSize }} 个文件
          <template v-if="indexStatus.processing"> (处理中)</template>
        </span>
      </div>

      <div v-if="indexErrors.length > 0" class="error-log">
        <h4>索引错误日志 ({{ indexErrors.length }})</h4>
        <div class="error-list">
          <div v-for="(err, i) in indexErrors" :key="i" class="error-item">
            <span class="error-time">{{ formatTime(err.timestamp) }}</span>
            <span class="error-path">{{ err.filePath }}</span>
            <span class="error-msg">{{ err.error }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-card">
      <h3>AI Provider 配置</h3>
      <p class="hint" style="margin-bottom:16px">在线管理 Base URL、Model 与 API Key，保存后立即作用于运行中的 AI 调用。</p>

      <div class="provider-summary">
        <div class="provider-summary-row">
          <span>当前状态</span>
          <span class="prompt-status" :class="aiProviderStatusClass">{{ aiProviderStatusText }}</span>
        </div>
        <div class="provider-summary-row">
          <span>Key 来源</span>
          <span>{{ aiProviderSourceText }}</span>
        </div>
        <div class="provider-summary-row">
          <span>最近更新</span>
          <span>{{ aiProviderSettings?.updatedAt ? formatTime(aiProviderSettings.updatedAt) : '使用默认运行时配置' }}</span>
        </div>
      </div>

      <div v-if="aiProviderMessage" :class="['message', aiProviderMessageType]">{{ aiProviderMessage }}</div>

      <div class="provider-grid">
        <div class="form-group">
          <label>Base URL</label>
          <input v-model="aiProviderBaseUrl" type="url" :disabled="aiProviderSaving || aiProviderTesting" placeholder="https://codeflow.asia/v1/messages" />
        </div>
        <div class="form-group">
          <label>Model</label>
          <input v-model="aiProviderModel" type="text" :disabled="aiProviderSaving || aiProviderTesting" placeholder="claude-haiku-4-5-20251001" />
        </div>
        <div class="form-group">
          <label>API Key（仅写入）</label>
          <input
            v-model="aiProviderApiKey"
            type="password"
            :disabled="aiProviderSaving || aiProviderTesting"
            placeholder="已配置则留空；如需替换请重新输入"
            @input="aiProviderClearKeyPending = false"
          />
          <div class="hint provider-key-meta">
            <span>当前摘要：</span>
            <PrivacyMask privacy="sensitive">
              <span>{{ aiProviderSettings?.apiKeyMasked || '未配置' }}</span>
            </PrivacyMask>
          </div>
        </div>
        <div class="form-group provider-toggle-group">
          <label>Enabled</label>
          <label class="switch-row">
            <input v-model="aiProviderEnabled" type="checkbox" :disabled="aiProviderSaving || aiProviderTesting" />
            <span>{{ aiProviderEnabled ? '启用 AI Provider' : '禁用 AI Provider' }}</span>
          </label>
          <p class="hint">禁用后 AI 相关流程会直接报未启用错误。</p>
        </div>
      </div>

      <div v-if="aiProviderValidationError" class="message error">{{ aiProviderValidationError }}</div>

      <div v-if="aiProviderTestResult" class="provider-test-result">
        <div><strong>测试结果：</strong>{{ aiProviderTestResult.success ? '成功' : '失败' }}</div>
        <div>Base URL：{{ aiProviderTestResult.resolvedBaseUrl }}</div>
        <div>Model：{{ aiProviderTestResult.resolvedModel }}</div>
        <div v-if="aiProviderTestResult.latencyMs !== undefined">耗时：{{ aiProviderTestResult.latencyMs }} ms</div>
      </div>

      <div class="action-row prompt-actions">
        <button @click="handleSaveAiProvider" :disabled="aiProviderSaving || aiProviderTesting || !!aiProviderValidationError || !aiProviderDirty" class="btn-worker">
          {{ aiProviderSaving ? '保存中...' : '保存配置' }}
        </button>
        <button @click="handleTestAiProvider" :disabled="aiProviderSaving || aiProviderTesting || !!aiProviderValidationError" class="btn-cancel">
          {{ aiProviderTesting ? '测试中...' : '测试连接' }}
        </button>
        <button @click="markAiProviderKeyForClear" :disabled="aiProviderSaving || aiProviderTesting || aiProviderSettings?.apiKeySource !== 'database'" class="btn-danger-sm">
          清空已保存 Key
        </button>
        <button class="btn-link" @click="discardAiProviderChanges" :disabled="aiProviderSaving || aiProviderTesting || !aiProviderDirty">放弃未保存修改</button>
      </div>
    </div>

    <div class="settings-card">
      <h3>AI Prompt 调优中心</h3>
      <p class="hint" style="margin-bottom:16px">在线编辑 Prompt override，保存后立即作用于运行中的 AI 流程。</p>

      <div v-if="promptMessage" :class="['message', promptMessageType]">{{ promptMessage }}</div>

      <div class="prompt-center">
        <div class="prompt-list">
          <button
            v-for="prompt in promptRecords"
            :key="prompt.key"
            type="button"
            class="prompt-list-item"
            :class="{ active: selectedPromptKey === prompt.key }"
            @click="selectPrompt(prompt.key)"
          >
            <div class="prompt-list-top">
              <strong>{{ prompt.label }}</strong>
              <span class="prompt-status" :class="promptStatusClass(prompt)">{{ promptStatusText(prompt) }}</span>
            </div>
            <div class="prompt-key">{{ prompt.key }}</div>
            <div class="prompt-desc">{{ prompt.description }}</div>
            <div class="prompt-updated">{{ prompt.updatedAt ? `更新于 ${formatTime(prompt.updatedAt)}` : '使用默认 Prompt' }}</div>
          </button>
        </div>

        <div v-if="selectedPrompt" class="prompt-editor">
          <div class="prompt-editor-head">
            <div>
              <h4>{{ selectedPrompt.label }}</h4>
              <p class="hint">{{ selectedPrompt.description }}</p>
            </div>
            <div class="prompt-editor-actions-top">
              <button class="btn-link" @click="discardPromptChanges" :disabled="promptSaving || !promptDirty">放弃未保存修改</button>
            </div>
          </div>

          <div class="form-group">
            <label>Required placeholders</label>
            <div class="placeholder-list">
              <code v-for="placeholder in selectedPrompt.requiredPlaceholders" :key="placeholder">{{ placeholder }}</code>
            </div>
          </div>

          <div class="form-group">
            <label>Override Prompt</label>
            <textarea
              v-model="promptDraft"
              class="prompt-textarea"
              rows="16"
              :disabled="promptSaving"
              placeholder="输入 override Prompt 内容"
            ></textarea>
          </div>

          <div v-if="promptValidationError" class="message error">{{ promptValidationError }}</div>

          <div class="action-row prompt-actions">
            <button @click="handleSavePrompt(true)" :disabled="promptSaving || !canSavePrompt" class="btn-worker">
              {{ promptSaving ? '保存中...' : '保存 override' }}
            </button>
            <button @click="handleSavePrompt(false)" :disabled="promptSaving || !canSavePrompt" class="btn-cancel">
              保存并禁用 override
            </button>
            <button
              v-if="selectedPrompt.isOverridden"
              @click="handleTogglePromptEnabled"
              :disabled="promptSaving"
              class="toggle-btn"
              :class="{ active: selectedPrompt.enabled }"
            >
              {{ selectedPrompt.enabled ? '已启用 override' : '已禁用 override' }}
            </button>
            <button
              v-if="selectedPrompt.isOverridden"
              @click="handleResetPrompt"
              :disabled="promptSaving"
              class="btn-danger-sm"
            >
              重置为默认
            </button>
          </div>

          <details class="prompt-default-panel">
            <summary>查看默认 Prompt</summary>
            <textarea class="prompt-textarea readonly" :value="selectedPrompt.defaultContent" rows="12" readonly></textarea>
          </details>
        </div>
      </div>
    </div>

    <div class="settings-card">
      <h3>外部执行任务</h3>
      <p class="hint" style="margin-bottom:16px">LifeOS 负责发起任务与落地结果，按需调用 AI 或外部执行器完成。</p>

      <div class="worker-form">
        <div class="form-group">
          <label>任务指令</label>
          <textarea v-model="workerInstruction" rows="3" placeholder="输入自然语言指令，例如：搜索最近一周 AI Agent 领域的重要进展并整理" :disabled="workerSubmitting"></textarea>
        </div>
        <div class="form-group">
          <label>结果归档维度（可选）</label>
          <select v-model="workerDimension" :disabled="workerSubmitting">
            <option value="learning">学习</option>
            <option value="career">事业</option>
            <option value="finance">财务</option>
            <option value="health">健康</option>
            <option value="relationship">关系</option>
            <option value="life">生活</option>
            <option value="hobby">兴趣</option>
            <option value="growth">成长</option>
          </select>
        </div>
      </div>

      <div class="action-row">
        <button @click="handleCreateWorkerTask" :disabled="workerSubmitting || !workerInstruction.trim()" class="btn-worker">
          {{ workerSubmitting ? '执行中...' : '执行任务' }}
        </button>
        <span v-if="workerSubmitting" class="queue-info">正在执行任务...</span>
      </div>

      <div v-if="workerMessage" :class="['message', workerMessageType]">{{ workerMessage }}</div>

      <div class="worker-list">
        <div class="worker-header-row">
          <h4>最近任务</h4>
          <div class="worker-header-actions">
            <select v-model="workerFilterStatus" class="worker-filter" @change="loadWorkerTasks">
              <option value="">全部状态</option>
              <option value="pending">等待执行</option>
              <option value="running">执行中</option>
              <option value="succeeded">已完成</option>
              <option value="failed">失败</option>
              <option value="cancelled">已取消</option>
            </select>
            <select v-model="workerFilterTaskType" class="worker-filter" @change="loadWorkerTasks">
              <option value="">全部任务</option>
              <option value="openclaw_task">OpenClaw 任务</option>
              <option value="summarize_note">笔记摘要</option>
              <option value="classify_inbox">Inbox 自动整理</option>
              <option value="extract_tasks">提取行动项</option>
              <option value="daily_report">每日回顾</option>
              <option value="weekly_report">每周回顾</option>
            </select>
            <button class="btn-link" @click="loadWorkerTasks">刷新</button>
            <button class="btn-link btn-clear" @click="handleClearFinishedTasks">清除已结束</button>
          </div>
        </div>
        <div v-if="workerTasks.length">
          <WorkerTaskCard
            v-for="task in workerTasks"
            :key="task.id"
            :task="task"
            :busy="workerActionTaskId === task.id"
            :show-source-note="true"
            @open-detail="openWorkerTaskDetail"
            @open-output="openWorkerOutput"
            @cancel="handleCancelWorkerTask"
            @retry="handleRetryWorkerTask"
          >
            <template #extra-actions>
              <button
                v-if="task.outputNotes?.length"
                type="button"
                class="wtc-action jump"
                @click="jumpToSearch(task.outputNotes[0])"
              >
                去搜索页查看
              </button>
            </template>
          </WorkerTaskCard>
        </div>
        <div v-else class="worker-empty-state">
          当前筛选下没有任务
        </div>
      </div>
    </div>

    <div class="settings-card reintegration-card">
      <div class="reintegration-head">
        <div>
          <h3>Reintegration Review</h3>
          <p class="hint reintegration-subtitle">在 settings 中直接复核终态 worker 回流记录，accept 时显示自动规划出的 PR6 promotion actions。</p>
        </div>
        <div class="reintegration-head-actions">
          <select v-model="reintegrationFilterStatus" class="worker-filter" @change="loadReintegrationRecords">
            <option value="">全部状态</option>
            <option value="pending_review">待复核</option>
            <option value="accepted">已接受</option>
            <option value="rejected">已拒绝</option>
          </select>
          <button class="btn-link" @click="loadReintegrationRecords">刷新</button>
        </div>
      </div>

      <div class="reintegration-summary-strip">
        <div class="reintegration-summary-item">
          <span>待复核</span>
          <strong>{{ reintegrationStatusSummary.pending_review }}</strong>
        </div>
        <div class="reintegration-summary-item">
          <span>已接受</span>
          <strong>{{ reintegrationStatusSummary.accepted }}</strong>
        </div>
        <div class="reintegration-summary-item">
          <span>已拒绝</span>
          <strong>{{ reintegrationStatusSummary.rejected }}</strong>
        </div>
      </div>

      <div v-if="reintegrationMessage" :class="['message', reintegrationMessageType]">{{ reintegrationMessage }}</div>

      <div v-if="reintegrationLoading" class="worker-empty-state">加载中...</div>
      <div v-else-if="reintegrationRecords.length" class="reintegration-list">
        <article v-for="record in reintegrationRecords" :key="record.id" class="reintegration-item">
          <div class="reintegration-item-top">
            <div class="reintegration-item-title-row">
              <strong>{{ taskTypeLabel(record.taskType) }}</strong>
              <span class="prompt-status" :class="reintegrationStatusClass(record.reviewStatus)">{{ reintegrationStatusText(record.reviewStatus) }}</span>
              <span class="worker-pill">{{ record.signalKind }}</span>
              <span class="worker-pill">{{ record.strength }}</span>
            </div>
            <button class="btn-link" @click="toggleReintegrationExpanded(record.id)">
              {{ reintegrationExpandedIds.includes(record.id) ? '收起详情' : '展开详情' }}
            </button>
          </div>

          <p class="reintegration-summary-text">{{ record.summary }}</p>

          <div class="reintegration-meta-grid">
            <span>Worker: {{ record.workerTaskId }}</span>
            <span>Target: {{ record.target }}</span>
            <span>创建于 {{ formatTime(record.createdAt) }}</span>
            <span v-if="record.reviewedAt">复核于 {{ formatTime(record.reviewedAt) }}</span>
          </div>

          <div class="reintegration-reason-row">
            <input
              v-model="reintegrationReasonDrafts[record.id]"
              type="text"
              class="reintegration-reason-input"
              placeholder="可选：输入 accept/reject 理由"
              :disabled="reintegrationActionId === record.id"
            />
            <button
              class="btn-worker"
              :disabled="reintegrationActionId === record.id || record.reviewStatus !== 'pending_review'"
              @click="handleAcceptReintegration(record)"
            >
              {{ reintegrationActionId === record.id ? '处理中...' : '接受并自动规划' }}
            </button>
            <button
              class="btn-cancel"
              :disabled="reintegrationActionId === record.id || record.reviewStatus !== 'pending_review'"
              @click="handleRejectReintegration(record)"
            >
              拒绝
            </button>
            <button
              class="btn-link"
              :disabled="reintegrationActionId === record.id || record.reviewStatus !== 'accepted'"
              @click="handlePlanReintegration(record)"
            >
              手动补规划
            </button>
          </div>

          <div v-if="record.reviewReason" class="reintegration-review-reason">
            复核理由：{{ record.reviewReason }}
          </div>

          <div v-if="reintegrationExpandedIds.includes(record.id)" class="reintegration-expanded">
            <div class="reintegration-evidence-block">
              <div class="reintegration-section-label">Evidence</div>
              <pre>{{ JSON.stringify(record.evidence, null, 2) }}</pre>
            </div>

            <div v-if="reintegrationPlannedActions[record.id]?.length" class="reintegration-actions-block">
              <div class="reintegration-section-label">Planned promotion actions</div>
              <div class="reintegration-actions-list">
                <div v-for="action in reintegrationPlannedActions[record.id]" :key="action.id" class="reintegration-action-item">
                  <div>
                    <strong>{{ promotionActionLabel(action.actionKind) }}</strong>
                    <div class="reintegration-action-meta">{{ action.id }}</div>
                  </div>
                  <span class="prompt-status default">{{ action.governanceStatus }}</span>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>
      <div v-else class="worker-empty-state">
        当前筛选下没有 reintegration records
      </div>
    </div>

    <div class="settings-card">
      <h3>定时任务</h3>
      <p class="hint" style="margin-bottom:16px">配置周期性自动执行的任务，如每天定时采集热门新闻。</p>

      <div class="schedule-form">
        <div class="form-group">
          <label>名称</label>
          <input v-model="scheduleLabel" type="text" placeholder="例如：每日新闻采集" :disabled="scheduleSubmitting" />
        </div>
        <div class="form-group">
          <label>任务类型</label>
          <select v-model="scheduleTaskType" :disabled="scheduleSubmitting">
            <option value="openclaw_task">OpenClaw 通用任务</option>
            <option value="classify_inbox">Inbox 自动整理</option>
            <option value="daily_report">每日回顾</option>
            <option value="weekly_report">每周回顾</option>
          </select>
        </div>
        <div class="form-group">
          <label>执行频率</label>
          <select v-model="schedulePreset" :disabled="scheduleSubmitting">
            <option value="0 9 * * *">每天 9:00</option>
            <option value="0 */12 * * *">每 12 小时</option>
            <option value="0 9 * * 1-5">工作日 9:00</option>
            <option value="0 9 * * 1">每周一 9:00</option>
            <option value="custom">自定义</option>
          </select>
        </div>
        <div v-if="schedulePreset === 'custom'" class="form-group">
          <label>Cron 表达式</label>
          <input v-model="scheduleCronCustom" type="text" placeholder="例如：*/5 * * * *" :disabled="scheduleSubmitting" />
        </div>
      </div>

      <div v-if="scheduleTaskType === 'openclaw_task'" class="schedule-form" style="margin-top:8px">
        <div class="form-group">
          <label>任务指令</label>
          <textarea v-model="scheduleInstruction" rows="3" placeholder="输入自然语言指令" :disabled="scheduleSubmitting"></textarea>
        </div>
        <div class="form-group">
          <label>结果归档维度（可选）</label>
          <select v-model="scheduleDimension" :disabled="scheduleSubmitting">
            <option value="learning">学习</option>
            <option value="career">事业</option>
            <option value="finance">财务</option>
            <option value="health">健康</option>
            <option value="relationship">关系</option>
            <option value="life">生活</option>
            <option value="hobby">兴趣</option>
            <option value="growth">成长</option>
          </select>
        </div>
      </div>

      <div class="action-row" style="margin-top:12px">
        <button @click="handleCreateSchedule" :disabled="scheduleSubmitting || !scheduleLabel.trim()" class="btn-worker">
          {{ scheduleSubmitting ? '创建中...' : '创建定时任务' }}
        </button>
      </div>

      <div v-if="scheduleMessage" :class="['message', scheduleMessageType]">{{ scheduleMessage }}</div>

      <div class="worker-list">
        <h4>定时任务列表</h4>
        <div v-if="schedules.length">
          <div v-for="s in schedules" :key="s.id" class="schedule-item">
            <!-- Edit mode -->
            <div v-if="editingScheduleId === s.id" class="schedule-edit-form">
              <div class="schedule-form">
                <div class="form-group">
                  <label>名称</label>
                  <input v-model="editLabel" type="text" />
                </div>
                <div class="form-group">
                  <label>执行频率</label>
                  <select v-model="editCronPreset">
                    <option value="0 9 * * *">每天 9:00</option>
                    <option value="0 */12 * * *">每 12 小时</option>
                    <option value="0 9 * * 1-5">工作日 9:00</option>
                    <option value="0 9 * * 1">每周一 9:00</option>
                    <option value="0 22 * * *">每天 22:00</option>
                    <option value="custom">自定义</option>
                  </select>
                </div>
                <div v-if="editCronPreset === 'custom'" class="form-group">
                  <label>Cron 表达式</label>
                  <input v-model="editCronCustom" type="text" placeholder="例如：*/5 * * * *" />
                </div>
              </div>
              <div class="action-row" style="margin-top:8px">
                <button class="btn-worker" @click="handleSaveScheduleEdit(s.id)" :disabled="!editLabel.trim()">保存</button>
                <button class="btn-cancel" @click="editingScheduleId = null">取消</button>
              </div>
            </div>
            <!-- Display mode -->
            <template v-else>
            <div class="schedule-item-top">
              <div class="schedule-info">
                <span class="schedule-label">{{ s.label }}</span>
                <span class="worker-pill">{{ taskTypeLabel(s.taskType) }}</span>
                <span class="worker-pill">{{ s.cronExpression }}</span>
              </div>
              <div class="schedule-actions">
                <button
                  class="btn-run-now"
                  :disabled="scheduleRunningId === s.id"
                  @click="handleRunScheduleNow(s.id)"
                >
                  {{ scheduleRunningId === s.id ? '执行中...' : '立即执行' }}
                </button>
                <button class="btn-edit-sm" @click="startEditSchedule(s)">编辑</button>
                <button
                  class="toggle-btn"
                  :class="{ active: s.enabled }"
                  @click="handleToggleSchedule(s)"
                >
                  {{ s.enabled ? '已启用' : '已禁用' }}
                </button>
                <button class="btn-danger-sm" @click="handleDeleteSchedule(s.id)">删除</button>
              </div>
            </div>
            <div class="schedule-meta">
              <span v-if="s.lastRunAt">上次执行: {{ formatTime(s.lastRunAt) }}</span>
              <span v-else>尚未执行</span>
              <span v-if="s.consecutiveFailures" class="schedule-failures">
                · 连续失败 {{ s.consecutiveFailures }} 次
              </span>
            </div>
            <div v-if="s.lastError" class="schedule-error">{{ s.lastError }}</div>
            </template>
          </div>
        </div>
        <div v-else class="worker-empty-state">暂无定时任务</div>
      </div>
    </div>

    <details class="settings-card manual-task-collapse">
      <summary class="manual-task-summary">
        <h3>手动任务入口</h3>
        <span class="manual-task-badge">补充入口</span>
      </summary>
      <p class="hint" style="margin-top:12px;margin-bottom:16px">主入口已统一走 worker task；这里保留一个手动创建 Inbox 整理任务的快捷入口。</p>
      <div class="action-row">
        <button @click="handleClassifyInbox" :disabled="classifying" class="btn-ai">
          {{ classifying ? '创建中...' : '手动整理 Inbox（创建任务）' }}
        </button>
        <span v-if="classifying" class="queue-info">正在创建 worker task...</span>
      </div>
      <div v-if="aiMessage" :class="['message', aiMessageType]">{{ aiMessage }}</div>
    </details>

    <div class="settings-card">
      <h3>隐私与安全</h3>

      <!-- Privacy mode -->
      <div class="security-row">
        <div>
          <div class="security-label">隐私模式</div>
          <div class="security-hint">开启后隐藏 private/sensitive 内容，适合分享屏幕时使用</div>
        </div>
        <button class="toggle-btn" :class="{ active: privacyMode }" @click="togglePrivacyMode">
          {{ privacyMode ? '已开启' : '已关闭' }}
        </button>
      </div>

      <!-- PIN setup -->
      <div class="security-row">
        <div>
          <div class="security-label">PIN 锁定</div>
          <div class="security-hint">{{ pinEnabled ? '已设置 PIN，打开看板需要验证' : '未设置 PIN，任何人都可以直接访问' }}</div>
        </div>
        <div class="security-actions">
          <button v-if="pinEnabled" class="btn-danger-sm" @click="confirmClearPin">取消 PIN</button>
          <button class="toggle-btn" :class="{ active: pinEnabled }" @click="showPinSetup = !showPinSetup">
            {{ pinEnabled ? '修改 PIN' : '设置 PIN' }}
          </button>
        </div>
      </div>

      <!-- PIN setup form -->
      <div v-if="showPinSetup" class="pin-setup">
        <div class="form-group">
          <label>新 PIN（4-6 位数字）</label>
          <input v-model="newPin" type="password" inputmode="numeric" maxlength="6" placeholder="输入 PIN" />
        </div>
        <div class="form-group">
          <label>确认 PIN</label>
          <input v-model="confirmPin" type="password" inputmode="numeric" maxlength="6" placeholder="再次输入 PIN" />
        </div>
        <div class="security-question-section">
          <p class="section-label">密保问题（可选，用于重置 PIN）</p>
          <div class="form-group">
            <label>密保问题</label>
            <select v-model="securityQuestion">
              <option value="">不设置密保问题</option>
              <option value="你的出生城市是？">你的出生城市是？</option>
              <option value="你的第一个宠物叫什么？">你的第一个宠物叫什么？</option>
              <option value="你母亲的姓氏是？">你母亲的姓氏是？</option>
              <option value="你小学的名字是？">你小学的名字是？</option>
              <option value="你最喜欢的书是？">你最喜欢的书是？</option>
              <option value="custom">自定义问题...</option>
            </select>
          </div>
          <div v-if="securityQuestion === 'custom'" class="form-group">
            <label>自定义问题</label>
            <input v-model="customQuestion" type="text" placeholder="输入你的密保问题" />
          </div>
          <div v-if="securityQuestion && securityQuestion !== 'custom'" class="form-group">
            <label>答案</label>
            <input v-model="securityAnswer" type="text" placeholder="输入答案（不区分大小写）" />
          </div>
          <div v-else-if="securityQuestion === 'custom' && customQuestion" class="form-group">
            <label>答案</label>
            <input v-model="securityAnswer" type="text" placeholder="输入答案（不区分大小写）" />
          </div>
        </div>
        <div v-if="pinSetupError" class="message error">{{ pinSetupError }}</div>
        <div class="action-row">
          <button class="btn-reindex" @click="handleSetPin" :disabled="!newPin || newPin !== confirmPin || newPin.length < 4">
            保存 PIN
          </button>
        </div>
      </div>

      <!-- Auto-lock timeout -->
      <div v-if="pinEnabled" class="security-row">
        <div>
          <div class="security-label">自动锁定</div>
          <div class="security-hint">无操作后自动锁定</div>
        </div>
        <select v-model="lockTimeout" @change="saveLockTimeout" class="timeout-select">
          <option value="0">永不</option>
          <option value="15">15 分钟</option>
          <option value="60">1 小时</option>
        </select>
      </div>

      <!-- PIN feedback message -->
      <div v-if="pinMessage" :class="['message', pinMessageType]">{{ pinMessage }}</div>
    </div>

    <!-- Clear PIN confirmation -->
    <Teleport to="body">
      <div v-if="showClearConfirm" class="confirm-overlay" @click.self="showClearConfirm = false">
        <div class="confirm-card">
          <h3>取消 PIN 锁定</h3>
          <p>取消后任何人都可以直接访问看板，确认继续？</p>
          <div class="confirm-actions">
            <button class="btn-cancel" @click="showClearConfirm = false">取消</button>
            <button class="btn-confirm-danger" @click="handleClearPin">确认取消</button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <NoteDetail v-if="selectedNoteId" :note-id="selectedNoteId" @close="selectedNoteId = null" />
    </Teleport>

    <Teleport to="body">
      <WorkerTaskDetail v-if="selectedWorkerTaskId" :task-id="selectedWorkerTaskId" @close="selectedWorkerTaskId = null" />
    </Teleport>

    <div class="settings-card">
      <h3>系统信息</h3>
      <div class="info-row">
        <span class="label">服务端口</span>
        <span class="value">{{ config?.port || '-' }}</span>
      </div>
      <div class="info-row">
        <span class="label">当前 Vault</span>
        <span class="value">{{ config?.vaultPath || '-' }}</span>
      </div>
      <div class="info-row">
        <span class="label">WebSocket</span>
        <span :class="['value', isConnected ? 'ws-on' : 'ws-off']">
          {{ isConnected ? '已连接' : '已断开' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import NoteDetail from '../components/NoteDetail.vue';
import WorkerTaskDetail from '../components/WorkerTaskDetail.vue';
import WorkerTaskCard from '../components/WorkerTaskCard.vue';
import PrivacyMask from '../components/PrivacyMask.vue';
import { fetchConfig, updateConfig, triggerIndex, fetchIndexStatus, fetchIndexErrors, classifyInbox, createWorkerTask, fetchWorkerTasks, retryWorkerTask, cancelWorkerTask, clearFinishedWorkerTasks, createTaskSchedule, fetchTaskSchedules, updateTaskSchedule, deleteTaskSchedule, runTaskScheduleNow, fetchAiPrompts, updateAiPrompt, resetAiPrompt, fetchAiProviderSettings, updateAiProviderSettings, testAiProviderConnection, fetchReintegrationRecords, acceptReintegrationRecord, rejectReintegrationRecord, planReintegrationPromotions, type Config, type IndexResult, type IndexStatus, type IndexError } from '../api/client';
import type { WorkerTask, WorkerTaskOutputNote, TaskSchedule, PromptKey, PromptRecord, AiProviderSettings, TestAiProviderConnectionResponse, WsEvent, ReintegrationRecord, SoulAction } from '@lifeos/shared';
import { useWebSocket, isIndexRefreshEvent } from '../composables/useWebSocket';
import { usePrivacy } from '../composables/usePrivacy';

const router = useRouter();
const { isConnected } = useWebSocket();
const { privacyMode, pinEnabled, togglePrivacyMode, setupPin, clearPin } = usePrivacy();

// PIN setup
const showPinSetup = ref(false);
const newPin = ref('');
const confirmPin = ref('');
const pinSetupError = ref('');
const lockTimeout = ref(localStorage.getItem('pin_timeout') || '15');
const showClearConfirm = ref(false);
const pinMessage = ref('');
const pinMessageType = ref<'success' | 'error'>('success');
const securityQuestion = ref('');
const customQuestion = ref('');
const securityAnswer = ref('');

async function handleSetPin() {
  if (newPin.value.length < 4) { pinSetupError.value = 'PIN 至少 4 位'; return; }
  if (newPin.value !== confirmPin.value) { pinSetupError.value = '两次输入不一致'; return; }

  const finalQuestion = securityQuestion.value === 'custom' ? customQuestion.value : securityQuestion.value;
  const finalAnswer = securityAnswer.value;

  if (finalQuestion && !finalAnswer) {
    pinSetupError.value = '请输入密保问题的答案';
    return;
  }

  await setupPin(newPin.value, finalQuestion || undefined, finalAnswer || undefined);
  newPin.value = '';
  confirmPin.value = '';
  securityQuestion.value = '';
  customQuestion.value = '';
  securityAnswer.value = '';
  pinSetupError.value = '';
  showPinSetup.value = false;
  showPinMessage('PIN 已设置' + (finalQuestion ? '（含密保问题）' : ''), 'success');
}

function confirmClearPin() {
  showClearConfirm.value = true;
}

function handleClearPin() {
  clearPin();
  showPinSetup.value = false;
  showClearConfirm.value = false;
  showPinMessage('PIN 已取消', 'success');
}

function saveLockTimeout() {
  localStorage.setItem('pin_timeout', lockTimeout.value);
  showPinMessage('自动锁定设置已保存', 'success');
}

function showPinMessage(msg: string, type: 'success' | 'error') {
  pinMessage.value = msg;
  pinMessageType.value = type;
  setTimeout(() => { pinMessage.value = ''; }, 3000);
}

const config = ref<Config | null>(null);
const vaultPath = ref('');
const saving = ref(false);
const reindexing = ref(false);
const message = ref('');
const messageType = ref<'success' | 'error'>('success');
const indexResult = ref<IndexResult | null>(null);
const indexStatus = ref<IndexStatus | null>(null);
const indexErrors = ref<IndexError[]>([]);
const aiProviderSettings = ref<AiProviderSettings | null>(null);
const aiProviderBaseUrl = ref('');
const aiProviderModel = ref('');
const aiProviderEnabled = ref(true);
const aiProviderApiKey = ref('');
const aiProviderSaving = ref(false);
const aiProviderTesting = ref(false);
const aiProviderMessage = ref('');
const aiProviderMessageType = ref<'success' | 'error'>('success');
const aiProviderTestResult = ref<TestAiProviderConnectionResponse | null>(null);
const aiProviderClearKeyPending = ref(false);
const classifying = ref(false);
const aiMessage = ref('');
const aiMessageType = ref<'success' | 'error'>('success');
const workerSubmitting = ref(false);
const workerTasks = ref<WorkerTask[]>([]);
const workerMessage = ref('');
const workerMessageType = ref<'success' | 'error'>('success');
const workerActionTaskId = ref<string | null>(null);
const selectedNoteId = ref<string | null>(null);
const selectedWorkerTaskId = ref<string | null>(null);
const workerInstruction = ref('');
const workerDimension = ref('learning');
const workerFilterStatus = ref('');
const workerFilterTaskType = ref('');
const promptRecords = ref<PromptRecord[]>([]);
const selectedPromptKey = ref<PromptKey | null>(null);
const promptDraft = ref('');
const promptSaving = ref(false);
const promptMessage = ref('');
const promptMessageType = ref<'success' | 'error'>('success');

// Schedule state
const schedules = ref<TaskSchedule[]>([]);
const reintegrationRecords = ref<ReintegrationRecord[]>([]);
const reintegrationFilterStatus = ref<'' | ReintegrationRecord['reviewStatus']>('pending_review');
const reintegrationLoading = ref(false);
const reintegrationMessage = ref('');
const reintegrationMessageType = ref<'success' | 'error'>('success');
const reintegrationActionId = ref<string | null>(null);
const reintegrationReasonDrafts = ref<Record<string, string>>({});
const reintegrationPlannedActions = ref<Record<string, SoulAction[]>>({});
const reintegrationExpandedIds = ref<string[]>([]);
const scheduleLabel = ref('');
const scheduleTaskType = ref<'openclaw_task' | 'summarize_note' | 'classify_inbox' | 'daily_report' | 'weekly_report'>('openclaw_task');
const schedulePreset = ref('0 9 * * *');
const scheduleCronCustom = ref('');
const scheduleInstruction = ref('');
const scheduleDimension = ref('learning');
const scheduleSubmitting = ref(false);
const scheduleMessage = ref('');
const scheduleMessageType = ref<'success' | 'error'>('success');
const scheduleRunningId = ref<string | null>(null);
const editingScheduleId = ref<string | null>(null);
const editLabel = ref('');
const editCronPreset = ref('');
const editCronCustom = ref('');

const selectedPrompt = computed(() => promptRecords.value.find(prompt => prompt.key === selectedPromptKey.value) || null);
const promptValidationError = computed(() => {
  const prompt = selectedPrompt.value;
  const content = promptDraft.value.trim();
  if (!prompt) return '';
  if (!content) return 'Prompt 内容不能为空';
  const missing = prompt.requiredPlaceholders.filter(placeholder => !content.includes(placeholder));
  return missing.length ? `缺少占位符：${missing.join(', ')}` : '';
});
const promptDirty = computed(() => {
  const prompt = selectedPrompt.value;
  if (!prompt) return false;
  return promptDraft.value !== (prompt.overrideContent ?? prompt.defaultContent);
});
const canSavePrompt = computed(() => !!selectedPrompt.value && !promptValidationError.value);
const aiProviderStatusText = computed(() => {
  if (!aiProviderSettings.value) return '加载中';
  if (!aiProviderSettings.value.enabled) return '已禁用';
  if (!aiProviderSettings.value.hasApiKey) return '缺少 API Key';
  return '已配置';
});
const aiProviderStatusClass = computed(() => {
  if (!aiProviderSettings.value) return 'default';
  if (!aiProviderSettings.value.enabled) return 'disabled';
  if (!aiProviderSettings.value.hasApiKey) return 'warning';
  return 'overridden';
});
const aiProviderSourceText = computed(() => {
  const source = aiProviderSettings.value?.apiKeySource;
  if (source === 'database') return '数据库';
  if (source === 'env') return '环境变量';
  return '未配置';
});
const aiProviderValidationError = computed(() => {
  if (!aiProviderBaseUrl.value.trim()) return 'Base URL 不能为空';
  try {
    const parsed = new URL(aiProviderBaseUrl.value.trim());
    if (!parsed.protocol.startsWith('http')) {
      return 'Base URL 必须是 http/https';
    }
  } catch {
    return 'Base URL 必须是合法 URL';
  }
  if (!aiProviderModel.value.trim()) return 'Model 不能为空';
  return '';
});
const aiProviderDirty = computed(() => {
  const current = aiProviderSettings.value;
  if (!current) return false;
  return aiProviderBaseUrl.value !== current.baseUrl
    || aiProviderModel.value !== current.model
    || aiProviderEnabled.value !== current.enabled
    || !!aiProviderApiKey.value.trim()
    || aiProviderClearKeyPending.value;
});
const reintegrationStatusSummary = computed(() => {
  return reintegrationRecords.value.reduce((acc, record) => {
    acc[record.reviewStatus] += 1;
    return acc;
  }, {
    pending_review: 0,
    accepted: 0,
    rejected: 0,
  } as Record<ReintegrationRecord['reviewStatus'], number>);
});

async function loadStatus() {
  try {
    indexStatus.value = await fetchIndexStatus();
    indexErrors.value = await fetchIndexErrors();
  } catch (_) { /* ignore */ }
}

async function loadWorkerTasks() {
  try {
    workerTasks.value = await fetchWorkerTasks(8, {
      status: (workerFilterStatus.value || undefined) as any,
      taskType: (workerFilterTaskType.value || undefined) as any,
    });
  } catch (_) { /* ignore */ }
}

async function loadSchedules() {
  try {
    schedules.value = await fetchTaskSchedules();
  } catch (_) { /* ignore */ }
}

async function loadReintegrationRecords() {
  reintegrationLoading.value = true;
  try {
    reintegrationRecords.value = await fetchReintegrationRecords(reintegrationFilterStatus.value || undefined);
  } catch (e: any) {
    reintegrationMessage.value = e.message || '加载 reintegration records 失败';
    reintegrationMessageType.value = 'error';
  } finally {
    reintegrationLoading.value = false;
  }
}

async function loadPrompts() {
  try {
    promptRecords.value = await fetchAiPrompts();
    if (!selectedPromptKey.value && promptRecords.value.length) {
      selectedPromptKey.value = promptRecords.value[0].key;
    }
    syncPromptDraft();
  } catch (e: any) {
    promptMessage.value = e.message || '加载 Prompt 失败';
    promptMessageType.value = 'error';
  }
}

async function loadAiProviderSettings() {
  try {
    aiProviderSettings.value = await fetchAiProviderSettings();
    resetAiProviderDraft();
  } catch (e: any) {
    aiProviderMessage.value = e.message || '加载 AI Provider 配置失败';
    aiProviderMessageType.value = 'error';
  }
}

function resetAiProviderDraft() {
  if (!aiProviderSettings.value) return;
  aiProviderBaseUrl.value = aiProviderSettings.value.baseUrl;
  aiProviderModel.value = aiProviderSettings.value.model;
  aiProviderEnabled.value = aiProviderSettings.value.enabled;
  aiProviderApiKey.value = '';
  aiProviderClearKeyPending.value = false;
}

function markAiProviderKeyForClear() {
  aiProviderApiKey.value = '';
  aiProviderClearKeyPending.value = true;
}

function buildAiProviderPayload() {
  return {
    baseUrl: aiProviderBaseUrl.value.trim(),
    model: aiProviderModel.value.trim(),
    enabled: aiProviderEnabled.value,
    ...(aiProviderApiKey.value.trim() ? { apiKey: aiProviderApiKey.value.trim() } : {}),
    ...(aiProviderClearKeyPending.value ? { clearApiKey: true } : {}),
  };
}

async function handleSaveAiProvider() {
  if (aiProviderValidationError.value) {
    aiProviderMessage.value = aiProviderValidationError.value;
    aiProviderMessageType.value = 'error';
    return;
  }
  aiProviderSaving.value = true;
  aiProviderMessage.value = '';
  try {
    aiProviderSettings.value = await updateAiProviderSettings(buildAiProviderPayload());
    resetAiProviderDraft();
    aiProviderTestResult.value = null;
    aiProviderMessage.value = aiProviderEnabled.value ? 'AI Provider 配置已保存并立即生效' : 'AI Provider 已保存为禁用状态';
    aiProviderMessageType.value = 'success';
  } catch (e: any) {
    aiProviderMessage.value = e.message || '保存 AI Provider 配置失败';
    aiProviderMessageType.value = 'error';
  } finally {
    aiProviderSaving.value = false;
  }
}

async function handleTestAiProvider() {
  if (aiProviderValidationError.value) {
    aiProviderMessage.value = aiProviderValidationError.value;
    aiProviderMessageType.value = 'error';
    return;
  }
  aiProviderTesting.value = true;
  aiProviderMessage.value = '';
  aiProviderTestResult.value = null;
  try {
    aiProviderTestResult.value = await testAiProviderConnection(buildAiProviderPayload());
    aiProviderMessage.value = aiProviderTestResult.value.message;
    aiProviderMessageType.value = aiProviderTestResult.value.success ? 'success' : 'error';
  } catch (e: any) {
    aiProviderMessage.value = e.message || '测试连接失败';
    aiProviderMessageType.value = 'error';
  } finally {
    aiProviderTesting.value = false;
  }
}

function discardAiProviderChanges() {
  resetAiProviderDraft();
  aiProviderTestResult.value = null;
  aiProviderMessage.value = '已放弃未保存修改';
  aiProviderMessageType.value = 'success';
}

function selectPrompt(key: PromptKey) {
  selectedPromptKey.value = key;
  syncPromptDraft();
  promptMessage.value = '';
}

function syncPromptDraft() {
  const prompt = selectedPrompt.value;
  if (!prompt) return;
  promptDraft.value = prompt.overrideContent ?? prompt.defaultContent;
}

function promptStatusText(prompt: PromptRecord) {
  if (!prompt.isOverridden) return '默认';
  return prompt.enabled ? '已覆盖' : '已禁用覆盖';
}

function promptStatusClass(prompt: PromptRecord) {
  if (!prompt.isOverridden) return 'default';
  return prompt.enabled ? 'overridden' : 'disabled';
}

function reintegrationStatusText(status: ReintegrationRecord['reviewStatus']) {
  if (status === 'pending_review') return '待复核';
  if (status === 'accepted') return '已接受';
  return '已拒绝';
}

function reintegrationStatusClass(status: ReintegrationRecord['reviewStatus']) {
  if (status === 'accepted') return 'overridden';
  if (status === 'rejected') return 'disabled';
  return 'warning';
}

function promotionActionLabel(actionKind: SoulAction['actionKind']) {
  if (actionKind === 'promote_event_node') return '生成 Event Node';
  if (actionKind === 'promote_continuity_record') return '生成 Continuity Record';
  if (actionKind === 'create_event_node') return '创建 Event Node';
  if (actionKind === 'update_persona_snapshot') return '更新 Persona Snapshot';
  return '提取行动项';
}

function toggleReintegrationExpanded(id: string) {
  if (reintegrationExpandedIds.value.includes(id)) {
    reintegrationExpandedIds.value = reintegrationExpandedIds.value.filter((item) => item !== id);
    return;
  }
  reintegrationExpandedIds.value = [...reintegrationExpandedIds.value, id];
}

async function handleAcceptReintegration(record: ReintegrationRecord) {
  reintegrationActionId.value = record.id;
  reintegrationMessage.value = '';
  try {
    const result = await acceptReintegrationRecord(record.id, {
      reason: reintegrationReasonDrafts.value[record.id]?.trim() || undefined,
    });
    reintegrationPlannedActions.value = {
      ...reintegrationPlannedActions.value,
      [record.id]: result.soulActions,
    };
    reintegrationExpandedIds.value = reintegrationExpandedIds.value.includes(record.id)
      ? reintegrationExpandedIds.value
      : [...reintegrationExpandedIds.value, record.id];
    reintegrationMessage.value = result.soulActions.length
      ? `已接受并自动规划 ${result.soulActions.length} 条 promotion actions`
      : '已接受，但当前没有可规划的 promotion actions';
    reintegrationMessageType.value = 'success';
    await loadReintegrationRecords();
  } catch (e: any) {
    reintegrationMessage.value = e.message || '接受 reintegration record 失败';
    reintegrationMessageType.value = 'error';
  } finally {
    reintegrationActionId.value = null;
  }
}

async function handleRejectReintegration(record: ReintegrationRecord) {
  reintegrationActionId.value = record.id;
  reintegrationMessage.value = '';
  try {
    await rejectReintegrationRecord(record.id, {
      reason: reintegrationReasonDrafts.value[record.id]?.trim() || undefined,
    });
    reintegrationMessage.value = '已拒绝该 reintegration record';
    reintegrationMessageType.value = 'success';
    await loadReintegrationRecords();
  } catch (e: any) {
    reintegrationMessage.value = e.message || '拒绝 reintegration record 失败';
    reintegrationMessageType.value = 'error';
  } finally {
    reintegrationActionId.value = null;
  }
}

async function handlePlanReintegration(record: ReintegrationRecord) {
  reintegrationActionId.value = record.id;
  reintegrationMessage.value = '';
  try {
    const soulActions = await planReintegrationPromotions(record.id);
    reintegrationPlannedActions.value = {
      ...reintegrationPlannedActions.value,
      [record.id]: soulActions,
    };
    reintegrationExpandedIds.value = reintegrationExpandedIds.value.includes(record.id)
      ? reintegrationExpandedIds.value
      : [...reintegrationExpandedIds.value, record.id];
    reintegrationMessage.value = soulActions.length
      ? `已规划 ${soulActions.length} 条 promotion actions`
      : '当前没有可规划的 promotion actions';
    reintegrationMessageType.value = 'success';
    await loadReintegrationRecords();
  } catch (e: any) {
    reintegrationMessage.value = e.message || '手动规划 promotion actions 失败';
    reintegrationMessageType.value = 'error';
  } finally {
    reintegrationActionId.value = null;
  }
}

function discardPromptChanges() {
  syncPromptDraft();
  promptMessage.value = '已放弃未保存修改';
  promptMessageType.value = 'success';
}

async function handleSavePrompt(enabled: boolean) {
  const prompt = selectedPrompt.value;
  if (!prompt) return;
  promptSaving.value = true;
  promptMessage.value = '';
  try {
    await updateAiPrompt(prompt.key, { content: promptDraft.value, enabled });
    await loadPrompts();
    selectedPromptKey.value = prompt.key;
    syncPromptDraft();
    promptMessage.value = enabled ? 'Prompt override 已保存并启用' : 'Prompt override 已保存但未启用';
    promptMessageType.value = 'success';
  } catch (e: any) {
    promptMessage.value = e.message || '保存 Prompt 失败';
    promptMessageType.value = 'error';
  } finally {
    promptSaving.value = false;
  }
}

async function handleTogglePromptEnabled() {
  const prompt = selectedPrompt.value;
  if (!prompt || !prompt.isOverridden) return;
  promptSaving.value = true;
  promptMessage.value = '';
  try {
    await updateAiPrompt(prompt.key, {
      content: prompt.overrideContent || promptDraft.value,
      enabled: !prompt.enabled,
      notes: prompt.notes ?? null,
    });
    await loadPrompts();
    selectedPromptKey.value = prompt.key;
    syncPromptDraft();
    promptMessage.value = !prompt.enabled ? 'Override 已启用' : 'Override 已禁用，运行时将回退默认 Prompt';
    promptMessageType.value = 'success';
  } catch (e: any) {
    promptMessage.value = e.message || '切换 override 状态失败';
    promptMessageType.value = 'error';
  } finally {
    promptSaving.value = false;
  }
}

async function handleResetPrompt() {
  const prompt = selectedPrompt.value;
  if (!prompt) return;
  promptSaving.value = true;
  promptMessage.value = '';
  try {
    await resetAiPrompt(prompt.key);
    await loadPrompts();
    selectedPromptKey.value = prompt.key;
    syncPromptDraft();
    promptMessage.value = '已恢复默认 Prompt';
    promptMessageType.value = 'success';
  } catch (e: any) {
    promptMessage.value = e.message || '重置 Prompt 失败';
    promptMessageType.value = 'error';
  } finally {
    promptSaving.value = false;
  }
}

async function handleCreateSchedule() {
  scheduleSubmitting.value = true;
  scheduleMessage.value = '';
  try {
    const cronExpr = schedulePreset.value === 'custom' ? scheduleCronCustom.value : schedulePreset.value;
    let input: any = undefined;
    if (scheduleTaskType.value === 'openclaw_task') {
      input = { instruction: scheduleInstruction.value.trim(), outputDimension: scheduleDimension.value };
    }
    // classify_inbox, daily_report, weekly_report use default inputs (no extra config needed)
    await createTaskSchedule({
      taskType: scheduleTaskType.value,
      cronExpression: cronExpr,
      label: scheduleLabel.value.trim(),
      input,
    });
    scheduleMessage.value = '定时任务已创建';
    scheduleMessageType.value = 'success';
    scheduleLabel.value = '';
    await loadSchedules();
  } catch (e: any) {
    scheduleMessage.value = e.message || '创建失败';
    scheduleMessageType.value = 'error';
  } finally {
    scheduleSubmitting.value = false;
  }
}

async function handleToggleSchedule(s: TaskSchedule) {
  try {
    await updateTaskSchedule(s.id, { enabled: !s.enabled });
    await loadSchedules();
  } catch (e: any) {
    scheduleMessage.value = e.message || '操作失败';
    scheduleMessageType.value = 'error';
  }
}

async function handleDeleteSchedule(id: string) {
  try {
    await deleteTaskSchedule(id);
    await loadSchedules();
  } catch (e: any) {
    scheduleMessage.value = e.message || '删除失败';
    scheduleMessageType.value = 'error';
  }
}

const KNOWN_CRONS = ['0 9 * * *', '0 */12 * * *', '0 9 * * 1-5', '0 9 * * 1', '0 22 * * *'];

function startEditSchedule(s: TaskSchedule) {
  editingScheduleId.value = s.id;
  editLabel.value = s.label;
  if (KNOWN_CRONS.includes(s.cronExpression)) {
    editCronPreset.value = s.cronExpression;
    editCronCustom.value = '';
  } else {
    editCronPreset.value = 'custom';
    editCronCustom.value = s.cronExpression;
  }
}

async function handleSaveScheduleEdit(id: string) {
  try {
    const cronExpr = editCronPreset.value === 'custom' ? editCronCustom.value : editCronPreset.value;
    await updateTaskSchedule(id, {
      label: editLabel.value.trim(),
      cronExpression: cronExpr,
    });
    editingScheduleId.value = null;
    scheduleMessage.value = '定时任务已更新';
    scheduleMessageType.value = 'success';
    await loadSchedules();
  } catch (e: any) {
    scheduleMessage.value = e.message || '更新失败';
    scheduleMessageType.value = 'error';
  }
}

async function handleRunScheduleNow(id: string) {
  scheduleRunningId.value = id;
  scheduleMessage.value = '';
  try {
    await runTaskScheduleNow(id);
    scheduleMessage.value = '已触发立即执行';
    scheduleMessageType.value = 'success';
    await loadSchedules();
    await loadWorkerTasks();
  } catch (e: any) {
    scheduleMessage.value = e.message || '执行失败';
    scheduleMessageType.value = 'error';
  } finally {
    scheduleRunningId.value = null;
  }
}

onMounted(async () => {
  try {
    config.value = await fetchConfig();
    vaultPath.value = config.value.vaultPath;
  } catch (e) {
    message.value = '加载配置失败';
    messageType.value = 'error';
  }
  await loadStatus();
  await loadWorkerTasks();
  await loadSchedules();
  await loadReintegrationRecords();
  await loadPrompts();
  await loadAiProviderSettings();
  document.addEventListener('ws-update', handleWsUpdate);
});

onUnmounted(() => {
  document.removeEventListener('ws-update', handleWsUpdate);
});

function handleWsUpdate(event: Event) {
  const wsEvent = (event as CustomEvent<WsEvent>).detail;
  loadStatus();
  if (wsEvent.type === 'worker-task-updated' || isIndexRefreshEvent(wsEvent)) {
    loadWorkerTasks();
  }
  if (wsEvent.type === 'schedule-updated') {
    loadSchedules();
  }
  if (wsEvent.type === 'worker-task-updated') {
    loadReintegrationRecords();
  }
}

async function handleSave() {
  saving.value = true;
  message.value = '';
  indexResult.value = null;

  try {
    const result = await updateConfig(vaultPath.value);
    config.value = { ...config.value!, vaultPath: vaultPath.value };
    indexResult.value = result.indexResult;
    message.value = 'Vault 路径已更新，索引完成';
    messageType.value = 'success';
  } catch (e: any) {
    message.value = e.message || '保存失败';
    messageType.value = 'error';
  } finally {
    saving.value = false;
  }
}

async function handleClassifyInbox() {
  classifying.value = true;
  aiMessage.value = '';
  try {
    await classifyInbox();
    aiMessage.value = 'Inbox 整理任务已创建，可在上方最近任务中查看状态与输出';
    aiMessageType.value = 'success';
    await loadWorkerTasks();
  } catch (e: any) {
    aiMessage.value = e.message || 'Inbox 整理任务创建失败';
    aiMessageType.value = 'error';
  } finally {
    classifying.value = false;
  }
}

async function handleCreateWorkerTask() {
  workerSubmitting.value = true;
  workerMessage.value = '';
  try {
    await createWorkerTask({
      taskType: 'openclaw_task',
      input: {
        instruction: workerInstruction.value.trim(),
        outputDimension: workerDimension.value,
      },
    });
    workerMessage.value = '任务已创建，正在后台执行';
    workerMessageType.value = 'success';
    await loadWorkerTasks();
  } catch (e: any) {
    workerMessage.value = e.message || '外部任务执行失败';
    workerMessageType.value = 'error';
  } finally {
    workerSubmitting.value = false;
  }
}

async function handleRetryWorkerTask(taskId: string) {
  workerActionTaskId.value = taskId;
  workerMessage.value = '';
  try {
    await retryWorkerTask(taskId);
    workerMessage.value = '任务已重新加入执行队列';
    workerMessageType.value = 'success';
    await loadWorkerTasks();
  } catch (e: any) {
    workerMessage.value = e.message || '任务重试失败';
    workerMessageType.value = 'error';
  } finally {
    workerActionTaskId.value = null;
  }
}

async function handleCancelWorkerTask(taskId: string) {
  workerActionTaskId.value = taskId;
  workerMessage.value = '';
  try {
    await cancelWorkerTask(taskId);
    workerMessage.value = '任务已取消';
    workerMessageType.value = 'success';
    await loadWorkerTasks();
  } catch (e: any) {
    workerMessage.value = e.message || '任务取消失败';
    workerMessageType.value = 'error';
  } finally {
    workerActionTaskId.value = null;
  }
}

async function handleClearFinishedTasks() {
  workerMessage.value = '';
  try {
    const deleted = await clearFinishedWorkerTasks();
    workerMessage.value = deleted > 0 ? `已清除 ${deleted} 条任务记录` : '没有可清除的任务';
    workerMessageType.value = 'success';
    await loadWorkerTasks();
  } catch (e: any) {
    workerMessage.value = e.message || '清除失败';
    workerMessageType.value = 'error';
  }
}

function openWorkerTaskDetail(taskId: string) {
  selectedWorkerTaskId.value = taskId;
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function taskTypeLabel(taskType: string): string {
  const labels: Record<string, string> = {
    openclaw_task: 'OpenClaw 任务',
    summarize_note: '笔记摘要',
    classify_inbox: 'Inbox 整理',
    extract_tasks: '提取行动项',
    daily_report: '每日回顾',
    weekly_report: '每周回顾',
  };
  return labels[taskType] || taskType;
}

function openWorkerOutput(note: WorkerTaskOutputNote) {
  selectedNoteId.value = note.id;
}

function jumpToSearch(note: WorkerTaskOutputNote) {
  router.push({ path: '/search', query: { q: note.title } });
}

async function handleReindex() {
  reindexing.value = true;
  message.value = '';
  indexResult.value = null;

  try {
    indexResult.value = await triggerIndex();
    message.value = '重新索引完成';
    messageType.value = 'success';
    await loadStatus();
  } catch (e: any) {
    message.value = e.message || '索引失败';
    messageType.value = 'error';
  } finally {
    reindexing.value = false;
  }
}
</script>

<style scoped>
.settings-view {
  max-width: 800px;
  margin: 0 auto;
}

.settings-view h2 {
  font-size: 22px;
  margin-bottom: 20px;
}

.settings-card {
  background: var(--card-bg);
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px var(--shadow);
}

.settings-card h3 {
  font-size: 16px;
  margin-bottom: 16px;
  color: var(--text);
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  color: #555;
}

.input-row {
  display: flex;
  gap: 8px;
}

.input-row input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.input-row input:focus {
  outline: none;
  border-color: #409eff;
}

.input-row button {
  padding: 8px 16px;
  background: #409eff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
}

.input-row button:hover:not(:disabled) {
  background: #337ecc;
}

.input-row button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
}

.message {
  padding: 10px 14px;
  border-radius: 4px;
  font-size: 14px;
  margin-top: 12px;
}

.message.success {
  background: #f0f9eb;
  color: #67c23a;
  border: 1px solid #e1f3d8;
}

.message.error {
  background: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fde2e2;
}

.index-result {
  margin-top: 16px;
  padding: 12px;
  background: var(--meta-bg);
  border-radius: 4px;
}

.index-result h4 {
  font-size: 14px;
  margin-bottom: 8px;
  color: #555;
}

.stats-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.stat {
  font-size: 13px;
  color: var(--text-secondary);
}

.stat.indexed { color: #67c23a; }
.stat.skipped { color: #909399; }
.stat.deleted { color: #e6a23c; }
.stat.errors { color: #f56c6c; }

.prompt-center {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  gap: 16px;
}

.prompt-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.prompt-list-item {
  text-align: left;
  border: 1px solid var(--border-color, #e5e7eb);
  background: var(--card-bg);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
}

.prompt-list-item.active {
  border-color: #409eff;
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.15);
}

.prompt-list-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.prompt-key,
.prompt-updated {
  font-size: 12px;
  color: var(--text-muted);
}

.prompt-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 6px 0;
}

.prompt-status {
  font-size: 12px;
  border-radius: 999px;
  padding: 2px 8px;
}

.prompt-status.default {
  background: #f3f4f6;
  color: #6b7280;
}

.prompt-status.overridden {
  background: #ecfdf3;
  color: #16a34a;
}

.prompt-status.disabled {
  background: #fff7ed;
  color: #ea580c;
}

.prompt-status.warning {
  background: #fef3c7;
  color: #b45309;
}

.reintegration-card {
  border: 1px solid color-mix(in oklch, var(--border-color, #e5e7eb) 78%, oklch(62% 0.06 250) 22%);
  background:
    linear-gradient(180deg, color-mix(in oklch, var(--card-bg) 92%, oklch(96% 0.01 250) 8%), var(--card-bg));
}

.reintegration-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.reintegration-subtitle {
  margin-top: 4px;
  max-width: 56ch;
}

.reintegration-head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.reintegration-summary-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.reintegration-summary-item {
  padding: 10px 12px;
  border-radius: 10px;
  background: color-mix(in oklch, var(--meta-bg) 88%, oklch(97% 0.015 250) 12%);
  border: 1px solid color-mix(in oklch, var(--border-color, #e5e7eb) 82%, transparent);
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  color: var(--text-secondary);
}

.reintegration-summary-item strong {
  font-size: 18px;
  color: var(--text);
}

.reintegration-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reintegration-item {
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid color-mix(in oklch, var(--border-color, #e5e7eb) 84%, transparent);
  background: color-mix(in oklch, var(--card-bg) 94%, oklch(98% 0.01 250) 6%);
}

.reintegration-item-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.reintegration-item-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.reintegration-summary-text {
  margin: 10px 0 8px;
  color: var(--text);
  line-height: 1.55;
}

.reintegration-meta-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  font-size: 12px;
  color: var(--text-muted);
}

.reintegration-reason-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  gap: 8px;
  margin-top: 12px;
}

.reintegration-reason-input {
  min-width: 0;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid color-mix(in oklch, var(--border-color, #d1d5db) 85%, transparent);
  background: var(--card-bg);
  color: var(--text);
}

.reintegration-review-reason {
  margin-top: 10px;
  font-size: 13px;
  color: var(--text-secondary);
}

.reintegration-expanded {
  margin-top: 12px;
  display: grid;
  gap: 12px;
}

.reintegration-evidence-block,
.reintegration-actions-block {
  padding: 12px;
  border-radius: 10px;
  background: var(--meta-bg);
}

.reintegration-section-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.reintegration-evidence-block pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-secondary);
}

.reintegration-actions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reintegration-action-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: color-mix(in oklch, var(--card-bg) 90%, oklch(98% 0.01 250) 10%);
}

.reintegration-action-meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted);
  word-break: break-all;
}


.provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.provider-toggle-group {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-key-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.provider-key-meta :deep(.privacy-wrap) {
  display: inline-flex;
  width: auto;
}

.provider-key-meta :deep(.privacy-mask) {
  padding: 6px 10px;
  border-radius: 999px;
}

.provider-test-result {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  background: var(--meta-bg);
  font-size: 13px;
  color: var(--text-secondary);
  display: grid;
  gap: 6px;
}

.prompt-editor {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 16px;
  background: var(--card-bg);
}

.prompt-editor-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.prompt-editor-head h4 {
  margin: 0;
}

.placeholder-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.placeholder-list code {
  background: var(--meta-bg);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
}

.prompt-textarea {
  width: 100%;
  resize: vertical;
  min-height: 240px;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 12px;
  font-size: 13px;
  line-height: 1.5;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  background: var(--card-bg);
  color: var(--text);
}

.prompt-textarea.readonly {
  background: var(--meta-bg);
}

.prompt-default-panel {
  margin-top: 16px;
}

.prompt-default-panel summary {
  cursor: pointer;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.prompt-actions {
  flex-wrap: wrap;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
  font-size: 14px;
}

.info-row:last-child {
  border-bottom: none;
}

.info-row .label {
  color: var(--text-muted);
}

.info-row .value {
  color: var(--text);
  font-family: monospace;
}

.info-row .value.ws-on {
  color: #67c23a;
}

.info-row .value.ws-off {
  color: #f56c6c;
}

.action-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.btn-reindex {
  padding: 8px 16px;
  background: #409eff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-reindex:hover:not(:disabled) {
  background: #337ecc;
}

.btn-reindex:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.queue-info {
  font-size: 13px;
  color: #909399;
}

.error-log {
  margin-top: 16px;
}

.error-log h4 {
  font-size: 14px;
  color: #f56c6c;
  margin-bottom: 8px;
}

.error-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #fde2e2;
  border-radius: 4px;
  background: #fef0f0;
}

.error-item {
  display: flex;
  gap: 12px;
  padding: 6px 10px;
  font-size: 12px;
  border-bottom: 1px solid #fde2e2;
}

.error-item:last-child {
  border-bottom: none;
}

.error-time {
  color: #999;
  white-space: nowrap;
}

.error-path {
  color: #333;
  word-break: break-all;
}

.error-msg {
  color: #f56c6c;
  white-space: nowrap;
}

.btn-ai {
  padding: 8px 16px;
  background: #67c23a;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-worker {
  padding: 8px 16px;
  background: #409eff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-worker:hover:not(:disabled) { background: #337ecc; }
.btn-worker:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-ai:hover:not(:disabled) { background: #529b2e; }
.btn-ai:disabled { opacity: 0.6; cursor: not-allowed; }

.classify-result {
  margin-top: 16px;
  padding: 12px;
  background: var(--meta-bg);
  border-radius: 4px;
}

.classify-list {
  margin-top: 10px;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 4px;
}

.classify-item {
  display: flex;
  gap: 12px;
  padding: 6px 10px;
  font-size: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.classify-item:last-child { border-bottom: none; }
.classify-item.ok { background: #f0f9eb; }
.classify-item.fail { background: #fef0f0; }

.ci-file { color: #333; word-break: break-all; flex: 1; }
.ci-info { color: #67c23a; white-space: nowrap; }
.ci-error { color: #f56c6c; white-space: nowrap; }

.worker-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.worker-form .form-group {
  margin-bottom: 0;
}

.worker-form input,
.worker-form select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--surface);
  color: var(--text);
  box-sizing: border-box;
}

.worker-list {
  margin-top: 16px;
  display: grid;
  gap: 12px;
}

.worker-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.worker-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.worker-filter {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}

.worker-header-row h4 {
  margin: 0;
  font-size: 14px;
}

.btn-link {
  border: none;
  background: transparent;
  color: #409eff;
  cursor: pointer;
  padding: 0;
}

.btn-link.btn-clear {
  color: #f56c6c;
}

.worker-item {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  background: var(--meta-bg);
}

.worker-item-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.worker-status {
  font-size: 12px;
  text-transform: uppercase;
}

.worker-status.status-pending { color: #e6a23c; }
.worker-status.status-running { color: #409eff; }
.worker-status.status-succeeded { color: #67c23a; }
.worker-status.status-failed { color: #f56c6c; }
.worker-status.status-cancelled { color: #909399; }

.worker-empty-state {
  margin-top: 12px;
  padding: 16px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  background: var(--meta-bg);
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
}

.worker-meta-pills {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.worker-pill {
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 11px;
  font-family: monospace;
}

.worker-meta {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.worker-params,
.worker-finished {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.worker-summary {
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.worker-error {
  margin-top: 8px;
  font-size: 13px;
  color: #f56c6c;
}

.worker-output {
  margin-top: 8px;
  display: grid;
  gap: 8px;
}

.worker-output-note {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card-bg);
  cursor: pointer;
  text-align: left;
}

.worker-output-note:hover {
  border-color: #409eff;
}

.worker-output-title {
  font-size: 13px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.worker-output-file {
  font-size: 12px;
  color: var(--text-muted);
  font-family: monospace;
  flex-shrink: 0;
}

.worker-actions {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.btn-inline {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  cursor: pointer;
  font-size: 12px;
}

.btn-inline:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-retry-inline {
  color: #409eff;
  border-color: color-mix(in srgb, #409eff 30%, var(--border));
}

.btn-cancel-inline {
  color: #f56c6c;
  border-color: color-mix(in srgb, #f56c6c 30%, var(--border));
}

.btn-jump-inline {
  color: #67c23a;
  border-color: color-mix(in srgb, #67c23a 30%, var(--border));
}

/* Privacy & Security */
.security-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
}

.security-row:last-of-type { border-bottom: none; }

.security-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 4px;
}

.security-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.toggle-btn {
  flex-shrink: 0;
  padding: 6px 16px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.toggle-btn.active {
  border-color: color-mix(in srgb, var(--ok) 40%, var(--border));
  background: color-mix(in srgb, var(--ok) 12%, transparent);
  color: var(--ok);
}

.security-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn-danger-sm {
  padding: 6px 14px;
  border: 1px solid color-mix(in srgb, var(--danger) 30%, var(--border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  color: var(--danger);
  cursor: pointer;
  font-size: 12px;
}

.btn-edit-sm {
  padding: 6px 14px;
  border: 1px solid color-mix(in srgb, var(--signal) 30%, var(--border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--signal) 10%, transparent);
  color: var(--signal, #409eff);
  cursor: pointer;
  font-size: 12px;
}

.btn-edit-sm:hover {
  background: color-mix(in srgb, var(--signal) 20%, transparent);
}

.schedule-edit-form {
  padding: 12px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-muted) 40%, transparent);
}

.schedule-edit-form .btn-cancel {
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
  margin-left: 8px;
}

.schedule-edit-form .btn-cancel:hover {
  background: color-mix(in srgb, var(--text-muted) 10%, transparent);
}

.pin-setup {
  padding: 16px;
  margin-top: 8px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: color-mix(in srgb, var(--surface-muted) 60%, transparent);
  display: grid;
  gap: 12px;
}

.security-question-section {
  padding: 14px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--signal-soft) 50%, transparent);
  border: 1px solid color-mix(in srgb, var(--signal) 16%, var(--border));
  display: grid;
  gap: 10px;
}

.section-label {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--signal);
}

.timeout-select {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
}

.btn-danger {
  padding: 8px 16px;
  border: 1px solid color-mix(in srgb, var(--danger) 30%, var(--border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  color: var(--danger);
  cursor: pointer;
  font-size: 13px;
}

/* Clear PIN confirmation */
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 9100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(4, 11, 20, 0.6);
  backdrop-filter: blur(8px);
}

.confirm-card {
  padding: 28px;
  border: 1px solid var(--border-strong);
  border-radius: 24px;
  background: color-mix(in srgb, var(--surface-strong) 96%, transparent);
  box-shadow: 0 32px 64px -28px var(--shadow-strong);
  width: min(380px, 90vw);
  display: grid;
  gap: 14px;
}

.confirm-card h3 { margin: 0; font-size: 18px; }
.confirm-card p { margin: 0; color: var(--text-secondary); font-size: 14px; line-height: 1.6; }

.confirm-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 8px;
}

.btn-cancel, .btn-confirm-danger {
  padding: 8px 18px;
  border-radius: 999px;
  border: 1px solid var(--border);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-cancel {
  background: var(--surface-muted);
  color: var(--text-secondary);
}

.btn-cancel:hover {
  background: color-mix(in srgb, var(--surface-muted) 88%, white);
}

.btn-confirm-danger {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 28%, var(--border));
}

.btn-confirm-danger:hover {
  background: color-mix(in srgb, var(--danger) 20%, transparent);
}

.manual-task-collapse {
  border-color: color-mix(in srgb, var(--text-muted) 18%, var(--border));
  opacity: 0.75;
  transition: opacity 0.2s;
}

.manual-task-collapse[open] {
  opacity: 1;
}

.manual-task-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  list-style: none;
  user-select: none;
}

.manual-task-summary::-webkit-details-marker {
  display: none;
}

.manual-task-summary h3 {
  margin: 0;
}

.manual-task-badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  background: color-mix(in srgb, var(--text-muted) 14%, transparent);
  color: var(--text-muted);
  border: 1px solid color-mix(in srgb, var(--text-muted) 20%, var(--border));
}

.schedule-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.schedule-form .form-group {
  margin-bottom: 0;
}

.schedule-form input,
.schedule-form select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--surface);
  color: var(--text);
  box-sizing: border-box;
}

.schedule-item {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  background: var(--meta-bg);
  margin-top: 8px;
}

.schedule-item-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.schedule-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.schedule-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}

.schedule-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

.schedule-meta {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.btn-run-now {
  padding: 6px 14px;
  border: 1px solid color-mix(in srgb, #409eff 30%, var(--border));
  border-radius: 999px;
  background: color-mix(in srgb, #409eff 10%, transparent);
  color: #409eff;
  cursor: pointer;
  font-size: 12px;
}

.btn-run-now:hover:not(:disabled) {
  background: color-mix(in srgb, #409eff 18%, transparent);
}

.btn-run-now:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.schedule-failures {
  color: #f56c6c;
  font-weight: 500;
}

.schedule-error {
  margin-top: 4px;
  font-size: 12px;
  color: #f56c6c;
  word-break: break-all;
}
@media (max-width: 900px) {
  .reintegration-head {
    flex-direction: column;
  }

  .reintegration-summary-strip {
    grid-template-columns: 1fr;
  }

  .reintegration-reason-row {
    grid-template-columns: 1fr;
  }

  .reintegration-head-actions {
    width: 100%;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .prompt-center {
    grid-template-columns: 1fr;
  }
}

</style>
