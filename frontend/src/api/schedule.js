import api from '@/utils/request'

export const getScheduleTasks = (params) => {
  return api.get('/schedules', { params })
}

export const getScheduleTaskDetail = (id) => {
  return api.get(`/schedules/${id}`)
}

export const getScheduleTaskHistory = (id, limit = 20) => {
  return api.get(`/schedules/${id}/history`, { params: { limit } })
}

export const createScheduleTask = (data) => {
  return api.post('/schedules', data)
}

export const updateScheduleTask = (id, data) => {
  return api.put(`/schedules/${id}`, data)
}

export const toggleScheduleTask = (id) => {
  return api.patch(`/schedules/${id}/toggle`)
}

export const deleteScheduleTask = (id) => {
  return api.delete(`/schedules/${id}`)
}
