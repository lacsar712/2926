import api from '@/utils/request'

export const getApprovalList = (params) => {
  return api.get('/approvals', { params })
}

export const getApprovalStats = () => {
  return api.get('/approvals/stats')
}

export const getApprovalDetail = (id) => {
  return api.get(`/approvals/${id}`)
}

export const approveRecord = (id, remark) => {
  return api.put(`/approvals/${id}/approve`, { remark })
}

export const rejectRecord = (id, remark) => {
  return api.put(`/approvals/${id}/reject`, { remark })
}

export const submitApproval = (data) => {
  return api.post('/approvals', data)
}
