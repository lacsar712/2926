import api from '@/utils/request'

export const getComments = (pipelineId, params) => {
  return api.get(`/pipeline-comments/pipeline/${pipelineId}`, { params })
}

export const getCommentSummary = (pipelineId) => {
  return api.get(`/pipeline-comments/pipeline/${pipelineId}/summary`)
}

export const createComment = (data) => {
  return api.post('/pipeline-comments', data)
}

export const updateComment = (id, data) => {
  return api.put(`/pipeline-comments/${id}`, data)
}

export const deleteComment = (id) => {
  return api.delete(`/pipeline-comments/${id}`)
}

export const pinComment = (id, isPinned) => {
  return api.put(`/pipeline-comments/${id}/pin`, { is_pinned: isPinned })
}

export const getMentionUsers = (keyword) => {
  return api.get('/pipeline-comments/users/mention', { params: { keyword } })
}
