<template>
  <el-drawer
    v-model="visible"
    :title="docTitle"
    direction="rtl"
    size="640px"
    :before-close="handleClose"
    class="component-doc-drawer"
  >
    <div class="doc-search-bar">
      <el-input v-model="searchKeyword" placeholder="搜索组件文档..." size="small" clearable prefix-icon="Search" @input="handleSearch" />
    </div>

    <div class="doc-tabs">
      <div
        v-for="cat in categoryList"
        :key="cat.key"
        class="doc-tab"
        :class="{ active: activeCategory === cat.key }"
        @click="switchCategory(cat.key)"
      >
        <span class="tab-dot" :style="{ background: cat.color }"></span>
        <span class="tab-label">{{ cat.label }}</span>
      </div>
    </div>

    <div class="doc-content" v-loading="loading">
      <template v-if="currentDoc">
        <div class="doc-section">
          <h4 class="section-title">
            <el-icon><InfoFilled /></el-icon>用途说明
          </h4>
          <div class="section-body markdown-body" v-html="renderMarkdown(currentDoc.description)"></div>
        </div>

        <div class="doc-section" v-if="currentDoc.config_fields && currentDoc.config_fields.length">
          <h4 class="section-title">
            <el-icon><Setting /></el-icon>Config 字段详解
          </h4>
          <div class="section-body">
            <el-table :data="currentDoc.config_fields" size="small" border>
              <el-table-column prop="field" label="字段名" width="130" />
              <el-table-column prop="type" label="类型" width="80" />
              <el-table-column label="必填" width="55" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.required ? 'danger' : 'info'" size="small" effect="light">
                    {{ row.required ? '是' : '否' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="default" label="默认值" width="110" show-overflow-tooltip />
              <el-table-column prop="description" label="说明" show-overflow-tooltip />
            </el-table>
          </div>
        </div>

        <div class="doc-section" v-if="currentDoc.input_schema">
          <h4 class="section-title">
            <el-icon><Download /></el-icon>输入 Schema
          </h4>
          <div class="section-body">
            <pre class="schema-block"><code>{{ formatJSON(currentDoc.input_schema) }}</code></pre>
          </div>
        </div>

        <div class="doc-section" v-if="currentDoc.output_schema">
          <h4 class="section-title">
            <el-icon><Upload /></el-icon>输出 Schema
          </h4>
          <div class="section-body">
            <pre class="schema-block"><code>{{ formatJSON(currentDoc.output_schema) }}</code></pre>
          </div>
        </div>

        <div class="doc-section" v-if="currentDoc.config_example">
          <h4 class="section-title">
            <el-icon><DocumentCopy /></el-icon>配置示例
          </h4>
          <div class="section-body">
            <div class="config-example-block">
              <pre><code>{{ formatJSON(currentDoc.config_example) }}</code></pre>
              <el-button class="copy-btn" size="small" text @click="copyConfig">
                <el-icon><CopyDocument /></el-icon>复制
              </el-button>
            </div>
          </div>
        </div>

        <div class="doc-section" v-if="currentDoc.faq && currentDoc.faq.length">
          <h4 class="section-title">
            <el-icon><QuestionFilled /></el-icon>常见问题
          </h4>
          <div class="section-body">
            <el-collapse>
              <el-collapse-item v-for="(item, idx) in currentDoc.faq" :key="idx" :title="item.q" :name="idx">
                <div class="faq-answer markdown-body" v-html="renderMarkdown(item.a)"></div>
              </el-collapse-item>
            </el-collapse>
          </div>
        </div>

        <div class="doc-footer" v-if="currentDoc.updated_at">
          <el-icon><Clock /></el-icon>
          <span>最后更新于 {{ formatDate(currentDoc.updated_at) }}</span>
          <el-tag size="small" type="info" effect="light" v-if="currentDoc.version">v{{ currentDoc.version }}</el-tag>
        </div>
      </template>

      <el-empty v-else-if="!loading" description="暂无文档数据" />
    </div>

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="handleClose">关闭</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { marked } from 'marked'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { getComponentDocs, getComponentDoc } from '@/api/component-doc'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  componentType: { type: String, default: '' },
  categoryName: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

const visible = ref(props.modelValue)
const loading = ref(false)
const searchKeyword = ref('')
const activeCategory = ref('')
const allDocs = ref([])
const currentDoc = ref(null)
const searchTimer = ref(null)

const categoryList = [
  { key: 'data-access', label: '数据接入', color: '#3b82f6' },
  { key: 'data-preprocess', label: '数据预处理', color: '#10b981' },
  { key: 'model-labeling', label: '模型打标', color: '#f59e0b' },
  { key: 'entity-extract', label: '实体抽取', color: '#ef4444' },
  { key: 'relation-build', label: '关系构建', color: '#8b5cf6' },
  { key: 'knowledge-production', label: '知识数据生产', color: '#06b6d4' },
  { key: 'data-browse', label: '数据浏览', color: '#ec4899' }
]

const docTitle = computed(() => currentDoc.value ? `${currentDoc.value.name} - 组件文档` : '组件文档中心')

watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val) {
    initDrawer()
  }
})

