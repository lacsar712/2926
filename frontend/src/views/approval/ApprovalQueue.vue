<template>
  <div class="page-container" v-loading="loading">
    <div class="page-header fade-in-up">
      <h2 class="page-title">审批队列</h2>
    </div>

    <div class="stats-row fade-in-up">
      <div class="stat-chip" :class="{ active: tab === 'todo' }" @click="switchTab('todo')">
        <span class="chip-icon todo"><el-icon><CircleCheck /></el-icon></span>
        <div>
          <h4>{{ stats.todo || 0 }}</h4>
          <p>待我审批</p>
        </div>
      </div>
      <div class="stat-chip" :class="{ active: tab === 'done' }" @click="switchTab('done')">
        <span class="chip-icon done"><el-icon><Finished /></el-icon></span>
        <div>
          <h4>{{ stats.done || 0 }}</h4>
          <p>我已处理</p>
        </div>
      </div>
      <div class="stat-chip" :class="{ active: tab === 'mine' }" @click="switchTab('mine')">
        <span class="chip-icon mine"><el-icon><DocumentAdd /></el-icon></span>
        <div>
          <h4>{{ stats.mine || 0 }}</h4>
          <p>我提交的</p>
        </div>
      </div>
    </div>

    <div class="filter-bar fade-in-up">
      <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 140px" @change="loadList">
        <el-option label="待审批" value="pending" />
        <el-option label="已通过" value="approved" />
        <el-option label="已驳回" value="rejected" />
      </el-select>
      <el-button type="primary" plain @click="loadList"><el-icon><Refresh /></el-icon>刷新</el-button>
    </div>

    <div class="list-area fade-in-up">
      <div v-if="!loading && list.length === 0" class="empty-state">
        <el-icon :size="56" color="var(--text-secondary)"><Box /></el-icon>
        <p>暂无审批记录</p>
      </div>
      <div v-for="item in list" :key="item.id" class="approval-card">
        <div class="card-head">
          <div class="card-title-row">
            <h3>{{ item.title }}</h3>
            <el-tag :type="statusTagType(item.status)" effect="dark" round size="small">
              {{ statusLabel(item.status) }}
            </el-tag>
          </div>
          <div class="card-meta">
            <el-tag size="small" type="info" plain round>
              <el-icon style="margin-right: 4px;"><Tickets /></el-icon>
              {{ item.typeLabel }}
            </el-tag>
            <span><el-icon><UserFilled /></el-icon> 申请人：{{ item.applicant_name || '系统' }}</span>
            <span><el-icon><Clock /></el-icon>{{ formatDate(item.created_at) }}</span>
            <span v-if="item.status !== 'pending'"><el-icon><Checked /></el-icon>{{ formatDate(item.approved_at) }}</span>
          </div>
        </div>

        <div class="card-body">
          <div class="info-block">
            <div class="info-label">申请说明</div>
            <div class="info-content">{{ item.remark || '无' }}</div>
          </div>
          <div v-if="item.approve_remark && item.status !== 'pending'" class="info-block">
            <div class="info-label">审批意见</div>
            <div class="info-content">{{ item.approve_remark }}</div>
          </div>
          <div v-if="item.related_id" class="info-block">
            <div class="info-label">关联 ID</div>
            <div class="info-content">{{ item.related_id }}</div>
          </div>
        </div>

        <div v-if="tab === 'todo' && item.status === 'pending'" class="card-actions">
          <el-input
            v-model="remarkMap[item.id]"
            placeholder="填写审批意见（可选）"
            size="default"
            style="flex: 1"
          />
          <el-button type="danger" plain @click="onReject(item)">
            <el-icon><Close /></el-icon>驳回
          </el-button>
          <el-button type="primary" @click="onApprove(item)">
            <el-icon><Check /></el-icon>通过
          </el-button>
        </div>
      </div>
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import {
  getApprovalList,
  getApprovalStats,
  approveRecord,
  rejectRecord
} from '@/api/approval'

