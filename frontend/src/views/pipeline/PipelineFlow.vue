<template>
  <div class="flow-page">
    <!-- 左侧组件面板 -->
    <aside class="component-panel">
      <div class="panel-header">
        <div class="panel-header-row">
          <h3>组件库</h3>
          <el-button size="small" text @click="openDocDrawer('')"><el-icon><Document /></el-icon>文档</el-button>
        </div>
        <el-input v-model="searchComp" placeholder="搜索组件..." size="small" clearable prefix-icon="Search" />
      </div>
      <div class="component-list">
        <div v-for="cat in filteredCategories" :key="cat.key" class="comp-category">
          <div class="cat-title" @click="cat.expanded = !cat.expanded">
            <span class="cat-icon" :style="{ background: cat.color }">
              <el-icon><component :is="cat.icon" /></el-icon>
            </span>
            <span>{{ cat.label }}</span>
            <el-icon class="expand-icon" :class="{ rotated: cat.expanded }"><ArrowDown /></el-icon>
          </div>
          <transition name="slide">
            <div v-show="cat.expanded" class="cat-items">
              <div v-for="comp in cat.components" :key="comp.key" class="comp-item" draggable="true"
                @dragstart="onDragStart($event, cat.key, comp)" @click="addNode(cat.key, comp)">
                <span class="comp-dot" :style="{ background: cat.color }"></span>
                <span>{{ comp.label }}</span>
                <el-icon class="doc-icon" @click.stop="openDocDrawer(comp.key)"><Document /></el-icon>
                <el-icon class="add-icon"><Plus /></el-icon>
              </div>
            </div>
          </transition>
        </div>
      </div>
    </aside>

    <!-- 中间画布 -->
    <div class="canvas-area" @drop="onDrop" @dragover.prevent>
      <div class="canvas-toolbar">
        <div class="toolbar-left">
          <el-button @click="$router.back()" text><el-icon><ArrowLeft /></el-icon>返回</el-button>
          <el-divider direction="vertical" />
          <span class="pipeline-name">{{ pipelineName }}</span>
        </div>
        <div class="toolbar-right">
          <el-button size="small" plain @click="showCommentDrawer = true">
            <el-badge :value="commentCount" :hidden="commentCount === 0" class="toolbar-badge">
              <el-icon><ChatDotRound /></el-icon>讨论
            </el-badge>
          </el-button>
          <el-button size="small" plain @click="handleCheck"><el-icon><CircleCheck /></el-icon>检查</el-button>
          <el-button size="small" plain @click="handleSave" :loading="saving"><el-icon><FolderOpened /></el-icon>保存</el-button>
          <el-button size="small" type="primary" @click="handlePublish"><el-icon><Upload /></el-icon>发布</el-button>
          <el-button size="small" plain @click="showHistory = true"><el-icon><Clock /></el-icon>历史</el-button>
        </div>
      </div>
      <VueFlow
        ref="vueFlowRef"
        v-model:nodes="nodes"
        v-model:edges="edges"
        :default-viewport="{ zoom: 0.85, x: 50, y: 50 }"
        :connection-mode="ConnectionMode.Loose"
        :snap-to-grid="true"
        :snap-grid="[20, 20]"
        fit-view-on-init
        @connect="onConnect"
        @node-click="onNodeClick"
        @pane-click="selectedNode = null"
        class="flow-canvas"
      >
        <template #node-custom="nodeProps">
          <div class="custom-node" :class="{ selected: selectedNode?.id === nodeProps.id }" :style="{ borderColor: getCatColor(nodeProps.data.category) }">
            <div class="node-header" :style="{ background: getCatColor(nodeProps.data.category) + '22' }">
              <span class="node-cat-dot" :style="{ background: getCatColor(nodeProps.data.category) }"></span>
              <span class="node-label">{{ nodeProps.data.label }}</span>
            </div>
            <div class="node-body">
              <span class="node-type">{{ getCatLabel(nodeProps.data.category) }}</span>
            </div>
            <Handle type="target" :position="Position.Left" />
            <Handle type="source" :position="Position.Right" />
          </div>
        </template>
        <Background :gap="20" :size="1" pattern-color="rgba(99,102,241,0.08)" />
        <Controls position="bottom-left" />
        <MiniMap :node-color="miniMapNodeColor" :mask-color="'rgba(15,23,42,0.8)'" position="bottom-right" />
      </VueFlow>
    </div>

    <!-- 右侧配置面板 -->
    <aside class="config-panel" :class="{ open: !!selectedNode }">
      <template v-if="selectedNode">
        <div class="config-header">
          <h3>{{ selectedNode.data.label }}</h3>
          <el-button text circle @click="selectedNode = null"><el-icon><Close /></el-icon></el-button>
        </div>
        <el-divider />
        <el-form label-position="top" size="small">
          <el-form-item label="组件名称">
            <el-input v-model="selectedNode.data.label" @change="syncNodeData" />
          </el-form-item>
          <el-form-item label="组件类型">
            <el-tag :color="getCatColor(selectedNode.data.category) + '22'" :style="{ color: getCatColor(selectedNode.data.category) }">
              {{ getCatLabel(selectedNode.data.category) }} / {{ selectedNode.data.component }}
            </el-tag>
          </el-form-item>
          <el-divider>参数配置</el-divider>
          <template v-if="selectedNode.data.config">
            <el-form-item v-for="(value, key) in selectedNode.data.config" :key="key" v-show="key !== 'qualityRuleIds'" :label="configLabels[key] || key">
              <el-switch v-if="typeof value === 'boolean'" v-model="selectedNode.data.config[key]" @change="syncNodeData" />
              <el-input-number v-else-if="typeof value === 'number'" v-model="selectedNode.data.config[key]" :min="0" style="width: 100%" @change="syncNodeData" />
              <el-select v-else-if="Array.isArray(value)" v-model="selectedNode.data.config[key]" multiple allow-create filterable style="width: 100%" @change="syncNodeData">
                <el-option v-for="v in value" :key="v" :label="v" :value="v" />
              </el-select>
              <el-input v-else v-model="selectedNode.data.config[key]" @change="syncNodeData" />
            </el-form-item>
          </template>
          <el-divider>数据质量</el-divider>
          <el-form-item label="绑定质量规则">
            <el-select
              v-model="selectedNode.data.config.qualityRuleIds"
              multiple
              filterable
              clearable
              placeholder="选择质量规则"
              style="width: 100%"
              @change="syncNodeData"
            >
              <el-option
                v-for="rule in qualityRules"
                :key="rule.id"
                :label="`${rule.name} [${rule.rule_type}]`"
                :value="rule.id"
              >
                <span style="float: left">{{ rule.name }}</span>
                <span style="float: right; color: var(--text-secondary); font-size: 12px">
                  <el-tag size="small" :type="rule.severity === 'error' ? 'danger' : 'warning'" effect="light">
                    {{ rule.severity }}
                  </el-tag>
                </span>
              </el-option>
            </el-select>
          </el-form-item>
        </el-form>
        <div class="config-actions">
          <el-popconfirm title="确认删除此组件？" @confirm="deleteNode(selectedNode.id)">
            <template #reference>
              <el-button type="danger" plain size="small" style="width: 100%"><el-icon><Delete /></el-icon>删除组件</el-button>
            </template>
          </el-popconfirm>
        </div>
      </template>
      <div v-else class="config-empty">
        <el-icon :size="32" color="var(--text-secondary)"><InfoFilled /></el-icon>
        <p>点击画布中的组件<br />查看和编辑配置</p>
      </div>
    </aside>

    <!-- 历史记录抽屉 -->
    <el-drawer v-model="showHistory" title="发布历史" size="400px">
      <div v-loading="historyLoading">
        <el-timeline v-if="historyList.length">
          <el-timeline-item v-for="h in historyList" :key="h.id" :timestamp="formatDate(h.created_at)" placement="top" :color="'var(--primary)'">
            <div class="history-item">
              <div class="history-meta">
                <el-tag size="small" type="primary">v{{ h.version }}</el-tag>
                <span>{{ h.operator }}</span>
                <span class="history-action">{{ h.action === 'publish' ? '发布' : '回滚' }}</span>
              </div>
              <p v-if="h.remark" class="history-remark">{{ h.remark }}</p>
            </div>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else description="暂无发布记录" />
      </div>
    </el-drawer>

    <!-- 组件文档抽屉 -->
    <ComponentDocDrawer v-model="showDocDrawer" :component-type="docComponentType" />

    <!-- 讨论抽屉 -->
    <PipelineCommentDrawer v-model="showCommentDrawer" :pipeline-id="pipelineId" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, markRaw, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { VueFlow, useVueFlow, Position, ConnectionMode, Handle } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/request'
