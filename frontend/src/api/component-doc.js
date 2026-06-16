import api from '@/utils/request'

export const getComponentDocs = (params) => {
  return api.get('/component-docs', { params })
}

export const getComponentDocCategories = () => {
  return api.get('/component-docs/categories')
}

export const getComponentDoc = (componentType) => {
  return api.get(`/component-docs/${componentType}`)
}

export const updateComponentDoc = (id, data) => {
  return api.put(`/component-docs/${id}`, data)
}