watch(() => props.componentType, (newType, oldType) => {
  if (newType && newType !== oldType && visible.value) {
    loadDocByType(newType).then(() => {
      if (currentDoc.value) {
        activeCategory.value = currentDoc.value.category
      }
    })
  }
})

watch(visible, (val) => {
  emit('update:modelValue', val)
})

const initDrawer = async () => {
  if (props.componentType) {
    await loadDocByType(props.componentType)
    if (currentDoc.value) {
      activeCategory.value = currentDoc.value.category
    }
  } else if (props.categoryName) {
    activeCategory.value = props.categoryName
    await loadAllDocs()
  } else {
    activeCategory.value = 'data-access'
    await loadAllDocs()
  }
}

const loadAllDocs = async () => {
  loading.value = true
  try {
    const res = await getComponentDocs({ category: activeCategory.value, keyword: searchKeyword.value })
    allDocs.value = res.data || []
    if (allDocs.value.length > 0 && !props.componentType) {
      currentDoc.value = allDocs.value[0]
    }
  } catch { /* handled */ } finally { loading.value = false }
}

const loadDocByType = async (type) => {
  loading.value = true
  try {
    const res = await getComponentDoc(type)
    currentDoc.value = res.data
  } catch { /* handled */ } finally { loading.value = false }
}

const switchCategory = async (key) => {
  activeCategory.value = key
  searchKeyword.value = ''
  currentDoc.value = null
  await loadAllDocs()
  if (allDocs.value.length > 0) {
    currentDoc.value = allDocs.value[0]
  }
}

const handleSearch = () => {
  if (searchTimer.value) clearTimeout(searchTimer.value)
  searchTimer.value = setTimeout(async () => {
    loading.value = true
    try {
      const res = await getComponentDocs({ category: activeCategory.value, keyword: searchKeyword.value })
      allDocs.value = res.data || []
      if (allDocs.value.length > 0) {
        currentDoc.value = allDocs.value[0]
      } else {
        currentDoc.value = null
      }
    } catch { /* handled */ } finally { loading.value = false }
  }, 300)
}

const renderMarkdown = (text) => {
  if (!text) return ''
  return marked.parse(text, { breaks: true })
}

const formatJSON = (obj) => {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  return JSON.stringify(obj, null, 2)
}

const formatDate = (d) => d ? dayjs(d).format('YYYY-MM-DD HH:mm:ss') : '-'

const copyConfig = () => {
  if (!currentDoc.value?.config_example) return
  const text = typeof currentDoc.value.config_example === 'string'
    ? currentDoc.value.config_example
    : JSON.stringify(currentDoc.value.config_example, null, 2)
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('配置已复制到剪贴板')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

const handleClose = () => {
  visible.value = false
}
</script>

<style scoped>
.doc-search-bar {
  margin-bottom: 12px;
}

.doc-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.doc-tab {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  color: var(--text-secondary);
  background: var(--bg-dark);
  border: 1px solid var(--border-color);
  transition: var(--transition);
  white-space: nowrap;
}

.doc-tab:hover {
  color: var(--text-primary);
  border-color: var(--primary);
}

.doc-tab.active {
  color: var(--primary-light);
  background: rgba(99, 102, 241, 0.15);
  border-color: var(--primary);
}

.tab-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tab-label {
  font-weight: 500;
}

.doc-content {
  max-height: calc(100vh - 280px);
  overflow-y: auto;
}

.doc-section {
  margin-bottom: 20px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-color);
}

.section-title .el-icon {
  color: var(--primary);
}

.section-body {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.7;
}

.markdown-body :deep(p) {
  margin-bottom: 8px;
}

.markdown-body :deep(code) {
  background: var(--bg-dark);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', monospace;
  font-size: 12px;
  color: var(--primary-light);
}

.schema-block,
.config-example-block pre {
  background: var(--bg-dark);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 14px;
  margin: 0;
  overflow-x: auto;
}

.schema-block code,
.config-example-block code {
  font-family: 'Consolas', monospace;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.config-example-block {
  position: relative;
}

.config-example-block .copy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  color: var(--text-secondary);
}

.doc-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-tertiary);
}

.faq-answer {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
}

:deep(.el-collapse-item__header) {
  color: var(--text-primary) !important;
  font-size: 13px;
  background: transparent !important;
  border-color: var(--border-color) !important;
}

:deep(.el-collapse-item__wrap) {
  background: transparent !important;
  border-color: var(--border-color) !important;
}

:deep(.el-collapse-item__content) {
  color: var(--text-secondary);
}

:deep(.el-table) {
  --el-table-bg-color: var(--bg-dark) !important;
  --el-table-tr-bg-color: var(--bg-dark) !important;
  --el-table-header-bg-color: var(--bg-sidebar) !important;
  --el-table-row-hover-bg-color: var(--bg-hover) !important;
  font-size: 12px;
}
</style>
