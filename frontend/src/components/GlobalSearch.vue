<template>
  <div class="global-search" ref="searchRef">
    <el-input
      ref="inputRef"
      v-model="keyword"
      :placeholder="placeholder"
      class="search-input"
      @focus="handleFocus"
      @input="handleInput"
      @keydown="handleKeydown"
      clearable
      @clear="handleClear"
    >
      <template #prefix>
        <el-icon><Search /></el-icon>
      </template>
    </el-input>

    <transition name="search-panel">
      <div v-if="panelVisible" class="search-panel">
        <div v-if="loading" class="search-loading">
          <el-icon class="is-loading" :size="20"><Loading /></el-icon>
          <span>搜索中...</span>
        </div>

        <template v-else-if="!keyword.trim()">
          <div v-if="searchHistory.length > 0" class="search-section">
            <div class="section-header">
              <span class="section-title">搜索历史</span>
              <el-button type="primary" link size="small" @click="clearHistory">清空</el-button>
            </div>
            <div class="history-list">
              <div
                v-for="(item, idx) in searchHistory"
                :key="idx"
                class="history-item"
                :class="{ active: activeIndex === idx }"
                @click="selectHistory(item)"
                @mouseenter="activeIndex = idx"
              >
                <el-icon class="history-icon"><Clock /></el-icon>
                <span class="history-text">{{ item }}</span>
                <el-icon class="history-delete" @click.stop="removeHistory(idx)"><Close /></el-icon>
              </div>
            </div>
          </div>
          <div v-else class="search-empty">
            <span>输入关键字开始搜索</span>
          </div>
        </template>

        <template v-else-if="hasResults">
          <div
            v-for="(group, gIdx) in resultGroups"
            :key="group.type"
            class="search-section"
          >
            <div class="section-header">
              <span class="section-title">{{ group.label }}</span>
              <span class="section-count">{{ group.total }} 条结果</span>
            </div>
            <div
              v-for="(item, iIdx) in group.items"
              :key="`${group.type}-${item.id}`"
              class="result-item"
              :class="{ active: flatIndex(gIdx, iIdx) === activeIndex }"
              @click="navigateTo(item)"
              @mouseenter="activeIndex = flatIndex(gIdx, iIdx)"
            >
              <div class="result-main">
                <span class="result-title" v-html="highlight(item.title)"></span>
                <span class="result-subtitle">{{ item.subtitle }}</span>
              </div>
              <el-icon class="result-arrow"><ArrowRight /></el-icon>
            </div>
            <div
              v-if="group.items.length < group.total"
              class="load-more"
              :class="{ loading: groupLoadingMap[group.type] }"
              @click.stop="loadMore(group.type)"
            >
              <el-icon v-if="groupLoadingMap[group.type]" class="is-loading"><Loading /></el-icon>
              <span>{{ groupLoadingMap[group.type] ? '加载中...' : '加载更多' }}</span>
            </div>
          </div>
        </template>

        <div v-else-if="keyword.trim() && !loading" class="search-empty">
          <span>未找到相关结果</span>
          <div class="suggest-keywords">
            <span>试试搜索：</span>
            <el-tag
              v-for="sk in suggestKeywords"
              :key="sk"
              size="small"
              class="suggest-tag"
              @click="applySuggest(sk)"
            >{{ sk }}</el-tag>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Loading, Clock, Close, ArrowRight } from '@element-plus/icons-vue'
import { globalSearch, globalSearchMore } from '@/api/search'

const HISTORY_KEY = 'global_search_history'
const MAX_HISTORY = 10
const PAGE_SIZE = 5

const router = useRouter()
const searchRef = ref(null)
const inputRef = ref(null)
const keyword = ref('')
const loading = ref(false)
const panelVisible = ref(false)
const resultGroups = ref([])
const activeIndex = ref(-1)
const groupPageMap = reactive({})
const groupLoadingMap = reactive({})

const userInfo = computed(() => {
  try { return JSON.parse(localStorage.getItem('userInfo') || '{}') } catch { return {} }
})
const isAdmin = computed(() => userInfo.value?.role === 'admin')
const placeholder = computed(() => isAdmin.value ? '搜索生产线、标签、用户、日志...' : '搜索生产线、标签...')

const searchHistory = ref([])

const suggestKeywords = ['知识图谱', '数据清洗', '实体识别', '情感分析']

