<template>
  <div class="page-container">
    <div class="page-header fade-in-up">
      <h2 class="page-title">调度任务</h2>
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon>新建任务
      </el-button>
    </div>

    <div class="filter-bar fade-in-up">
      <el-input
        v-model="filters.keyword"
        placeholder="搜索任务名称/生产线..."
        clearable
        style="width: 280px"
        prefix-icon="Search"
        @clear="loadList"
        @keyup.enter="loadList"
      />
      <el-select
        v-model="filters.pipelineId"
        placeholder="生产线筛选"
        clearable
        style="width: 180px"
        @change="loadList"
      >
        <el-option
          v-for="p in pipelines"
          :key="p.id"
          :label="p.name"
          :value="p.id"
        />
      </el-select>
      <el-select
        v-model="filters.enabled"
        placeholder="状态筛选"
        clearable
        style="width: 140px"
        @change="loadList"
      >
        <el-option label="已启用" value="1" />
        <el-option label="已禁用" value="0" />
      </el-select>
      <el-button @click="loadList" type="primary" plain>
        <el-icon><Search /></el-icon>搜索
      </el-button>
    </div>

    <div class="table-container fade-in-up" v-loading="loading">
      <el-table :data="list" stripe style="width: 100%">
        <el-table-column prop="name" label="任务名称" min-width="160">
          <template #default="{ row }">
            <div class="task-name">
              <span class="name-text">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="pipeline_name" label="关联生产线" min-width="160">
          <template #default="{ row }">
            <el-link type="primary" @click="goToPipeline(row.pipeline_id)">
              {{ row.pipeline_name }}
            </el-link>
          </template>
        </el-table-column>

        <el-table-column prop="environment" label="环境" width="100">
          <template #default="{ row }">
            <el-tag :type="envTagType(row.environment)" size="small">
              {{ envLabel(row.environment) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="cron_expression" label="Cron表达式" width="140">
          <template #default="{ row }">
            <span class="cron-text">{{ row.cron_expression }}</span>
          </template>
        </el-table-column>

        <el-table-column label="启用状态" width="90">
          <template #default="{ row }">
            <el-switch
              v-model="row.enabled"
              :loading="toggleLoading[row.id]"
              @change="handleToggle(row)"
              active-color="#67C23A"
              inactive-color="#909399"
            />
          </template>
        </el-table-column>

        <el-table-column label="上次触发" width="160">
          <template #default="{ row }">
            <span v-if="row.last_run_time" class="time-text">
              {{ formatTime(row.last_run_time) }}
            </span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>

        <el-table-column label="下次触发" width="160">
          <template #default="{ row }">
            <span v-if="row.next_run_time && row.enabled" class="time-text next">
              {{ formatTime(row.next_run_time) }}
            </span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>

        <el-table-column label="最近结果" width="110">
          <template #default="{ row }">
            <div class="result-badge" :class="row.last_run_result">
              <el-icon :size="14"><component :is="resultIcon(row.last_run_result)" /></el-icon>
              <span>{{ resultLabel(row.last_run_result) }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openDialog(row)">
              <el-icon><Edit /></el-icon>编辑
            </el-button>
            <el-button type="success" link size="small" @click="openHistory(row.id)">
              <el-icon><Clock /></el-icon>历史
            </el-button>
            <el-popconfirm
              title="确认删除该调度任务？"
              @confirm="handleDelete(row.id)"
            >
              <template #reference>
                <el-button type="danger" link size="small">
                  <el-icon><Delete /></el-icon>删除
                </el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>

        <template #empty>
          <el-empty description="暂无调度任务" />
        </template>
      </el-table>
    </div>

    <div class="pagination-bar" v-if="total > pageSize">
      <el-pagination
        background
        layout="total, prev, pager, next"
        :total="total"
        :page-size="pageSize"
        v-model:current-page="currentPage"
        @current-change="loadList"
      />
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="editId ? '编辑调度任务' : '新建调度任务'"
      width="700px"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item label="任务名称" prop="name">
          <el-input
            v-model="form.name"
            placeholder="请输入任务名称"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="关联生产线" prop="pipelineId">
          <el-select
            v-model="form.pipelineId"
            placeholder="请选择生产线"
            style="width: 100%"
            filterable
          >
            <el-option
              v-for="p in pipelines"
              :key="p.id"
              :label="p.name"
              :value="p.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="运行环境" prop="environment">
          <el-radio-group v-model="form.environment">
            <el-radio value="dev">开发环境</el-radio>
            <el-radio value="test">测试环境</el-radio>
            <el-radio value="prod">生产环境</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="调度规则" prop="cronExpression">
          <CronHelper v-model="form.cronExpression" />
        </el-form-item>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="失败重试" prop="retryCount">
              <el-input-number
                v-model="form.retryCount"
                :min="0"
                :max="5"
                style="width: 100%"
              />
              <span class="form-tip">最多重试 0-5 次</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="超时时间" prop="timeoutMinutes">
              <el-input-number
                v-model="form.timeoutMinutes"
                :min="1"
                :max="1440"
                :step="5"
                style="width: 100%"
              />
              <span class="form-tip">单位：分钟，最长 24 小时</span>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="立即启用">
          <el-switch v-model="form.enabled" active-text="启用" inactive-text="不启用" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          确定
        </el-button>
      </template>
    </el-dialog>

    <ExecutionHistoryDrawer
      v-model="historyDrawerVisible"
      :task-id="selectedTaskId"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Plus,
  Search,
  Edit,
  Delete,
  Clock,
  SuccessFilled,
  WarningFilled,
  Loading,
  CircleCheckFilled
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import api from '@/utils/request'
import {
  getScheduleTasks,
  createScheduleTask,
  updateScheduleTask,
  toggleScheduleTask,
  deleteScheduleTask
} from '@/api/schedule'
import CronHelper from '@/components/CronHelper.vue'
import ExecutionHistoryDrawer from '@/components/ExecutionHistoryDrawer.vue'
import { usePreferenceStore } from '@/stores/preference'

const router = useRouter()
const preferenceStore = usePreferenceStore()

const loading = ref(false)
const submitting = ref(false)
const toggleLoading = reactive({})
const list = ref([])
const pipelines = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = computed(() => preferenceStore.pageSize)
const dialogVisible = ref(false)
const editId = ref(null)
const formRef = ref()
const historyDrawerVisible = ref(false)
const selectedTaskId = ref(null)

const filters = reactive({
  keyword: '',
  pipelineId: '',
  enabled: ''
})

const form = reactive({
  name: '',
  pipelineId: '',
  environment: 'test',
  cronExpression: '0 0 2 * * ?',
  enabled: true,
  retryCount: 0,
  timeoutMinutes: 60
})

const formRules = {
  name: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
  pipelineId: [{ required: true, message: '请选择生产线', trigger: 'change' }],
  cronExpression: [{ required: true, message: '请设置调度规则', trigger: 'change' }]
}

const envLabel = (env) => {
  const map = { dev: '开发', test: '测试', prod: '生产' }
  return map[env] || env
}

const envTagType = (env) => {
  const map = { dev: 'info', test: 'warning', prod: 'danger' }
  return map[env] || 'info'
}

const resultIcon = (result) => {
  const map = {
    success: SuccessFilled,
    failed: WarningFilled,
    running: Loading,
    none: CircleCheckFilled
  }
  return map[result] || CircleCheckFilled
}

const resultLabel = (result) => {
  const map = {
    success: '成功',
    failed: '失败',
    running: '运行中',
    none: '未执行'
  }
  return map[result] || '未知'
}

const formatTime = (time) => {
  return time ? dayjs(time).format('MM-DD HH:mm:ss') : '-'
}

const loadList = async () => {
  loading.value = true
  try {
    const res = await getScheduleTasks({
      ...filters,
      page: currentPage.value,
      pageSize: pageSize.value
    })
    if (res.success) {
      list.value = res.data.list
      total.value = res.data.total
    }
  } finally {
    loading.value = false
  }
}

const loadPipelines = async () => {
  try {
    const res = await api.get('/pipelines', { params: { pageSize: 100 } })
    if (res.success) {
      pipelines.value = res.data.list
    }
  } catch { /* handled */ }
}

const openDialog = (item) => {
  editId.value = item?.id || null
  form.name = item?.name || ''
  form.pipelineId = item?.pipeline_id || ''
  form.environment = item?.environment || 'test'
  form.cronExpression = item?.cron_expression || '0 0 2 * * ?'
  form.enabled = item?.enabled !== undefined ? item.enabled : true
  form.retryCount = item?.retry_count ?? 0
  form.timeoutMinutes = item?.timeout_minutes ?? 60
  dialogVisible.value = true
}

const handleSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const data = {
      name: form.name,
      pipelineId: form.pipelineId,
      environment: form.environment,
      cronExpression: form.cronExpression,
      enabled: form.enabled,
      retryCount: form.retryCount,
      timeoutMinutes: form.timeoutMinutes
    }

    if (editId.value) {
      await updateScheduleTask(editId.value, data)
      ElMessage.success('更新成功')
    } else {
      await createScheduleTask(data)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadList()
  } finally {
    submitting.value = false
  }
}

const handleToggle = async (row) => {
  toggleLoading[row.id] = true
  try {
    await toggleScheduleTask(row.id)
    ElMessage.success(row.enabled ? '已启用' : '已禁用')
    loadList()
  } catch {
    row.enabled = !row.enabled
  } finally {
    toggleLoading[row.id] = false
  }
}

const handleDelete = async (id) => {
  try {
    await deleteScheduleTask(id)
    ElMessage.success('删除成功')
    loadList()
  } catch { /* handled */ }
}

const openHistory = (taskId) => {
  selectedTaskId.value = taskId
  historyDrawerVisible.value = true
}

const goToPipeline = (pipelineId) => {
  router.push(`/pipeline/flow/${pipelineId}`)
}

onMounted(() => {
  loadList()
  loadPipelines()
})
</script>

<style scoped>
.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.table-container {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 16px;
  border: 1px solid var(--border-color);
}

.task-name .name-text {
  font-weight: 500;
  color: var(--text-primary);
}

.cron-text {
  font-family: monospace;
  font-size: 13px;
  color: var(--primary);
  background: rgba(99, 102, 241, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
}

.time-text {
  font-size: 13px;
  color: var(--text-secondary);
}

.time-text.next {
  color: var(--primary);
}

.text-muted {
  color: var(--text-placeholder);
}

.result-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.result-badge.success {
  background: rgba(103, 194, 58, 0.1);
  color: var(--success);
}

.result-badge.failed {
  background: rgba(245, 108, 108, 0.1);
  color: var(--danger);
}

.result-badge.running {
  background: rgba(64, 158, 255, 0.1);
  color: var(--primary);
}

.result-badge.none {
  background: rgba(144, 147, 153, 0.1);
  color: var(--text-secondary);
}

.result-badge.running .el-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.pagination-bar {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.form-tip {
  display: block;
  font-size: 12px;
  color: var(--text-placeholder);
  margin-top: 4px;
}
</style>
