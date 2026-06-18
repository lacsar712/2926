<template>
  <el-drawer v-model="visible" title="生产线讨论" size="480px" destroy-on-close>
    <template #header>
      <div class="drawer-header">
        <div class="header-title">
          <el-icon><ChatDotRound /></el-icon>
          <span>生产线讨论</span>
          <el-badge v-if="totalCount > 0" :value="totalCount" class="comment-badge" />
        </div>
      </div>
    </template>

    <div class="drawer-content" v-loading="loading">
      <div v-if="pinnedComments.length > 0" class="pinned-section">
        <div class="section-title">
          <el-icon color="#e6a23c"><Star /></el-icon>
          <span>置顶说明</span>
        </div>
        <div v-for="comment in pinnedComments" :key="comment.id" class="pinned-comment">
          <CommentItem
            :comment="comment"
            :current-user="currentUser"
            @reply="handleReply"
            @edit="handleEdit"
            @delete="handleDelete"
            @pin="handlePin"
          />
        </div>
        <el-divider />
      </div>

      <div class="comments-list">
        <div v-if="comments.length === 0 && !loading" class="empty-state">
          <el-icon :size="48" color="var(--text-secondary)"><ChatLineSquare /></el-icon>
          <p>暂无讨论，来发表第一条评论吧</p>
        </div>
        <CommentItem
          v-for="comment in comments"
          :key="comment.id"
          :comment="comment"
          :current-user="currentUser"
          @reply="handleReply"
          @edit="handleEdit"
          @delete="handleDelete"
          @pin="handlePin"
        />
      </div>

      <div v-if="totalCount > pageSize" class="pagination-bar">
        <el-pagination
          background
          layout="prev, pager, next"
          :total="totalCount"
          :page-size="pageSize"
          v-model:current-page="currentPage"
          @current-change="loadComments"
        />
      </div>

      <div class="comment-input-section">
        <div v-if="replyTo" class="reply-preview">
          <div class="reply-header">
            <span>回复 @{{ replyTo.user?.nickname || replyTo.nickname }}</span>
            <el-button link size="small" @click="replyTo = null">
              <el-icon><Close /></el-icon>取消
            </el-button>
          </div>
          <div class="reply-content">{{ truncateText(replyTo.content) }}</div>
        </div>
        <div v-if="editingComment" class="reply-preview">
          <div class="reply-header">
            <span>编辑评论</span>
            <el-button link size="small" @click="cancelEdit">
              <el-icon><Close /></el-icon>取消
            </el-button>
          </div>
        </div>

        <div class="input-wrapper">
          <div class="mention-dropdown" v-if="showMentionDropdown">
            <div
              v-for="(user, index) in mentionUsers"
              :key="user.id"
              class="mention-item"
              :class="{ active: mentionIndex === index }"
              @click="insertMention(user)"
            >
              <div class="mention-avatar">{{ user.nickname?.charAt(0) || 'U' }}</div>
              <div class="mention-info">
                <div class="mention-name">{{ user.nickname }}</div>
                <div class="mention-role">{{ roleLabels[user.role] || user.role }}</div>
              </div>
            </div>
            <div v-if="mentionUsers.length === 0" class="mention-empty">无匹配用户</div>
          </div>

          <el-input
            ref="inputRef"
            v-model="inputContent"
            type="textarea"
            :rows="3"
            :placeholder="inputPlaceholder"
            maxlength="2000"
            show-word-limit
            @input="handleInput"
            @keydown="handleKeydown"
          />

          <div class="input-actions">
            <div class="input-tips">
              <span class="tip">输入 <code>@</code> 提及用户</span>
            </div>
            <el-button
              type="primary"
              :disabled="!inputContent.trim() || submitting"
              :loading="submitting"
              @click="handleSubmit"
            >
              {{ editingComment ? '更新' : (canWrite ? '发表' : '无权限发表') }}
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import CommentItem from './CommentItem.vue'
import {
  getComments,
  createComment,
  updateComment,
  deleteComment,
  pinComment,
  getMentionUsers
} from '@/api/pipeline-comment'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  pipelineId: { type: [String, Number], required: true }
})

const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const currentUser = JSON.parse(localStorage.getItem('userInfo') || '{}')
const canWrite = computed(() => currentUser.role === 'admin' || currentUser.role === 'editor')

const loading = ref(false)
const submitting = ref(false)
const comments = ref([])
const pinnedComments = ref([])
const totalCount = ref(0)
const currentPage = ref(1)
const pageSize = 10

const inputContent = ref('')
const inputRef = ref(null)
const replyTo = ref(null)
const editingComment = ref(null)

const showMentionDropdown = ref(false)
const mentionUsers = ref([])
const mentionIndex = ref(0)
const mentionKeyword = ref('')
const mentionStartPos = ref(0)

const roleLabels = { admin: '管理员', editor: '编辑', viewer: '访客' }

const inputPlaceholder = computed(() => {
  if (editingComment.value) return '编辑你的评论...'
  if (replyTo.value) return `回复 @${replyTo.value.user?.nickname || replyTo.value.nickname}...`
  if (!canWrite.value) return '仅编辑以上角色可发表评论'
  return '发表你的想法...'
})

const truncateText = (text, max = 100) => {
  if (!text) return ''
  return text.length > max ? text.substring(0, max) + '...' : text
}

const loadComments = async () => {
  if (!props.pipelineId) return
  loading.value = true
  try {
    const res = await getComments(props.pipelineId, {
      page: currentPage.value,
      pageSize: pageSize
    })
    pinnedComments.value = res.data.pinned || []
    comments.value = res.data.list || []
    totalCount.value = res.data.total || 0
  } catch { /* handled */ } finally { loading.value = false }
}

