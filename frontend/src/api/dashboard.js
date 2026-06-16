import api from '@/utils/request'

export const getDashboardSummary = (params) => {
  return api.get('/dashboard/summary', { params })
}