const loading = ref(false)
const list = ref([])
const stats = reactive({ todo: 0, done: 0, mine: 0 })
const total = ref(0)
const currentPage = ref(1)
const pageSize = 10
const tab = ref('todo')
const statusFilter = ref('')
const remarkMap = reactive({})

const statusLabel = (s) => ({ pending: '待审批', approved: '已通过', rejected: '已驳回' })[s] || s
const statusTagType = (s) => ({ pending: 'warning', approved: 'success', rejected: 'danger' })[s] || 'info'

const formatDate = (d) => d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-'

const loadStats = async () => {
  try {
    const res = await getApprovalStats()
    Object.assign(stats, res.data)
  } catch { /* handled */ }
}

const loadList = async () => {
  loading.value = true
  try {
    const params = { tab: tab.value, page: currentPage.value, pageSize }
    if (statusFilter.value) params.status = statusFilter.value
    const res = await getApprovalList(params)
    list.value = res.data.list
    total.value = res.data.total
  } catch { /* handled */ } finally { loading.value = false }
}

const switchTab = (t) => {
  tab.value = t
  currentPage.value = 1
  statusFilter.value = ''
  loadList()
}

const onApprove = async (item) => {
  try {
    await ElMessageBox.confirm(`确定通过「${item.title}」吗？`, '确认通过', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'success'
    })
  } catch { return }
  try {
    await approveRecord(item.id, remarkMap[item.id] || '')
    ElMessage.success('审批通过')
    remarkMap[item.id] = ''
    loadStats()
    loadList()
  } catch { /* handled */ }
}

const onReject = async (item) => {
  try {
    await ElMessageBox.prompt('请填写驳回原因', '确认驳回', {
      confirmButtonText: '确认驳回',
      cancelButtonText: '取消',
      type: 'warning',
      inputValue: remarkMap[item.id] || ''
    }).then(async ({ value }) => {
      await rejectRecord(item.id, value || '未填写驳回原因')
      ElMessage.success('已驳回')
      remarkMap[item.id] = ''
      loadStats()
      loadList()
    }).catch(() => {})
  } catch { /* handled */ }
}

onMounted(() => { loadStats(); loadList() })
</script>

<style scoped>
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-chip {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 18px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  transition: var(--transition);
}

.stat-chip:hover {
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-hover);
}

.stat-chip.active {
  border-color: var(--primary);
  background: rgba(99, 102, 241, 0.08);
}

.chip-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
}

.chip-icon.todo {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.chip-icon.done {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.chip-icon.mine {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
}

.stat-chip h4 {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 2px;
}

.stat-chip p {
  font-size: 12px;
  color: var(--text-secondary);
}

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.list-area {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 200px;
}

.empty-state {
  text-align: center;
  padding: 60px 0;
  color: var(--text-secondary);
}

.empty-state p { margin-top: 12px; }

.approval-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 20px 24px;
  transition: var(--transition);
}

.approval-card:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-hover);
}

.card-head { margin-bottom: 14px; }

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.card-title-row h3 {
  font-size: 16px;
  font-weight: 600;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
  color: var(--text-secondary);
}

.card-meta > * {
  display: flex;
  align-items: center;
  gap: 4px;
}

.card-body {
  border-top: 1px solid var(--border-color);
  padding-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-block {
  display: flex;
  gap: 12px;
  font-size: 13px;
}

.info-label {
  flex-shrink: 0;
  width: 80px;
  color: var(--text-secondary);
}

.info-content {
  flex: 1;
  color: var(--text-primary);
  line-height: 1.6;
}

.card-actions {
  border-top: 1px solid var(--border-color);
  padding-top: 14px;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.pagination-bar {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}

@media (max-width: 768px) {
  .stats-row { grid-template-columns: 1fr; }
  .card-actions { flex-direction: column; align-items: stretch; }
}
</style>
