<template>
  <div class="notification-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">通知中心</h2>
        <p class="page-desc">共 {{ total }} 条通知，{{ unreadCount }} 条未读</p>
      </div>
      <div class="header-right">
        <el-button
          type="primary"
          :disabled="unreadCount === 0"
          @click="handleMarkAllRead"
        >
          <el-icon><Check /></el-icon>
          全部标为已读
        </el-button>
        <el-button
          type="danger"
          :disabled="!hasReadNotifications"
          @click="handleClearRead"
        >
          <el-icon><Delete /></el-icon>
          清空已读
        </el-button>
      </div>
    </div>

    <div class="filter-bar">
      <el-radio-group v-model="filterType" @change="handleFilterChange">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="publish_success">
          <el-icon><CircleCheck /></el-icon>
          发布成功
        </el-radio-button>
        <el-radio-button value="run_failed">
          <el-icon><Warning /></el-icon>
          运行失败
        </el-radio-button>
        <el-radio-button value="system">
          <el-icon><InfoFilled /></el-icon>
          系统消息
        </el-radio-button>
      </el-radio-group>

      <el-radio-group v-model="filterRead" @change="handleFilterChange">
        <el-radio-button value="">全部状态</el-radio-button>
        <el-radio-button value="0">未读</el-radio-button>
        <el-radio-button value="1">已读</el-radio-button>
      </el-radio-group>

      <el-button
        v-if="selectedIds.length > 0"
        type="primary"
        @click="handleBatchMarkRead"
      >
        已选 {{ selectedIds.length }} 条，标为已读
      </el-button>
    </div>

    <div class="notification-list" v-loading="loading">
      <div v-if="notificationList.length === 0 && !loading" class="empty-state">
        <el-icon :size="64" class="empty-icon"><Document /></el-icon>
        <p class="empty-text">暂无通知</p>
      </div>

      <div
        v-for="item in notificationList"
        :key="item.id"
        class="notification-card"
        :class="{ unread: item.is_read === 0, selected: selectedIds.includes(item.id) }"
      >
        <div class="card-checkbox">
          <el-checkbox
            :model-value="selectedIds.includes(item.id)"
            @change="(val) => handleSelectItem(item.id, val)"
          />
        </div>
        <div class="card-icon" :class="getTypeClass(item.type)">
          <el-icon :size="20">
            <component :is="getTypeIcon(item.type)" />
          </el-icon>
        </div>
        <div class="card-content">
          <div class="card-header">
            <h3 class="card-title" :class="{ 'title-unread': item.is_read === 0 }">
              {{ item.title }}
            </h3>
            <el-tag size="small" :type="getTagType(item.type)">
              {{ getTypeLabel(item.type) }}
            </el-tag>
          </div>
          <p class="card-summary">{{ item.summary }}</p>
          <div v-if="item.content" class="card-detail">
            <el-icon><ChatDotRound /></el-icon>
            <span>{{ item.content }}</span>
          </div>
          <div class="card-footer">
            <span class="card-time">
              <el-icon><Clock /></el-icon>
              {{ formatTime(item.created_at) }}
            </span>
            <div class="card-actions">
              <el-button
                v-if="item.is_read === 0"
                type="primary"
                link
                size="small"
                @click="handleMarkRead(item.id)"
              >
                标为已读
              </el-button>
              <el-button
                v-if="item.related_type && item.related_id"
                type="primary"
                link
                size="small"
                @click="handleViewRelated(item)"
              >
                查看详情
              </el-button>
            </div>
          </div>
        </div>
        <div v-if="item.is_read === 0" class="unread-indicator"></div>
      </div>
    </div>

    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handlePageChange"
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Check,
  Delete,
  CircleCheck,
  Warning,
  InfoFilled,
  Document,
  ChatDotRound,
  Clock
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useNotificationStore } from '@/stores/notification'
import { usePreferenceStore } from '@/stores/preference'

const router = useRouter()
const notificationStore = useNotificationStore()
const preferenceStore = usePreferenceStore()

const loading = computed(() => notificationStore.loading)
const notificationList = computed(() => notificationStore.notificationList)
const total = computed(() => notificationStore.total)
const unreadCount = computed(() => notificationStore.unreadCount)

const filterType = ref('')
const filterRead = ref('')
const page = ref(1)
const pageSize = ref(preferenceStore.pageSize)
const selectedIds = ref([])

const hasReadNotifications = computed(() => {
  return notificationList.value.some(n => n.is_read === 1)
})

const getTypeClass = (type) => {
  const map = {
    publish_success: 'type-success',
    run_failed: 'type-error',
    system: 'type-info'
  }
  return map[type] || 'type-info'
}

