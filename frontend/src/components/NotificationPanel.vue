<template>
  <el-dropdown trigger="click" @visible-change="handleVisibleChange" ref="dropdownRef">
    <div class="notification-bell" @click.stop>
      <el-badge :value="unreadCount" :hidden="unreadCount === 0" :max="99" class="notification-badge">
        <el-icon :size="20" class="bell-icon"><Bell /></el-icon>
      </el-badge>
    </div>
    <template #dropdown>
      <el-dropdown-menu class="notification-dropdown">
        <div class="notification-header">
          <span class="notification-title">通知中心</span>
          <div class="notification-actions">
            <el-button type="primary" link @click.stop="handleMarkAllRead" :disabled="unreadCount === 0">
              全部已读
            </el-button>
            <el-button type="primary" link @click.stop="goToNotifications">
              查看全部
            </el-button>
          </div>
        </div>
        <el-scrollbar max-height="360px" class="notification-scroll">
          <div v-if="loading" class="notification-loading">
            <el-icon class="is-loading" :size="24"><Loading /></el-icon>
            <span>加载中...</span>
          </div>
          <div v-else-if="recentNotifications.length === 0" class="notification-empty">
            <el-icon :size="48" class="empty-icon"><Document /></el-icon>
            <span>暂无通知</span>
          </div>
          <div
            v-for="item in recentNotifications"
            :key="item.id"
            class="notification-item"
            :class="{ unread: item.is_read === 0 }"
            @click.stop="handleItemClick(item)"
          >
            <div class="item-icon" :class="getTypeClass(item.type)">
              <el-icon :size="16">
                <component :is="getTypeIcon(item.type)" />
              </el-icon>
            </div>
            <div class="item-content">
              <div class="item-header">
                <span class="item-title">{{ item.title }}</span>
                <span class="item-time">{{ formatTime(item.created_at) }}</span>
              </div>
              <p class="item-summary">{{ item.summary }}</p>
            </div>
            <div class="item-status">
              <span v-if="item.is_read === 0" class="unread-dot"></span>
              <el-button
                v-if="item.is_read === 0"
                type="primary"
                link
                size="small"
                @click.stop="handleMarkRead(item.id)"
              >
                标为已读
              </el-button>
            </div>
          </div>
        </el-scrollbar>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Bell, Loading, Document, CircleCheck, Warning, InfoFilled } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import { useNotificationStore } from '@/stores/notification'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const router = useRouter()
const notificationStore = useNotificationStore()
const dropdownRef = ref(null)
const loading = ref(false)
let pollTimer = null

const unreadCount = computed(() => notificationStore.unreadCount)
const recentNotifications = computed(() => notificationStore.recentNotifications)

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

const formatTime = (time) => {
  return dayjs(time).fromNow()
}

const handleVisibleChange = (visible) => {
  if (visible) {
    loading.value = true
    notificationStore.fetchRecentNotifications(5).finally(() => {
      loading.value = false
    })
  }
}

const handleItemClick = async (item) => {
  if (item.is_read === 0) {
    await notificationStore.markNotificationRead(item.id)
  }
  if (item.related_type === 'pipeline' && item.related_id) {
    router.push(`/pipeline/flow/${item.related_id}`)
  } else if (item.related_type === 'run' && item.related_id) {
    router.push(`/monitor/detail/${item.related_id}`)
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

const handleMarkAllRead = async () => {
  try {
    await notificationStore.markAllRead()
    ElMessage.success('已全部标记为已读')
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const goToNotifications = () => {
  router.push('/notifications')
}

const startPolling = () => {
  pollTimer = setInterval(() => {
    notificationStore.fetchUnreadCount()
  }, 30000)
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onMounted(() => {
  notificationStore.fetchUnreadCount()
  startPolling()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.notification-bell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: var(--transition);
}

.notification-bell:hover {
  background: var(--bg-hover);
}

.bell-icon {
  color: var(--text-secondary);
  transition: var(--transition);
}

.notification-bell:hover .bell-icon {
  color: var(--text-primary);
}

.notification-badge :deep(.el-badge__content) {
  background: var(--danger);
  border: none;
}

.notification-dropdown {
  width: 380px;
  padding: 0;
  border-radius: var(--radius-md);
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.notification-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.notification-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.notification-actions {
  display: flex;
  gap: 8px;
}

.notification-scroll {
  max-height: 360px;
}

.notification-loading,
.notification-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-secondary);
  gap: 12px;
}

.empty-icon {
  opacity: 0.5;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: var(--transition);
  border-bottom: 1px solid var(--border-color);
}

.notification-item:last-child {
  border-bottom: none;
}

.notification-item:hover {
  background: var(--bg-hover);
}

.notification-item.unread {
  background: rgba(99, 102, 241, 0.08);
}

.item-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}

.item-icon.type-success {
  background: rgba(103, 194, 58, 0.15);
  color: var(--success);
}

.item-icon.type-error {
  background: rgba(245, 108, 108, 0.15);
  color: var(--danger);
}

.item-icon.type-info {
  background: rgba(64, 158, 255, 0.15);
  color: var(--primary);
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.item-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-time {
  font-size: 12px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.item-summary {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.item-status {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.unread-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--danger);
  flex-shrink: 0;
}
</style>