import dayjs from 'dayjs'
import { getQualityRules } from '@/api/quality-rule'
import { getCommentSummary } from '@/api/pipeline-comment'
import ComponentDocDrawer from '@/components/ComponentDocDrawer.vue'
import PipelineCommentDrawer from '@/components/PipelineCommentDrawer.vue'

const route = useRoute()
const router = useRouter()
const pipelineId = route.params.id

const nodes = ref([])
const edges = ref([])
const selectedNode = ref(null)
const pipelineName = ref('')
const saving = ref(false)
const showHistory = ref(false)
const historyLoading = ref(false)
const historyList = ref([])
const searchComp = ref('')
const vueFlowRef = ref(null)
const qualityRules = ref([])
const showDocDrawer = ref(false)
const docComponentType = ref('')
const showCommentDrawer = ref(false)
const commentCount = ref(0)

let nodeCounter = 100

const loadQualityRules = async () => {
  try {
    const res = await getQualityRules()
    qualityRules.value = (res.data || []).filter(r => r.enabled)
  } catch { /* handled */ }
}

const loadCommentCount = async () => {
  try {
    const res = await getCommentSummary(pipelineId)
    commentCount.value = res.data?.comment_count || 0
  } catch { commentCount.value = 0 }
}

const openDocDrawer = (componentType) => {
  docComponentType.value = componentType
  showDocDrawer.value = true
}

