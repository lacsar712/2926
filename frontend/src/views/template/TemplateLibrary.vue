<template>
  <div class="page-container">
    <div class="page-header fade-in-up">
      <div class="header-left">
        <h2 class="page-title">模板库</h2>
        <p class="page-subtitle">从预置模板快速创建生产线，提升开发效率</p>
      </div>
      <div class="header-right">
        <el-button v-if="isAdmin" type="primary" plain @click="showAllToggle">
          <el-icon><View /></el-icon>{{ showAll ? '仅看上架' : '查看全部' }}
        </el-button>
      </div>
    </div>

    <div class="filter-bar fade-in-up">
      <div class="category-tags">
        <el-tag
          v-for="cat in categoryOptions"
          :key="cat"
          :class="{ active: filters.category === cat }"
          size="large"
          effect="plain"
          @click="selectCategory(cat)"
        >
          {{ cat }}
        </el-tag>
        <el-tag
          :class="{ active: !filters.category }"
          size="large"
          effect="plain"
          @click="selectCategory('')"
        >
          全部
        </el-tag>
      </div>
      <el-input
        v-model="filters.keyword"
        placeholder="搜索模板名称或描述..."
        clearable
        style="width: 300px"
        prefix-icon="Search"
        @clear="loadList"
        @keyup.enter="loadList"
      />
    </div>

    <div class="template-grid fade-in-up" v-loading="loading">
      <div
        v-for="item in list"
        :key="item.id"
        class="template-card"
        :class="{ offline: item.status === 'offline' }"
      >
        <div class="card-preview" @click="openDetail(item)">
          <div class="flow-thumbnail">
            <svg viewBox="0 0 400 200" class="mini-flow">
              <defs>
                <linearGradient :id="'grad-' + item.id" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" style="stop-color:#6366f1;stop-opacity:0.3" />
                  <stop offset="100%" style="stop-color:#a78bfa;stop-opacity:0.3" />
                </linearGradient>
              </defs>
              <template v-if="item.flow_data && item.flow_data.nodes">
                <g v-for="(node, idx) in getVisibleNodes(item.flow_data.nodes)" :key="node.id">
                  <rect
                    :x="getNodePosition(node, item.flow_data.nodes).x"
                    :y="getNodePosition(node, item.flow_data.nodes).y"
                    width="50"
                    height="36"
                    rx="6"
                    :fill="getNodeColor(idx)"
                    opacity="0.9"
                  />
                  <text
                    :x="getNodePosition(node, item.flow_data.nodes).x + 25"
                    :y="getNodePosition(node, item.flow_data.nodes).y + 22"
                    text-anchor="middle"
                    fill="white"
                    font-size="10"
                  >
                    {{ node.data?.label?.substring(0, 4) || '节点' }}
                  </text>
                </g>
                <g v-for="edge in item.flow_data.edges" :key="edge.id">
                  <line
                    :x1="getEdgePosition(edge, item.flow_data.nodes).x1"
                    :y1="getEdgePosition(edge, item.flow_data.nodes).y1"
                    :x2="getEdgePosition(edge, item.flow_data.nodes).x2"
                    :y2="getEdgePosition(edge, item.flow_data.nodes).y2"
                    stroke="#818cf8"
                    stroke-width="2"
                    opacity="0.5"
                  />
                </g>
              </template>
            </svg>
          </div>
          <div class="preview-mask">
            <el-icon :size="24"><ZoomIn /></el-icon>
            <span>查看详情</span>
          </div>
        </div>

        <div class="card-body">
          <div class="card-title-row">
            <h3 class="card-title" @click="openDetail(item)">{{ item.name }}</h3>
            <span v-if="item.status === 'offline'" class="offline-tag">已下架</span>
          </div>
          <p class="card-desc">{{ item.description || '暂无描述' }}</p>
          <div class="card-tags">
            <el-tag size="small" type="info" effect="plain">{{ item.category || '未分类' }}</el-tag>
            <el-tag size="small" type="primary" effect="plain">
              <el-icon><Grid /></el-icon>{{ item.node_count || 0 }} 个节点
            </el-tag>
          </div>
        </div>

        <div class="card-footer">
          <span class="creator-info">
            <el-icon><User /></el-icon>{{ item.creator_name || '系统' }}
          </span>
          <div class="card-actions">
            <template v-if="isAdmin">
              <el-button
                v-if="item.status === 'online'"
                size="small"
                type="warning"
                plain
                @click.stop="toggleStatus(item)"
              >
                下架
              </el-button>
              <el-button
                v-else
                size="small"
                type="success"
                plain
                @click.stop="toggleStatus(item)"
              >
                上架
              </el-button>
            </template>
            <el-tooltip v-if="!canUseTemplate" content="仅编辑者及以上角色可使用模板" placement="top">
              <el-button
                size="small"
                type="primary"
                disabled
                @click.stop="() => {}"
              >
                <el-icon><MagicStick /></el-icon>使用模板
              </el-button>
            </el-tooltip>
            <el-button
              v-else
              size="small"
              type="primary"
              :disabled="item.status === 'offline' && !isAdmin"
              @click.stop="openUseDialog(item)"
            >
              <el-icon><MagicStick /></el-icon>使用模板
            </el-button>
          </div>
        </div>
      </div>

      <div v-if="!loading && list.length === 0" class="empty-state">
        <el-icon :size="48" color="var(--text-secondary)"><Box /></el-icon>
        <p>暂无模板数据</p>
      </div>
    </div>

    <div class="pagination-bar" v-if="total > pageSize">
      <el-pagination
        background
        layout="total, prev, pager, next"
        :total="total"
        :page-size="pageSize"
        v-model:current-page="currentPage"
        @current-change="loadList"
      />
    </div>

    <el-drawer
      v-model="detailVisible"
      title="模板详情"
      direction="rtl"
      size="600px"
      destroy-on-close
    >
      <div v-if="currentTemplate" class="template-detail">
        <div class="detail-header">
          <h3>{{ currentTemplate.name }}</h3>
          <el-tag :type="currentTemplate.status === 'online' ? 'success' : 'info'" effect="plain">
            {{ currentTemplate.status === 'online' ? '已上架' : '已下架' }}
          </el-tag>
        </div>

        <p class="detail-desc">{{ currentTemplate.description || '暂无描述' }}</p>

        <div class="detail-meta">
          <div class="meta-item">
            <span class="meta-label">分类</span>
            <span class="meta-value">{{ currentTemplate.category || '未分类' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">节点数</span>
            <span class="meta-value">{{ currentTemplate.node_count || 0 }} 个</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">创建者</span>
            <span class="meta-value">{{ currentTemplate.creator_name || '系统' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">创建时间</span>
            <span class="meta-value">{{ formatDate(currentTemplate.created_at) }}</span>
          </div>
        </div>

        <div class="detail-section">
          <h4 class="section-title">
            <el-icon><Share /></el-icon>流程预览
          </h4>
          <div class="flow-preview">
            <div
              v-for="node in currentTemplate.flow_data?.nodes || []"
              :key="node.id"
              class="flow-node-item"
            >
              <div class="node-icon">
                <el-icon><SetUp /></el-icon>
              </div>
              <div class="node-info">
                <div class="node-name">{{ node.data?.label || '未命名节点' }}</div>
                <div class="node-type">{{ node.data?.component || node.type }}</div>
              </div>
            </div>
            <div v-if="!currentTemplate.flow_data?.nodes?.length" class="empty-flow">
              暂无节点数据
            </div>
          </div>
        </div>

        <div class="detail-footer">
          <template v-if="isAdmin">
            <el-button
              v-if="currentTemplate.status === 'online'"
              type="warning"
              @click="toggleStatus(currentTemplate)"
            >
              下架模板
            </el-button>
            <el-button
              v-else
              type="success"
              @click="toggleStatus(currentTemplate)"
            >
              上架模板
            </el-button>
          </template>
          <el-tooltip v-if="!canUseTemplate" content="仅编辑者及以上角色可使用模板" placement="top">
            <el-button
              type="primary"
              disabled
            >
              <el-icon><MagicStick /></el-icon>使用此模板
            </el-button>
          </el-tooltip>
          <el-button
            v-else
            type="primary"
            :disabled="currentTemplate.status === 'offline' && !isAdmin"
            @click="openUseDialog(currentTemplate); detailVisible = false;"
          >
            <el-icon><MagicStick /></el-icon>使用此模板
          </el-button>
        </div>
      </div>
    </el-drawer>

    <el-dialog
      v-model="useDialogVisible"
      title="使用模板创建生产线"
      width="520px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="useForm" :rules="formRules" label-width="80px">
        <el-form-item label="模板名称">
          <el-input :value="currentTemplate?.name" disabled />
        </el-form-item>
        <el-form-item label="生产线名称" prop="name">
          <el-input
            v-model="useForm.name"
            placeholder="请输入生产线名称"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input
            v-model="useForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入描述信息（选填）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="useDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleUseTemplate">
          创建并跳转编排
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getTemplates,
  getTemplateCategories,
  getTemplateDetail,
  useTemplate,
  updateTemplateStatus
} from '@/api/template'
import dayjs from 'dayjs'
import { usePreferenceStore } from '@/stores/preference'

const router = useRouter()
const preferenceStore = usePreferenceStore()
const loading = ref(false)
const submitting = ref(false)
const list = ref([])
const categories = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = computed(() => preferenceStore.pageSize)

const detailVisible = ref(false)
const currentTemplate = ref(null)

const useDialogVisible = ref(false)
const formRef = ref()
const useForm = reactive({ name: '', description: '' })
const formRules = {
  name: [{ required: true, message: '请输入生产线名称', trigger: 'blur' }]
}

const showAll = ref(false)

const userInfo = computed(() => {
  try {
    return JSON.parse(localStorage.getItem('userInfo') || '{}')
  } catch {
    return {}
  }
})

const isAdmin = computed(() => userInfo.value?.role === 'admin')
const canUseTemplate = computed(() => ['admin', 'editor'].includes(userInfo.value?.role))

const filters = reactive({
  keyword: '',
  category: ''
})

const categoryOptions = computed(() => categories.value || [])

const formatDate = (d) => (d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-')

const loadCategories = async () => {
  try {
    const res = await getTemplateCategories()
    categories.value = res.data
  } catch {
    /* handled */
  }
}

const loadList = async () => {
  loading.value = true
  try {
    const params = {
      ...filters,
      page: currentPage.value,
      pageSize: pageSize.value
    }
    if (isAdmin.value && !showAll.value) {
      params.status = 'online'
    }
    const res = await getTemplates(params)
    list.value = res.data.list || []
    total.value = res.data.total || 0
  } catch {
    /* handled */
  } finally {
    loading.value = false
  }
}

const selectCategory = (cat) => {
  filters.category = cat
  currentPage.value = 1
  loadList()
}

const showAllToggle = () => {
  showAll.value = !showAll.value
  currentPage.value = 1
  loadList()
}

const getVisibleNodes = (nodes) => {
  if (!nodes || nodes.length === 0) return []
  if (nodes.length <= 5) return nodes
  return nodes.slice(0, 5)
}

const getNodePosition = (node, allNodes) => {
  if (!node || !allNodes || allNodes.length === 0) return { x: 0, y: 0 }

  const index = allNodes.findIndex((n) => n.id === node.id)
  const count = Math.min(allNodes.length, 5)
  const spacing = 380 / Math.max(count - 1, 1)
  const x = index * spacing + 10

  const yOffset = index % 2 === 0 ? 40 : 120
  const y = allNodes.length <= 3 ? 82 : yOffset

  return { x, y }
}

const getEdgePosition = (edge, allNodes) => {
  if (!edge || !allNodes || allNodes.length === 0) {
    return { x1: 0, y1: 0, x2: 0, y2: 0 }
  }

  const sourceNode = allNodes.find((n) => n.id === edge.source)
  const targetNode = allNodes.find((n) => n.id === edge.target)

  if (!sourceNode || !targetNode) {
    return { x1: 0, y1: 0, x2: 0, y2: 0 }
  }

  const sourcePos = getNodePosition(sourceNode, allNodes)
  const targetPos = getNodePosition(targetNode, allNodes)

  return {
    x1: sourcePos.x + 50,
    y1: sourcePos.y + 18,
    x2: targetPos.x,
    y2: targetPos.y + 18
  }
}

const nodeColors = [
  '#6366f1',
  '#8b5cf6',
  '#a78bfa',
  '#7c3aed',
  '#4f46e5'
]

const getNodeColor = (index) => {
  return nodeColors[index % nodeColors.length]
}

const openDetail = async (item) => {
  try {
    const res = await getTemplateDetail(item.id)
    currentTemplate.value = res.data
    detailVisible.value = true
  } catch {
    /* handled */
  }
}

const openUseDialog = (item) => {
  currentTemplate.value = item
  useForm.name = `${item.name} - 副本`
  useForm.description = item.description || ''
  useDialogVisible.value = true
}

const handleUseTemplate = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const res = await useTemplate(currentTemplate.value.id, {
      name: useForm.name,
      description: useForm.description
    })
    ElMessage.success('生产线创建成功，正在跳转编排页...')
    useDialogVisible.value = false
    setTimeout(() => {
      router.push(`/pipeline/flow/${res.data.id}`)
    }, 500)
  } catch {
    /* handled */
  } finally {
    submitting.value = false
  }
}

const toggleStatus = async (item) => {
  const action = item.status === 'online' ? '下架' : '上架'
  try {
    await ElMessageBox.confirm(
      `确认${action}模板「${item.name}」吗？`,
      '提示',
      { type: 'warning' }
    )
    const newStatus = item.status === 'online' ? 'offline' : 'online'
    await updateTemplateStatus(item.id, newStatus)
    ElMessage.success(`${action}成功`)
    loadList()
    if (currentTemplate.value?.id === item.id) {
      currentTemplate.value.status = newStatus
    }
  } catch {
    /* handled */
  }
}

onMounted(() => {
  loadCategories()
  loadList()
})
</script>

<style scoped>
.page-container {
  padding: 24px;
  height: 100%;
  overflow-y: auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
}

.page-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.category-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.category-tags :deep(.el-tag) {
  cursor: pointer;
  transition: var(--transition);
  border-color: var(--border-color);
  background: var(--bg-card);
  color: var(--text-secondary);
}

.category-tags :deep(.el-tag:hover) {
  border-color: var(--primary);
  color: var(--primary-light);
}

.category-tags :deep(.el-tag.active) {
  background: var(--gradient-primary);
  border-color: transparent;
  color: white;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  min-height: 300px;
}

.template-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  overflow: hidden;
  transition: var(--transition);
  display: flex;
  flex-direction: column;
}

.template-card:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-hover);
  transform: translateY(-3px);
}

