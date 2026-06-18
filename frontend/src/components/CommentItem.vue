<template>
  <div class="comment-item" :class="{ 'is-pinned': comment.is_pinned }">
    <div class="comment-avatar">
      {{ getAvatarLetter() }}
    </div>
    <div class="comment-content-wrapper">
      <div class="comment-header">
        <div class="comment-user-info">
          <span class="comment-nickname">{{ comment.user.nickname }}</span>
          <el-tag size="small" :type="getRoleTagType()" effect="light" class="role-tag">
            {{ roleLabels[comment.user.role] || comment.user.role }}
          </el-tag>
          <span v-if="comment.is_pinned" class="pinned-badge">
            <el-icon size="12"><Star /></el-icon>置顶
          </span>
        </div>
        <span class="comment-time">{{ formatTime(comment.created_at) }}</span>
      </div>

      <div v-if="comment.reply_to" class="reply-quote">
        <div class="reply-quote-header">
          <span class="reply-quote-name">@{{ comment.reply_to.nickname }}</span>
        </div>
        <div class="reply-quote-content">{{ truncateText(comment.reply_to.content) }}</div>
      </div>

      <div class="comment-body">
        <div class="comment-text" v-html="renderContent(comment.content)"></div>
      </div>

      <div class="comment-actions">
        <el-button v-if="comment.can_edit" link size="small" @click="$emit('edit', comment)">
          <el-icon><Edit /></el-icon>编辑
        </el-button>
        <el-button v-if="comment.can_delete" link size="small" type="danger" @click="$emit('delete', comment)">
          <el-icon><Delete /></el-icon>删除
        </el-button>
        <el-button
          v-if="isAdmin && !comment.is_pinned"
          link size="small"
          type="warning"
          @click="$emit('pin', comment)"
        >
          <el-icon><Top /></el-icon>置顶
        </el-button>
        <el-button
          v-if="isAdmin && comment.is_pinned"
          link size="small"
          type="info"
          @click="$emit('pin', comment)"
        >
          <el-icon><Bottom /></el-icon>取消置顶
        </el-button>
        <el-button
          v-if="canWrite"
          link size="small"
          @click="$emit('reply', comment)"
        >
          <el-icon><ChatDotRound /></el-icon>回复
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const props = defineProps({
  comment: { type: Object, required: true },
  currentUser: { type: Object, default: () => ({}) }
})

defineEmits(['reply', 'edit', 'delete', 'pin'])

const roleLabels = { admin: '管理员', editor: '编辑', viewer: '访客' }

const isAdmin = computed(() => props.currentUser.role === 'admin')
const canWrite = computed(() => props.currentUser.role === 'admin' || props.currentUser.role === 'editor')

const getAvatarLetter = () => {
  const nickname = props.comment.user?.nickname || 'U'
  return nickname.charAt(0).toUpperCase()
}

const getRoleTagType = () => {
  const role = props.comment.user?.role
  if (role === 'admin') return 'danger'
  if (role === 'editor') return 'primary'
  return 'info'
}

const formatTime = (time) => {
  if (!time) return '-'
  return dayjs(time).fromNow()
}

const truncateText = (text, max = 80) => {
  if (!text) return ''
  return text.length > max ? text.substring(0, max) + '...' : text
}

const renderContent = (content) => {
  if (!content) return ''
  let html = escapeHtml(content)
  html = html.replace(/@(\S+)/g, '<span class="mention-highlight">@$1</span>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/## (.+?)(\n|$)/g, '<h4 class="comment-heading">$1</h4>')
  html = html.replace(/- (.+?)(\n|$)/g, '<li class="comment-list-item">$1</li>')
  html = html.replace(/\n/g, '<br />')
  return html
}

const escapeHtml = (text) => {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
</script>

<style scoped>
.comment-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
}
.comment-item:last-child {
  border-bottom: none;
}
.comment-item.is-pinned {
  padding: 8px 0;
}

.comment-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), #8b5cf6);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.comment-content-wrapper {
  flex: 1;
  min-width: 0;
}

.comment-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.comment-user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}
.comment-nickname {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.role-tag {
  font-size: 10px;
  padding: 0 4px;
  height: 16px;
  line-height: 14px;
}
.pinned-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  color: #e6a23c;
  background: rgba(230, 162, 60, 0.15);
  padding: 1px 6px;
  border-radius: 10px;
}
.comment-time {
  font-size: 11px;
  color: var(--text-secondary);
}

.reply-quote {
  background: var(--bg-hover);
  border-left: 3px solid var(--primary);
  border-radius: 4px;
  padding: 6px 10px;
  margin-bottom: 6px;
}
.reply-quote-header {
  font-size: 11px;
  color: var(--primary);
  margin-bottom: 2px;
}
.reply-quote-name {
  font-weight: 500;
}
.reply-quote-content {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.comment-body {
  margin-bottom: 4px;
}
.comment-text {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.7;
  word-break: break-word;
}
.comment-text :deep(.mention-highlight) {
  color: var(--primary);
  font-weight: 500;
  background: rgba(99, 102, 241, 0.1);
  padding: 0 2px;
  border-radius: 4px;
}
.comment-text :deep(.comment-heading) {
  font-size: 14px;
  font-weight: 600;
  margin: 8px 0 4px;
  color: var(--text-primary);
}
.comment-text :deep(.comment-list-item) {
  margin-left: 16px;
  position: relative;
}
.comment-text :deep(.comment-list-item)::before {
  content: '•';
  position: absolute;
  left: -12px;
  color: var(--primary);
}

.comment-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}
.comment-actions .el-button {
  font-size: 11px;
  padding: 0 4px;
  height: 24px;
}
</style>