const categories = reactive([
  {
    key: 'data-access', label: '数据接入', icon: 'Download', color: '#3b82f6', expanded: true,
    components: [
      { key: 'database-reader', label: 'MySQL数据读取', config: { host: '10.0.1.100', port: 3306, database: 'data_source', table: 'raw_data' } },
      { key: 'api-connector', label: 'API数据采集', config: { url: 'https://api.example.com/data', method: 'GET', interval: '5m', format: 'json' } },
      { key: 'file-reader', label: '文件数据读取', config: { path: '/data/input', format: 'csv', encoding: 'utf-8', batchSize: 1000 } },
      { key: 'kafka-consumer', label: 'Kafka消费者', config: { brokers: 'kafka:9092', topic: 'data-input', groupId: 'pipeline-group' } },
      { key: 'ftp-loader', label: 'FTP文件加载', config: { host: 'ftp.example.com', port: 21, username: 'reader', remotePath: '/data' } }
    ]
  },
  {
    key: 'data-preprocess', label: '数据预处理', icon: 'MagicStick', color: '#10b981', expanded: false,
    components: [
      { key: 'data-cleaner', label: '数据清洗', config: { removeNull: true, removeDuplicate: true, trimWhitespace: true } },
      { key: 'text-normalizer', label: '文本归一化', config: { lowercase: false, removeSpecialChars: true, encoding: 'utf-8' } },
      { key: 'data-filter', label: '数据过滤', config: { conditions: ['field != null'], mode: 'AND' } },
      { key: 'text-splitter', label: '文本分段', config: { method: 'paragraph', maxLength: 512, overlap: 50 } },
      { key: 'format-converter', label: '格式转换', config: { inputFormat: 'json', outputFormat: 'csv', dateFormat: 'YYYY-MM-DD' } }
    ]
  },
  {
    key: 'model-labeling', label: '模型打标', icon: 'Stamp', color: '#f59e0b', expanded: false,
    components: [
      { key: 'ner-model', label: 'NER实体识别', config: { model: 'bert-base-chinese', entityTypes: ['PER', 'ORG', 'LOC', 'TIME'], confidence: 0.85 } },
      { key: 'sentiment-model', label: '情感分析', config: { model: 'sentiment-bert', labels: ['positive', 'negative', 'neutral'] } },
      { key: 'classify-model', label: '文本分类', config: { model: 'text-classifier', categories: ['科技', '财经', '体育', '娱乐'], threshold: 0.7 } },
      { key: 'custom-model', label: '自定义模型', config: { modelPath: '/models/custom', inputField: 'text', outputField: 'label' } }
    ]
  },
  {
    key: 'entity-extract', label: '实体抽取', icon: 'Promotion', color: '#ef4444', expanded: false,
    components: [
      { key: 'rule-extractor', label: '规则抽取', config: { rules: ['正则表达式'], fieldName: 'entity', caseSensitive: false } },
      { key: 'medical-ner', label: '医学实体识别', config: { model: 'biobert-ner', entityTypes: ['疾病', '药物', '症状', '治疗方案'], confidence: 0.9 } },
      { key: 'finance-ner', label: '金融实体识别', config: { entityTypes: ['公司', '股票', '行业', '人物'] } },
      { key: 'address-parser', label: '地址解析', config: { level: 'district', includeCoords: true } }
    ]
  },
  {
    key: 'relation-build', label: '关系构建', icon: 'Connection', color: '#8b5cf6', expanded: false,
    components: [
      { key: 'relation-extractor', label: '关系抽取', config: { model: 're-bert-chinese', relationTypes: ['任职', '投资', '合作', '收购'], threshold: 0.8 } },
      { key: 'co-occurrence', label: '共现分析', config: { windowSize: 5, minFrequency: 3, method: 'PMI' } },
      { key: 'causal-analysis', label: '因果关系分析', config: { model: 'causal-bert', confidence: 0.75 } },
      { key: 'event-extractor', label: '事件抽取', config: { eventTypes: ['并购', '融资', '合作', '发布'], extractArgs: true } }
    ]
  },
  {
    key: 'knowledge-production', label: '知识数据生产', icon: 'Cpu', color: '#06b6d4', expanded: false,
    components: [
      { key: 'kg-builder', label: '知识图谱构建', config: { graphDB: 'neo4j', host: '10.0.1.200', port: 7687 } },
      { key: 'kg-writer', label: '知识库写入', config: { target: 'elasticsearch', index: 'knowledge_base' } },
      { key: 'data-fusion', label: '数据融合', config: { strategy: 'voting', sources: 3, conflictResolution: 'latest' } },
      { key: 'quality-check', label: '质量校验', config: { rules: ['完整性', '一致性', '准确性'], strictMode: false } }
    ]
  },
  {
    key: 'data-browse', label: '数据浏览', icon: 'Monitor', color: '#ec4899', expanded: false,
    components: [
      { key: 'graph-viewer', label: '图谱浏览器', config: { maxNodes: 500, layout: 'force' } },
      { key: 'data-dashboard', label: '数据看板', config: { refreshInterval: 30, chartTypes: ['line', 'bar', 'pie'] } },
      { key: 'data-export', label: '数据导出', config: { format: 'csv', encoding: 'utf-8', maxRows: 100000 } },
      { key: 'report-generator', label: '报告生成', config: { template: 'default', format: 'pdf', includeCharts: true } }
    ]
  }
])

