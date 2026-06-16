import api from '@/utils/request'

export const getTemplates = (params) => {
  return api.get('/templates', { params })
}

export const getTemplateCategories = () => {
  return api.get('/templates/categories')
}

export const getTemplateDetail = (id) => {
  return api.get(`/templates/${id}`)
}

export const useTemplate = (id, data) => {
  return api.post(`/templates/${id}/use`, data)
}

export const updateTemplateStatus = (id, status) => {
  return api.put(`/templates/${id}/status`, { status })
}

export const createTemplate = (data) => {
  return api.post('/templates', data)
}

export const updateTemplate = (id, data) => {
  return api.put(`/templates/${id}`, data)
}

export const deleteTemplate = (id) => {
  return api.delete(`/templates/${id}`)
}
