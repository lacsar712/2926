import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  getUnreadCount,
  getRecentNotifications,
  getNotifications,
  markAsRead,
  markBatchAsRead,
  markAllAsRead,
  clearReadNotifications
} from '@/api/notification'

export const useNotificationStore = defineStore('notification', () => {
  const unreadCount = ref(0)
  const recentNotifications = ref([])
  const notificationList = ref([])
  const total = ref(0)
  const loading = ref(false)

  const fetchUnreadCount = async () => {
    try {
      const res = await getUnreadCount()
      unreadCount.value = res.data.count
    } catch (error) {
      console.error('获取未读数量失败:', error)
    }
  }

  const fetchRecentNotifications = async (limit = 5) => {
    try {
      const res = await getRecentNotifications(limit)
      recentNotifications.value = res.data
    } catch (error) {
      console.error('获取最近通知失败:', error)
    }
  }

  const fetchNotificationList = async (params) => {
    loading.value = true
    try {
      const res = await getNotifications(params)
      notificationList.value = res.data.list
      total.value = res.data.total
    } catch (error) {
      console.error('获取通知列表失败:', error)
    } finally {
      loading.value = false
    }
  }

  const markNotificationRead = async (id) => {
    try {
      await markAsRead(id)
      const item = recentNotifications.value.find(n => n.id === id)
      if (item) item.is_read = 1
      const listItem = notificationList.value.find(n => n.id === id)
      if (listItem) listItem.is_read = 1
      if (unreadCount.value > 0) unreadCount.value--
    } catch (error) {
      console.error('标记已读失败:', error)
      throw error
    }
  }

  const markBatchRead = async (ids) => {
    try {
      await markBatchAsRead(ids)
      recentNotifications.value.forEach(n => {
        if (ids.includes(n.id)) n.is_read = 1
      })
      notificationList.value.forEach(n => {
        if (ids.includes(n.id)) n.is_read = 1
      })
      unreadCount.value = Math.max(0, unreadCount.value - ids.length)
    } catch (error) {
      console.error('批量标记已读失败:', error)
      throw error
    }
  }

  const markAllRead = async () => {
    try {
      await markAllAsRead()
      recentNotifications.value.forEach(n => n.is_read = 1)
      notificationList.value.forEach(n => n.is_read = 1)
      unreadCount.value = 0
    } catch (error) {
      console.error('标记全部已读失败:', error)
      throw error
    }
  }

  const clearRead = async () => {
    try {
      await clearReadNotifications()
      recentNotifications.value = recentNotifications.value.filter(n => n.is_read === 0)
      notificationList.value = notificationList.value.filter(n => n.is_read === 0)
    } catch (error) {
      console.error('清空已读失败:', error)
      throw error
    }
  }

  const setUnreadCount = (count) => {
    unreadCount.value = count
  }

  return {
    unreadCount,
    recentNotifications,
    notificationList,
    total,
    loading,
    fetchUnreadCount,
    fetchRecentNotifications,
    fetchNotificationList,
    markNotificationRead,
    markBatchRead,
    markAllRead,
    clearRead,
    setUnreadCount
  }
})
