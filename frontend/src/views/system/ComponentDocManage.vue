<template>
  <div class="page-container">
    <div class="page-header fade-in-up">
      <h2 class="page-title">组件文档管理</h2>
    </div>

    <div class="filter-bar fade-in-up">
      <el-select v-model="filterCategory" placeholder="按分类筛选" clearable size="small" style="width: 160px" @change="loadList">
        <el-option v-for="cat in categoryList" :key="cat.key" :label="cat.label" :value="cat.key" />
      </el-select>
      <el-input v-model="filterKeyword" placeholder="搜索组件名称..." size="small" clearable prefix-icon="Search" style="width: 220px" @input="handleSearch" />
    </div>

    <div class="doc-grid fade-in-up" v-loading="loading">
      <div v-for="doc in list" :key="doc.id" class="doc-card">
        <div class="doc-card-header">
          <div class="doc-cat-dot" :style="{ background: getCatColor(doc.category) }"></div>
          <span class="doc-name">{{ doc.name }}</span>
          <el-tag size="small" effect="light" :style="{ color: getCatColor(doc.category), borderColor: getCatColor(doc.category) + '44', background: getCatColor(doc.category) + '22' }">
            {{ getCatLabel(doc.category) }}
          </el-tag>
        </div>
        <div class="doc-card-body">
          <p class="doc-desc">{{ doc.description || '暂无描述' }}</p>
        </div>
        <div class="doc-card-footer">
          <span class="doc-meta">v{{ doc.version }} · {{ doc.component_type }}</span>
          <span class="doc-time" v-if="doc.updated_at">{{ formatDate(doc.updated_at) }}</span>
        </div>
        <div class="doc-card-actions">
          <el-button size="small" text @click="openEditDialog(doc)"><el-icon><Edit /></el-icon>编辑</el-button>
          <el-button size="small" text @click="previewDoc(doc)"><el-icon><View /></el-icon>预览</el-button>
        </div>
      </div>
      <div v-if="!loading && list.length === 0" class="empty-state">
        <el-icon :size="48" color="var(--text-secondary)"><Document /></el-icon>
        <p>暂无组件文档</p>
      </div>
    </div>

    <el-dialog v-model="editDialogVisible" title="编辑组件文档" width="720px" destroy-on-close :close-on-click-modal="false">
      <el-form ref="editFormRef" :model="editForm" label-position="top" size="small">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="组件名称">
              <el-input v-model="editForm.name" disabled />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="组件类型">
              <el-input v-model="editForm.component_type" disabled />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="用途说明">
          <el-input v-model="editForm.description" type="textarea" :rows="3" placeholder="支持Markdown格式" />
        </el-form-item>
        <el-form-item label="Config 字段详解 (JSON)">
          <el-input v-model="editForm.config_fields_str" type="textarea" :rows="6" placeholder='[{"field":"host","type":"string","required":true,"default":"localhost","description":"服务器地址"}]' />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="输入 Schema (JSON)">
              <el-input v-model="editForm.input_schema_str" type="textarea" :rows="4" placeholder='{"type":"object","properties":{}}' />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="输出 Schema (JSON)">
              <el-input v-model="editForm.output_schema_str" type="textarea" :rows="4" placeholder='{"type":"object","properties":{}}' />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="配置示例 (JSON)">
          <el-input v-model="editForm.config_example_str" type="textarea" :rows="4" placeholder='{"host":"localhost","port":3306}' />
        </el-form-item>
        <el-form-item label="常见问题 (JSON)">
          <el-input v-model="editForm.faq_str" type="textarea" :rows="4" placeholder='[{"q":"问题？","a":"答案"}]' />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <ComponentDocDrawer v-model="showPreview" :component-type="previewComponentType" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { getComponentDocs, updateComponentDoc } from '@/api/component-doc'
import ComponentDocDrawer from '@/components/ComponentDocDrawer.vue'

const loading = ref(false)
const submitting = ref(false)
const list = ref([])
const filterCategory = ref('')
const filterKeyword = ref('')
const searchTimer = ref(null)
const editDialogVisible = ref(false)
const editFormRef = ref()
const editForm = reactive({
  id: null,
  name: '',
  component_type: '',
  description: '',
  config_fields_str: '',
  input_schema_str: '',
  output_schema_str: '',
  config_example_str: '',
  faq_str: ''
})
const showPreview = ref(false)
const previewComponentType = ref('')