const handleSubmit = async () => {
  if (!inputContent.value.trim()) return
  if (!canWrite.value && !editingComment.value) return

  submitting.value = true
  try {
    if (editingComment.value) {
      await updateComment(editingComment.value.id, { content: inputContent.value })
      ElMessage.success('评论更新成功')
      editingComment.value = null
    } else {
      await createComment({
        pipeline_id: props.pipelineId,
        content: inputContent.value,
        reply_to_id: replyTo.value?.id || null
      })
      ElMessage.success('评论发表成功')
      replyTo.value = null
    }
    inputContent.value = ''
    currentPage.value = 1
    loadComments()
  } catch { /* handled */ } finally { submitting.value = false }
}

const handleReply = (comment) => {
  replyTo.value = comment
  editingComment.value = null
  inputContent.value = `@${comment.user.nickname} `
  nextTick(() => {
    inputRef.value?.focus()
    const len = inputContent.value.length
    inputRef.value?.textarea?.setSelectionRange(len, len)
  })
}

const handleEdit = (comment) => {
  editingComment.value = comment
  replyTo.value = null
  inputContent.value = comment.content
  nextTick(() => inputRef.value?.focus())
}

const cancelEdit = () => {
  editingComment.value = null
  inputContent.value = ''
}

const handleDelete = async (comment) => {
  try {
    await ElMessageBox.confirm('确认删除该评论？删除后无法恢复。', '删除确认', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
    })
    await deleteComment(comment.id)
    ElMessage.success('删除成功')
    loadComments()
  } catch { /* handled */ }
}

const handlePin = async (comment) => {
  try {
    await pinComment(comment.id, !comment.is_pinned)
    ElMessage.success(comment.is_pinned ? '取消置顶成功' : '置顶成功')
    loadComments()
  } catch { /* handled */ }
}

const handleInput = () => {
  const textarea = inputRef.value?.textarea
  if (!textarea) return

  const pos = textarea.selectionStart
  const textBefore = inputContent.value.substring(0, pos)
  const atMatch = textBefore.match(/@([^\s@]*)$/)

  if (atMatch) {
    mentionKeyword.value = atMatch[1]
    mentionStartPos.value = pos - atMatch[1].length - 1
    showMentionDropdown.value = true
    searchMentionUsers(mentionKeyword.value)
  } else {
    showMentionDropdown.value = false
  }
}

const searchMentionUsers = async (keyword) => {
  try {
    const res = await getMentionUsers(keyword)
    mentionUsers.value = res.data || []
    mentionIndex.value = 0
  } catch { mentionUsers.value = [] }
}

const insertMention = (user) => {
  const textarea = inputRef.value?.textarea
  if (!textarea) return

  const before = inputContent.value.substring(0, mentionStartPos.value)
  const after = inputContent.value.substring(textarea.selectionStart)
  inputContent.value = `${before}@${user.nickname} ${after}`

  showMentionDropdown.value = false
  nextTick(() => {
    const newPos = mentionStartPos.value + user.nickname.length + 2
    textarea.setSelectionRange(newPos, newPos)
    textarea.focus()
  })
}

const handleKeydown = (e) => {
  if (!showMentionDropdown.value) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    mentionIndex.value = (mentionIndex.value + 1) % mentionUsers.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    mentionIndex.value = (mentionIndex.value - 1 + mentionUsers.value.length) % mentionUsers.value.length
  } else if (e.key === 'Enter' && mentionUsers.value.length > 0) {
    e.preventDefault()
    insertMention(mentionUsers.value[mentionIndex.value])
  } else if (e.key === 'Escape') {
    showMentionDropdown.value = false
  }
}

watch(() => props.pipelineId, () => {
  if (visible.value) {
    currentPage.value = 1
    loadComments()
  }
})

watch(visible, (val) => {
  if (val) {
    currentPage.value = 1
    loadComments()
  } else {
    replyTo.value = null
    editingComment.value = null
    inputContent.value = ''
  }
})
</script>

<style scoped>
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}
.comment-badge {
  margin-left: 4px;
}

.drawer-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.pinned-section {
  margin-bottom: 8px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #e6a23c;
  margin-bottom: 8px;
}
.pinned-comment {
  background: rgba(230, 162, 60, 0.08);
  border-radius: 8px;
  padding: 8px;
  margin-bottom: 8px;
}

.comments-list {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: var(--text-secondary);
  text-align: center;
}
.empty-state p {
  margin-top: 12px;
  font-size: 13px;
}

.pagination-bar {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

.comment-input-section {
  border-top: 1px solid var(--border-color);
  padding-top: 16px;
  background: var(--bg-card);
}

.reply-preview {
  background: var(--bg-hover);
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
}
.reply-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--primary);
  margin-bottom: 4px;
}
.reply-content {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.input-wrapper {
  position: relative;
}

.mention-dropdown {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  max-height: 240px;
  overflow-y: auto;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 4px;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
}
.mention-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s;
}
.mention-item:hover, .mention-item.active {
  background: var(--bg-hover);
}
.mention-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}
.mention-info {
  flex: 1;
  min-width: 0;
}
.mention-name {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}
.mention-role {
  font-size: 11px;
  color: var(--text-secondary);
}
.mention-empty {
  padding: 16px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
}

.input-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}
.input-tips {
  font-size: 11px;
  color: var(--text-secondary);
}
.input-tips code {
  background: var(--bg-hover);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

:deep(.el-drawer__body) {
  display: flex;
  flex-direction: column;
}
</style>
