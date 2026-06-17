import api from '@/utils/request'

export const getProfile = () => {
  return api.get('/profile')
}

export const updateProfile = (data) => {
  return api.put('/profile', data)
}

export const changePassword = (data) => {
  return api.post('/profile/change-password', data)
}

export const getPreference = () => {
  return api.get('/profile/preference')
}

export const updatePreference = (data) => {
  return api.put('/profile/preference', data)
}