const categoryList = [
  { key: 'data-access', label: '数据接入', color: '#3b82f6' },
  { key: 'data-preprocess', label: '数据预处理', color: '#10b981' },
  { key: 'model-labeling', label: '模型打标', color: '#f59e0b' },
  { key: 'entity-extract', label: '实体抽取', color: '#ef4444' },
  { key: 'relation-build', label: '关系构建', color: '#8b5cf6' },
  { key: 'knowledge-production', label: '知识数据生产', color: '#06b6d4' },
  { key: 'data-browse', label: '数据浏览', color: '#ec4899' }
]

const getCatColor = (key) => categoryList.find(c => c.key === key)?.color || '#94a3b8'
const getCatLabel = (key) => categoryList.find(c => c.key === key)?.label || key
const formatDate = (d) => d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-'

const safeStringify = (val) => {
  if (!val) return ''
  if (typeof val === 'string') return val
  try { return JSON.stringify(val, null, 2) } catch { return '' }
}

const loadList = async () => {
  loading.value = true
  try {
    const params = {}
    if (filterCategory.value) params.category = filterCategory.value
    if (filterKeyword.value) params.keyword = filterKeyword.value
    const res = await getComponentDocs(params)
    list.value = res.data || []
  } catch { /* handled */ } finally { loading.value = false }
}

const handleSearch = () => {
  if (searchTimer.value) clearTimeout(searchTimer.value)
  searchTimer.value = setTimeout(loadList, 300)
}

const openEditDialog = (doc) => {
  editForm.id = doc.id
  editForm.name = doc.name
  editForm.component_type = doc.component_type
  editForm.description = doc.description || ''
  editForm.config_fields_str = safeStringify(doc.config_fields)
  editForm.input_schema_str = safeStringify(doc.input_schema)
  editForm.output_schema_str = safeStringify(doc.output_schema)
  editForm.config_example_str = safeStringify(doc.config_example)
  editForm.faq_str = safeStringify(doc.faq)
  editDialogVisible.value = true
}

const tryParseJSON = (str) => {
  if (!str || !str.trim()) return undefined
  try { return JSON.parse(str) } catch {
    ElMessage.warning('JSON 格式不正确，请检查')
    return null
  }
}

const handleSave = async () => {
  const configFields = tryParseJSON(editForm.config_fields_str)
  if (editForm.config_fields_str.trim() && configFields === null) return

  const inputSchema = tryParseJSON(editForm.input_schema_str)
  if (editForm.input_schema_str.trim() && inputSchema === null) return

  const outputSchema = tryParseJSON(editForm.output_schema_str)
  if (editForm.output_schema_str.trim() && outputSchema === null) return

  const configExample = tryParseJSON(editForm.config_example_str)
  if (editForm.config_example_str.trim() && configExample === null) return

  const faq = tryParseJSON(editForm.faq_str)
  if (editForm.faq_str.trim() && faq === null) return

  submitting.value = true
  try {
    await updateComponentDoc(editForm.id, {
      name: editForm.name,
      description: editForm.description,
      config_fields: configFields,
      input_schema: inputSchema,
      output_schema: outputSchema,
      config_example: configExample,
      faq: faq
    })
    ElMessage.success('文档更新成功')
    editDialogVisible.value = false
    loadList()
  } catch { /* handled */ } finally { submitting.value = false }
}

const previewDoc = (doc) => {
  previewComponentType.value = doc.component_type
  showPreview.value = true
}

onMounted(loadList)
</script>

<style scoped>
.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  align-items: center;
}

.doc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.doc-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 18px;
  transition: var(--transition);
}

.doc-card:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-hover);
  transform: translateY(-2px);
}

.doc-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.doc-cat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.doc-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}

.doc-card-body {
  margin-bottom: 12px;
}

.doc-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.doc-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--text-tertiary);
  padding-top: 10px;
  border-top: 1px solid var(--border-color);
  margin-bottom: 8px;
}

.doc-card-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px 0;
  color: var(--text-secondary);
}

.empty-state p {
  margin-top: 12px;
}
</style>
