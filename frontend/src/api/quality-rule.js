import api from '@/utils/request'

export const getQualityRules = (params) => {
  return api.get('/quality-rules', { params })
}

export const getQualityRuleDetail = (id) => {
  return api.get(`/quality-rules/${id}`)
}

export const getQualityRuleReferences = (ruleId) => {
  return api.get('/quality-rules/references', { params: { ruleId } })
}

export const createQualityRule = (data) => {
  return api.post('/quality-rules', data)
}

export const updateQualityRule = (id, data) => {
  return api.put(`/quality-rules/${id}`, data)
}

export const updateQualityRuleStatus = (id, enabled) => {
  return api.put(`/quality-rules/${id}/status`, { enabled })
}

export const deleteQualityRule = (id) => {
  return api.delete(`/quality-rules/${id}`)
}