const configLabels = {
  host: '服务器地址', port: '端口', database: '数据库名', table: '表名',
  url: 'API地址', method: '请求方法', interval: '采集间隔', format: '数据格式',
  path: '文件路径', encoding: '编码', batchSize: '批次大小',
  brokers: 'Broker地址', topic: '主题', groupId: '消费组',
  username: '用户名', remotePath: '远程路径',
  removeNull: '移除空值', removeDuplicate: '去重', trimWhitespace: '去除空白',
  lowercase: '转小写', removeSpecialChars: '去特殊字符',
  conditions: '过滤条件', mode: '过滤模式',
  maxLength: '最大长度', overlap: '重叠长度',
  inputFormat: '输入格式', outputFormat: '输出格式', dateFormat: '日期格式',
  model: '模型名称', modelPath: '模型路径', entityTypes: '实体类型',
  confidence: '置信度阈值', labels: '标签列表', categories: '分类列表',
  threshold: '阈值', rules: '规则列表', fieldName: '字段名',
  caseSensitive: '区分大小写', level: '解析级别', includeCoords: '包含坐标',
  relationTypes: '关系类型', windowSize: '窗口大小', minFrequency: '最小频率',
  eventTypes: '事件类型', extractArgs: '提取参数',
  graphDB: '图数据库', target: '目标存储', index: '索引名',
  strategy: '融合策略', sources: '数据源数', conflictResolution: '冲突处理',
  strictMode: '严格模式', maxNodes: '最大节点数', layout: '布局方式',
  refreshInterval: '刷新间隔(秒)', chartTypes: '图表类型',
  maxRows: '最大行数', template: '模板', includeCharts: '包含图表',
  inputField: '输入字段', outputField: '输出字段'
}

const filteredCategories = computed(() => {
  if (!searchComp.value) return categories
  const kw = searchComp.value.toLowerCase()
  return categories.map(cat => ({
    ...cat,
    expanded: true,
    components: cat.components.filter(c => c.label.toLowerCase().includes(kw) || c.key.toLowerCase().includes(kw))
  })).filter(cat => cat.components.length > 0)
})

const getCatColor = (key) => categories.find(c => c.key === key)?.color || '#94a3b8'
const getCatLabel = (key) => categories.find(c => c.key === key)?.label || key
const formatDate = (d) => d ? dayjs(d).format('YYYY-MM-DD HH:mm:ss') : '-'
const miniMapNodeColor = (node) => getCatColor(node.data?.category)