const hasResults = computed(() => resultGroups.value.some((g) => g.items && g.items.length > 0))

const flatItems = computed(() => {
  const items = []
  for (const group of resultGroups.value) {
    for (const item of group.items) {
      items.push(item)
    }
  }
  return items
})

const flatIndex = (gIdx, iIdx) => {
  let idx = 0
  for (let g = 0; g < gIdx; g++) {
    idx += resultGroups.value[g]?.items?.length || 0
  }
  return idx + iIdx
}

const highlight = (text) => {
  if (!keyword.value.trim() || !text) return text
  const escaped = keyword.value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>')
}

let debounceTimer = null
const handleInput = () => {
  clearTimeout(debounceTimer)
  if (!keyword.value.trim()) {
    resultGroups.value = []
    activeIndex.value = -1
    Object.keys(groupPageMap).forEach((k) => delete groupPageMap[k])
    Object.keys(groupLoadingMap).forEach((k) => delete groupLoadingMap[k])
    return
  }
  debounceTimer = setTimeout(() => {
    doSearch()
  }, 300)
}

const doSearch = async () => {
  if (!keyword.value.trim()) return
  loading.value = true
  activeIndex.value = -1
  Object.keys(groupPageMap).forEach((k) => delete groupPageMap[k])
  Object.keys(groupLoadingMap).forEach((k) => delete groupLoadingMap[k])
  try {
    const types = isAdmin.value ? 'pipeline,tag,user,log' : 'pipeline,tag'
    const res = await globalSearch({ keyword: keyword.value.trim(), types, pageSize: PAGE_SIZE })
    if (res.success) {
      resultGroups.value = res.data.groups || []
      resultGroups.value.forEach((g) => {
        groupPageMap[g.type] = 1
        groupLoadingMap[g.type] = false
      })
    }
  } catch {
    resultGroups.value = []
  } finally {
    loading.value = false
  }
}

const loadMore = async (type) => {
  if (groupLoadingMap[type]) return
  const group = resultGroups.value.find((g) => g.type === type)
  if (!group || group.items.length >= group.total) return
  const nextPage = (groupPageMap[type] || 1) + 1
  groupLoadingMap[type] = true
  try {
    const res = await globalSearchMore({
      keyword: keyword.value.trim(),
      type,
      page: nextPage,
      pageSize: PAGE_SIZE
    })
    if (res.success && res.data) {
      const existingIds = new Set(group.items.map((i) => i.id))
      const newItems = res.data.items.filter((i) => !existingIds.has(i.id))
      group.items.push(...newItems)
      groupPageMap[type] = nextPage
    }
  } finally {
    groupLoadingMap[type] = false
  }
}

const handleFocus = () => {
  panelVisible.value = true
}

const handleClear = () => {
  keyword.value = ''
  resultGroups.value = []
  activeIndex.value = -1
  Object.keys(groupPageMap).forEach((k) => delete groupPageMap[k])
  Object.keys(groupLoadingMap).forEach((k) => delete groupLoadingMap[k])
}

const handleKeydown = (e) => {
  const total = keyword.value.trim()
    ? flatItems.value.length
    : searchHistory.value.length

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = activeIndex.value < total - 1 ? activeIndex.value + 1 : 0
    scrollToActive()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = activeIndex.value > 0 ? activeIndex.value - 1 : total - 1
    scrollToActive()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (activeIndex.value >= 0) {
      if (keyword.value.trim() && flatItems.value[activeIndex.value]) {
        navigateTo(flatItems.value[activeIndex.value])
      } else if (!keyword.value.trim() && searchHistory.value[activeIndex.value]) {
        selectHistory(searchHistory.value[activeIndex.value])
      }
    } else if (keyword.value.trim()) {
      addHistory(keyword.value.trim())
      doSearch()
    }
  } else if (e.key === 'Escape') {
    panelVisible.value = false
    inputRef.value?.blur()
  }
}

const scrollToActive = () => {
  nextTick(() => {
    const panel = searchRef.value?.querySelector('.search-panel')
    if (!panel) return
    const active = panel.querySelector('.active')
    if (active) {
      active.scrollIntoView({ block: 'nearest' })
    }
  })
}

const navigateTo = (item) => {
  addHistory(keyword.value.trim())
  panelVisible.value = false
  keyword.value = ''
  resultGroups.value = []
  activeIndex.value = -1
  Object.keys(groupPageMap).forEach((k) => delete groupPageMap[k])
  Object.keys(groupLoadingMap).forEach((k) => delete groupLoadingMap[k])
  if (item.route) {
    router.push(item.route)
  }
}