.template-card.offline {
  opacity: 0.6;
}

.card-preview {
  position: relative;
  height: 160px;
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%);
  overflow: hidden;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
}

.flow-thumbnail {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.mini-flow {
  width: 100%;
  height: 100%;
}

.preview-mask {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.75);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  opacity: 0;
  transition: var(--transition);
  color: white;
  font-size: 13px;
}

.card-preview:hover .preview-mask {
  opacity: 1;
}

.card-body {
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  cursor: pointer;
  transition: var(--transition);
}

.card-title:hover {
  color: var(--primary-light);
}

.offline-tag {
  font-size: 11px;
  padding: 2px 8px;
  background: rgba(148, 163, 184, 0.15);
  color: var(--text-secondary);
  border-radius: 10px;
  flex-shrink: 0;
}

.card-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
}

.card-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.card-tags :deep(.el-tag) {
  display: flex;
  align-items: center;
  gap: 4px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
  background: rgba(15, 23, 42, 0.3);
}

.creator-info {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.card-actions {
  display: flex;
  gap: 6px;
}

.empty-state {
  grid-column: 1/-1;
  text-align: center;
  padding: 80px 0;
  color: var(--text-secondary);
}

.empty-state p {
  margin-top: 12px;
}

.pagination-bar {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}

.template-detail {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.detail-header h3 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.detail-desc {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}

.detail-meta {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding: 16px;
  background: var(--bg-dark);
  border-radius: var(--radius-sm);
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.meta-value {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.flow-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: var(--bg-dark);
  border-radius: var(--radius-sm);
  max-height: 400px;
  overflow-y: auto;
}

.flow-node-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  transition: var(--transition);
}

.flow-node-item:hover {
  border-color: var(--primary);
}

.node-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}

.node-info {
  flex: 1;
  min-width: 0;
}

.node-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.node-type {
  font-size: 12px;
  color: var(--text-tertiary);
}

.empty-flow {
  text-align: center;
  padding: 30px 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.detail-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.fade-in-up {
  animation: fadeInUp 0.4s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