const addNode = (catKey, comp) => {
  const id = `node-${++nodeCounter}`
  const cfg = JSON.parse(JSON.stringify(comp.config || {}))
  if (!cfg.qualityRuleIds) cfg.qualityRuleIds = []
  const newNode = {
    id,
    type: 'custom',
    position: { x: 200 + Math.random() * 400, y: 100 + Math.random() * 300 },
    data: {
      category: catKey,
      component: comp.key,
      label: comp.label,
      config: cfg
    }
  }
  nodes.value = [...nodes.value, newNode]
}

const onDragStart = (event, catKey, comp) => {
  event.dataTransfer.setData('application/json', JSON.stringify({ catKey, comp }))
  event.dataTransfer.effectAllowed = 'move'
}

const onDrop = (event) => {
  const data = event.dataTransfer.getData('application/json')
  if (!data) return
  const { catKey, comp } = JSON.parse(data)
  const bounds = event.currentTarget.getBoundingClientRect()
  const id = `node-${++nodeCounter}`
  const cfg = JSON.parse(JSON.stringify(comp.config || {}))
  if (!cfg.qualityRuleIds) cfg.qualityRuleIds = []
  const newNode = {
    id,
    type: 'custom',
    position: { x: event.clientX - bounds.left - 80, y: event.clientY - bounds.top - 30 },
    data: {
      category: catKey,
      component: comp.key,
      label: comp.label,
      config: cfg
    }
  }
  nodes.value = [...nodes.value, newNode]
}

const onConnect = (params) => {
  const newEdge = {
    id: `e-${params.source}-${params.target}`,
    source: params.source,
    target: params.target,
    animated: true,
    style: { stroke: 'var(--primary)', strokeWidth: 2 }
  }
  edges.value = [...edges.value, newEdge]
}

const onNodeClick = (event) => {
  const node = nodes.value.find(n => n.id === event.node.id)
  if (node) selectedNode.value = node
}

const syncNodeData = () => {
  nodes.value = [...nodes.value]
}

const deleteNode = (id) => {
  nodes.value = nodes.value.filter(n => n.id !== id)
  edges.value = edges.value.filter(e => e.source !== id && e.target !== id)
  selectedNode.value = null
}

const handleSave = async (validateRules = true) => {
  saving.value = true
  try {
    const res = await api.put(`/flows/${pipelineId}`, {
      flowData: { nodes: nodes.value, edges: edges.value },
      validateRules
    })
    if (res.warningSummary && res.ruleWarnings && res.ruleWarnings.length > 0) {
      const warnText = res.ruleWarnings.map(w => `[${w.nodeLabel}] ${w.message}`).join('\n')
      ElMessageBox.alert(
        `保存成功，但检测到 ${res.ruleWarnings.length} 个规则绑定警告：\n\n${warnText}`,
        '保存成功（含警告）',
        { type: 'warning', confirmButtonText: '知道了' }
      )
    } else {
      ElMessage.success('保存成功')
    }
  } catch { /* handled */ } finally { saving.value = false }
}

const handleCheck = async () => {
  try {
    const res = await api.post(`/flows/${pipelineId}/check`)
    if (res.data.valid) {
      ElMessage.success('编排检查通过，所有组件连接正常')
    } else {
      ElMessageBox.alert(res.data.errors.join('\n'), '检查发现问题', { type: 'warning', confirmButtonText: '知道了' })
    }
  } catch { /* handled */ }
}

const handlePublish = async () => {
  try {
    await handleSave()
    const { value: remark } = await ElMessageBox.prompt('请输入发布备注', '发布确认', {
      confirmButtonText: '发布', cancelButtonText: '取消', inputPlaceholder: '可选备注信息...'
    })
    await api.post(`/flows/${pipelineId}/publish`, { remark })
    ElMessage.success('发布成功')
  } catch { /* handled */ }
}

const loadHistory = async () => {
  historyLoading.value = true
  try {
    const res = await api.get(`/flows/${pipelineId}/history`)
    historyList.value = res.data
  } catch { /* handled */ } finally { historyLoading.value = false }
}