const selectHistory = (item) => {
  keyword.value = item
  doSearch()
}

const applySuggest = (sk) => {
  keyword.value = sk
  doSearch()
}

const loadHistory = () => {
  try {
    searchHistory.value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {
    searchHistory.value = []
  }
}

const saveHistory = () => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory.value))
}

const addHistory = (term) => {
  if (!term) return
  searchHistory.value = [term, ...searchHistory.value.filter((h) => h !== term)].slice(0, MAX_HISTORY)
  saveHistory()
}

const removeHistory = (idx) => {
  searchHistory.value.splice(idx, 1)
  saveHistory()
}

const clearHistory = () => {
  searchHistory.value = []
  saveHistory()
}

const handleClickOutside = (e) => {
  if (searchRef.value && !searchRef.value.contains(e.target)) {
    panelVisible.value = false
  }
}

onMounted(() => {
  loadHistory()
  document.addEventListener('click', handleClickOutside, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true)
  clearTimeout(debounceTimer)
})
</script>

<style scoped>
.global-search {
  position: relative;
  width: 320px;
}

.search-input :deep(.el-input__wrapper) {
  border-radius: 20px !important;
  background: rgba(255, 255, 255, 0.06) !important;
  border: 1px solid var(--border-color) !important;
  padding: 2px 12px;
  transition: var(--transition);
}

.search-input :deep(.el-input__wrapper:hover) {
  border-color: var(--primary) !important;
}

.search-input :deep(.el-input__wrapper.is-focus) {
  border-color: var(--primary) !important;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2) !important;
  background: rgba(255, 255, 255, 0.1) !important;
}

.search-input :deep(.el-input__inner) {
  font-size: 13px;
}

.search-input :deep(.el-input__prefix .el-icon) {
  color: var(--text-tertiary);
  font-size: 16px;
}

.search-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  max-height: 460px;
  overflow-y: auto;
  z-index: 2000;
  padding: 4px 0;
}

.search-panel-enter-active,
.search-panel-leave-active {
  transition: all 0.2s ease;
}

.search-panel-enter-from,
.search-panel-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.search-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 20px;
  color: var(--text-secondary);
  font-size: 13px;
}

.search-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 20px;
  color: var(--text-secondary);
  font-size: 13px;
  gap: 12px;
}

.suggest-keywords {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
}

.suggest-tag {
  cursor: pointer;
  transition: var(--transition);
}

.suggest-tag:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.search-section {
  padding: 0;
}

.search-section + .search-section {
  border-top: 1px solid var(--border-color);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px 4px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-count {
  font-size: 11px;
  color: var(--text-tertiary);
}

.history-list {
  padding: 0 6px 6px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: var(--transition);
  font-size: 13px;
  color: var(--text-primary);
}

.history-item:hover,
.history-item.active {
  background: var(--bg-hover);
}

.history-icon {
  color: var(--text-tertiary);
  font-size: 14px;
  flex-shrink: 0;
}

.history-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-delete {
  color: var(--text-tertiary);
  font-size: 12px;
  opacity: 0;
  transition: var(--transition);
  flex-shrink: 0;
}

.history-item:hover .history-delete {
  opacity: 1;
}

.history-delete:hover {
  color: var(--danger);
}

.result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  cursor: pointer;
  transition: var(--transition);
}

.result-item:hover,
.result-item.active {
  background: var(--bg-hover);
}

.result-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.result-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-title :deep(mark) {
  background: rgba(99, 102, 241, 0.25);
  color: var(--primary-light);
  border-radius: 2px;
  padding: 0 1px;
}

.result-subtitle {
  font-size: 11px;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-arrow {
  color: var(--text-tertiary);
  font-size: 12px;
  flex-shrink: 0;
  opacity: 0;
  transition: var(--transition);
}

.result-item:hover .result-arrow,
.result-item.active .result-arrow {
  opacity: 1;
}

.load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 12px;
  color: var(--primary);
  cursor: pointer;
  transition: var(--transition);
  user-select: none;
}

.load-more:hover {
  background: var(--bg-hover);
}

.load-more.loading {
  cursor: not-allowed;
  opacity: 0.7;
}

.load-more .el-icon {
  font-size: 12px;
}
</style>
