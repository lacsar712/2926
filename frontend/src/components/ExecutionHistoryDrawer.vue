<template>
  <el-drawer
    v-model="visible"
    title="执行历史"
    direction="rtl"
    size="500px"
    :before-close="handleClose"
  >
    <div v-if="task" class="task-info">
      <h3>{{ task.name }}</h3>
      <div class="task-meta">
        <el-tag :type="envTagType(task.environment)" size="small">
          {{ envLabel(task.environment) }}
        </el-tag>
        <span class="cron-text">{{ task.cron_expression }}</span>
      </div>
    </div>

    <div class="history-list" v-loading="loading">
      <el-empty v-if="historyList.length === 0" description="暂无执行记录" />
      <div
        v-for="item in historyList"
        :key="item.id"
        class="history-item"
        :class="item.status"
      >
        <div class="item-header">
          <el-icon :size="16" class="status-icon" :class="item.status">
            <component :is="statusIcon(item.status)" />
          </el-icon>
          <span class="status-text">{{ statusLabel(item.status) }}</span>
          <span class="trigger-time">{{ formatTime(item.trigger_time) }}</span>
        </div>
        <div class="item-details">
          <div class="detail-row" v-if="item.retry_attempt > 0">
            <label>重试次数</label>
            <span>{{ item.retry_attempt }} 次</span>
          </div>
          <div class="detail-row" v-if="item.duration_seconds">
            <label>执行耗时</label>
            <span>{{ formatDuration(item.duration_seconds) }}</span>
          </div>
          <div class="detail-row" v-if="item.run_id">
            <label>运行ID</label>
            <el-link type="primary" @click="goToRunDetail(item.run_id)">
              #{{ item.run_id }}
            </el-link>
          </div>
          <div class="detail-row error" v-if="item.error_message">
            <label>错误信息</label>
            <span class="error-text">{{ item.error_message }}</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="handleClose">关闭</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  SuccessFilled,
  WarningFilled,
  CircleCheckFilled,
  Loading,
  Clock
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { getScheduleTaskHistory, getScheduleTaskDetail } from '@/api/schedule'
import { ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  taskId: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['update:modelValue'])

const router = useRouter()
const visible = ref(props.modelValue)
const loading = ref(false)
const task = ref(null)
const historyList = ref([])

watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val) {
    loadData()
  }
})

watch(visible, (val) => {
  emit('update:modelValue', val)
})

const loadData = async () => {
  try {
    loading.value = true
    const [taskRes, historyRes] = await Promise.all([
      getScheduleTaskDetail(props.taskId),
      getScheduleTaskHistory(props.taskId, 20)
    ])
    if (taskRes.success) {
      task.value = taskRes.data
    }
    if (historyRes.success) {
      historyList.value = historyRes.data
    }
  } catch (error) {
    ElMessage.error('加载执行历史失败')
  } finally {
    loading.value = false
  }
}

const statusIcon = (status) => {
  const map = {
    success: SuccessFilled,
    failed: WarningFilled,
    running: Loading,
    pending: Clock,
    timeout: WarningFilled
  }
  return map[status] || CircleCheckFilled
}

const statusLabel = (status) => {
  const map = {
    success: '执行成功',
    failed: '执行失败',
    running: '运行中',
    pending: '等待中',
    timeout: '执行超时'
  }
  return map[status] || status
}

const envLabel = (env) => {
  const map = { dev: '开发环境', test: '测试环境', prod: '生产环境' }
  return map[env] || env
}

const envTagType = (env) => {
  const map = { dev: 'info', test: 'warning', prod: 'danger' }
  return map[env] || 'info'
}

const formatTime = (time) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

const formatDuration = (seconds) => {
  if (seconds < 60) return `${seconds} 秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hours} 小时 ${mins} 分`
}

const goToRunDetail = (runId) => {
  router.push(`/monitor/detail/${runId}`)
}

const handleClose = () => {
  visible.value = false
}
</script>

<style scoped>
.task-info {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

.task-info h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: var(--text-primary);
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cron-text {
  font-family: monospace;
  font-size: 13px;
  color: var(--text-secondary);
}

.history-list {
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

.history-item {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 14px;
  margin-bottom: 12px;
  transition: all 0.2s;
}

.history-item:hover {
  border-color: var(--primary);
}

.history-item.success {
  border-left: 3px solid var(--success);
}

.history-item.failed,
.history-item.timeout {
  border-left: 3px solid var(--danger);
}

.history-item.running {
  border-left: 3px solid var(--primary);
}

.history-item.pending {
  border-left: 3px solid var(--warning);
}

.item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.status-icon {
  flex-shrink: 0;
}

.status-icon.success {
  color: var(--success);
}

.status-icon.failed,
.status-icon.timeout {
  color: var(--danger);
}

.status-icon.running {
  color: var(--primary);
  animation: spin 1s linear infinite;
}

.status-icon.pending {
  color: var(--warning);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-text {
  font-weight: 500;
  color: var(--text-primary);
}

.trigger-time {
  margin-left: auto;
  font-size: 13px;
  color: var(--text-secondary);
}

.item-details {
  padding-left: 24px;
}

.detail-row {
  display: flex;
  gap: 12px;
  margin-bottom: 6px;
  font-size: 13px;
}

.detail-row label {
  color: var(--text-secondary);
  min-width: 60px;
  flex-shrink: 0;
}

.detail-row span {
  color: var(--text-primary);
  flex: 1;
}

.detail-row.error .error-text {
  color: var(--danger);
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-all;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
