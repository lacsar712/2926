import api from '@/utils/request'

export const globalSearch = (params) => {
  return api.get('/search', { params })
}

export const globalSearchMore = (params) => {
  return api.get('/search/more', { params })
}
