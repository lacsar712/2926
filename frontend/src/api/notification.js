import api from '@/utils/request'

export const getNotifications = (params) => {
  return api.get('/notifications', { params })
}

export const getRecentNotifications = (limit = 5) => {
  return api.get('/notifications/recent', { params: { limit } })
}

export const getUnreadCount = () => {
  return api.get('/notifications/unread-count')
}

export const getNotificationDetail = (id) => {
  return api.get(`/notifications/${id}`)
}

export const markAsRead = (id) => {
  return api.put(`/notifications/${id}/read`)
}

export const markBatchAsRead = (ids) => {
  return api.put('/notifications/read-batch', { ids })
}

export const markAllAsRead = () => {
  return api.put('/notifications/read-all')
}

export const clearReadNotifications = () => {
  return api.delete('/notifications/clear-read')
}

export const deleteNotification = (id) => {
  return api.delete(`/notifications/${id}`)
}