const loadFlow = async () => {
  try {
    const pRes = await api.get(`/pipelines/${pipelineId}`)
    pipelineName.value = pRes.data.name
    const fRes = await api.get(`/flows/${pipelineId}`)
    if (fRes.data?.flow_data) {
      const fd = fRes.data.flow_data
      nodes.value = (fd.nodes || []).map(n => {
        const mapped = { ...n, type: 'custom' }
        if (!mapped.data.config) mapped.data.config = {}
        if (!mapped.data.config.qualityRuleIds) mapped.data.config.qualityRuleIds = []
        return mapped
      })
      edges.value = (fd.edges || []).map(e => ({ ...e, animated: true, style: { stroke: 'var(--primary)', strokeWidth: 2 } }))
      nodeCounter = Math.max(nodeCounter, ...nodes.value.map(n => parseInt(n.id.replace('node-', '')) || 0))
    }
  } catch { /* handled */ }
}

onMounted(() => { loadFlow(); loadHistory(); loadQualityRules(); loadCommentCount() })

watch(showCommentDrawer, (val) => {
  if (!val) loadCommentCount()
})
</script>

<style scoped>
.flow-page {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* 左侧组件面板 */
.component-panel {
  width: 260px;
  background: var(--bg-card);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.panel-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}
.panel-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.panel-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.component-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.comp-category { margin-bottom: 4px; }
.cat-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  transition: var(--transition);
}
.cat-title:hover { background: var(--bg-hover); }
.cat-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
  flex-shrink: 0;
}
.expand-icon {
  margin-left: auto;
  transition: transform 0.3s;
  color: var(--text-secondary);
  font-size: 12px;
}
.expand-icon.rotated { transform: rotate(180deg); }
.cat-items { padding: 4px 0 4px 16px; }
.comp-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: grab;
  transition: var(--transition);
}
.comp-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.comp-item:active { cursor: grabbing; }
.comp-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.add-icon {
  margin-left: auto;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.2s;
}
.comp-item:hover .add-icon { opacity: 1; }
.doc-icon {
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.2s;
  color: var(--text-secondary);
  margin-left: auto;
}
.doc-icon:hover { color: var(--primary); }
.comp-item:hover .doc-icon { opacity: 1; }
.comp-item:hover .doc-icon + .add-icon { margin-left: 4px; }

/* 画布区域 */
.canvas-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.canvas-toolbar {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: rgba(30, 41, 59, 0.8);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}
.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pipeline-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.flow-canvas {
  flex: 1;
  background: var(--bg-dark);
}

/* 自定义节点 */
.custom-node {
  min-width: 160px;
  background: var(--bg-card);
  border: 2px solid var(--border-color);
  border-radius: 10px;
  overflow: hidden;
  transition: var(--transition);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
.custom-node:hover, .custom-node.selected {
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.3);
  transform: translateY(-1px);
}
.node-header {
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.node-cat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.node-body {
  padding: 6px 12px 10px;
}
.node-type {
  font-size: 11px;
  color: var(--text-secondary);
}

/* 右侧配置面板 */
.config-panel {
  width: 0;
  background: var(--bg-card);
  border-left: 1px solid var(--border-color);
  overflow-y: auto;
  transition: width 0.3s ease;
  flex-shrink: 0;
}
.config-panel.open {
  width: 320px;
  padding: 20px;
}
.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.config-header h3 {
  font-size: 16px;
  font-weight: 600;
}
.config-actions {
  margin-top: 24px;
}
.config-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}
.config-empty p { margin-top: 12px; }

/* 历史 */
.history-item { padding: 4px 0; }
.history-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}
.history-action {
  padding: 2px 8px;
  background: rgba(99, 102, 241, 0.15);
  border-radius: 10px;
  font-size: 11px;
  color: var(--primary);
}
.history-remark {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

/* Vue Flow 覆盖 */
:deep(.vue-flow__edge-path) { stroke: var(--primary) !important; }
:deep(.vue-flow__controls) { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm); }
:deep(.vue-flow__controls button) { background: transparent; color: var(--text-secondary); border-bottom: 1px solid var(--border-color); }
:deep(.vue-flow__controls button:hover) { background: var(--bg-hover); }
:deep(.vue-flow__controls button svg) { fill: var(--text-secondary); }
:deep(.vue-flow__minimap) { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm); }
:deep(.vue-flow__handle) { width: 10px; height: 10px; background: var(--primary); border: 2px solid var(--bg-card); }

.slide-enter-active, .slide-leave-active { transition: all 0.3s ease; overflow: hidden; }
.slide-enter-from, .slide-leave-to { max-height: 0; opacity: 0; }
.slide-enter-to, .slide-leave-from { max-height: 500px; opacity: 1; }

.toolbar-badge :deep(.el-badge__content) {
  transform: translate(8px, -8px);
}
</style>