const getTypeIcon = (type) => {
  const map = {
    publish_success: CircleCheck,
    run_failed: Warning,
    system: InfoFilled
  }
  return map[type] || InfoFilled
}

const getTypeLabel = (type) => {
  const map = {
    publish_success: '发布成功',
    run_failed: '运行失败',
    system: '系统消息'
  }
  return map[type] || '系统消息'
}

const getTagType = (type) => {
  const map = {
    publish_success: 'success',
    run_failed: 'danger',
    system: 'info'
  }
  return map[type] || 'info'
}

const formatTime = (time) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

const fetchData = async () => {
  const params = {
    page: page.value,
    pageSize: pageSize.value
  }
  if (filterType.value) params.type = filterType.value
  if (filterRead.value !== '') params.isRead = filterRead.value
  
  await notificationStore.fetchNotificationList(params)
  selectedIds.value = []
}

const handleFilterChange = () => {
  page.value = 1
  fetchData()
}

const handlePageChange = () => {
  preferenceStore.setPageSize(pageSize.value)
  fetchData()
}

const handleSelectItem = (id, checked) => {
  if (checked) {
    if (!selectedIds.value.includes(id)) {
      selectedIds.value.push(id)
    }
  } else {
    selectedIds.value = selectedIds.value.filter(i => i !== id)
  }
}

const handleMarkRead = async (id) => {
  try {
    await notificationStore.markNotificationRead(id)
    ElMessage.success('已标记为已读')
  } catch (error) {
    ElMessage.error('标记失败')
  }
}

const handleBatchMarkRead = async () => {
  if (selectedIds.value.length === 0) return
  try {
    await notificationStore.markBatchRead([...selectedIds.value])
    ElMessage.success(`已将 ${selectedIds.value.length} 条通知标记为已读`)
    selectedIds.value = []
  } catch (error) {
    ElMessage.error('批量标记失败')
  }
}

const handleMarkAllRead = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要将所有通知标记为已读吗？',
      '确认操作',
      { type: 'warning' }
    )
    await notificationStore.markAllRead()
    ElMessage.success('已全部标记为已读')
    fetchData()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败')
    }
  }
}

const handleClearRead = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有已读通知吗？此操作不可恢复。',
      '确认操作',
      { type: 'warning' }
    )
    await notificationStore.clearRead()
    ElMessage.success('已清空已读通知')
    fetchData()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败')
    }
  }
}

const handleViewRelated = (item) => {
  if (item.is_read === 0) {
    notificationStore.markNotificationRead(item.id)
  }
  if (item.related_type === 'pipeline' && item.related_id) {
    router.push(`/pipeline/flow/${item.related_id}`)
  } else if (item.related_type === 'run' && item.related_id) {
    router.push(`/monitor/detail/${item.related_id}`)
  }
}

onMounted(() => {
  fetchData()
  notificationStore.fetchUnreadCount()
})
</script>

<style scoped>
.notification-page {
  padding: 24px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px 0;
}

.page-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

.header-right {
  display: flex;
  gap: 12px;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.notification-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  gap: 16px;
}

.empty-icon {
  opacity: 0.3;
}

.empty-text {
  font-size: 16px;
  margin: 0;
}

.notification-card {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  position: relative;
  transition: var(--transition);
}

.notification-card:hover {
  border-color: var(--primary-light);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.1);
}

.notification-card.unread {
  background: rgba(99, 102, 241, 0.06);
  border-left: 3px solid var(--primary);
}

.notification-card.selected {
  border-color: var(--primary);
  background: rgba(99, 102, 241, 0.08);
}

.card-checkbox {
  flex-shrink: 0;
  padding-top: 4px;
}

.card-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-icon.type-success {
  background: rgba(103, 194, 58, 0.15);
  color: var(--success);
}

.card-icon.type-error {
  background: rgba(245, 108, 108, 0.15);
  color: var(--danger);
}

.card-icon.type-info {
  background: rgba(64, 158, 255, 0.15);
  color: var(--primary);
}

.card-content {
  flex: 1;
  min-width: 0;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.card-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  margin: 0;
  flex: 1;
}

.title-unread {
  color: var(--text-primary);
  font-weight: 600;
}

.card-summary {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 8px 0;
  line-height: 1.6;
}

.card-detail {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 13px;
  color: var(--text-tertiary);
  margin-bottom: 12px;
  padding: 8px 12px;
  background: var(--bg-hover);
  border-radius: var(--radius-sm);
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-time {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.card-actions {
  display: flex;
  gap: 12px;
}

.unread-indicator {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--danger);
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  padding-top: 20px;
  margin-top: auto;
}
</style>
