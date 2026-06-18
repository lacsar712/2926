<template>
  <div class="page-container">
    <div class="page-header fade-in-up">
      <div style="display: flex; align-items: center; gap: 12px;">
        <el-button @click="$router.back()" text><el-icon><ArrowLeft /></el-icon>返回</el-button>
        <h2 class="page-title">运行对比</h2>
      </div>
    </div>

    <div class="compare-selector fade-in-up">
      <div class="selector-panel">
        <div class="selector-label">
          <span class="side-badge side-a">A</span>
          <span>基准运行</span>
        </div>
        <el-select
          v-model="selectedPipeline1"
          placeholder="选择生产线"
          style="width: 100%; margin-bottom: 12px;"
          @change="onPipelineChange('left')"
        >
          <el-option
            v-for="p in pipelines"
            :key="p.id"
            :label="p.name"
            :value="p.id"
          />
        </el-select>
        <el-select
          v-model="selectedRun1"
          placeholder="选择运行记录"
          style="width: 100%"
          :disabled="!selectedPipeline1"
          @change="onRunChange('left')"
        >
          <el-option
            v-for="r in runs1"
            :key="r.id"
            :label="formatRunLabel(r)"
            :value="r.id"
          />
        </el-select>
      </div>

      <div class="vs-divider">
        <el-icon :size="28" color="#818cf8"><DataAnalysis /></el-icon>
      </div>

      <div class="selector-panel">
        <div class="selector-label">
          <span class="side-badge side-b">B</span>
          <span>对比运行</span>
        </div>
        <el-select
          v-model="selectedPipeline2"
          placeholder="选择生产线"
          style="width: 100%; margin-bottom: 12px;"
          @change="onPipelineChange('right')"
        >
          <el-option
            v-for="p in pipelines"
            :key="p.id"
            :label="p.name"
            :value="p.id"
          />
        </el-select>
        <el-select
          v-model="selectedRun2"
          placeholder="选择运行记录"
          style="width: 100%"
          :disabled="!selectedPipeline2"
          @change="onRunChange('right')"
        >
          <el-option
            v-for="r in runs2"
            :key="r.id"
            :label="formatRunLabel(r)"
            :value="r.id"
          />
        </el-select>
      </div>
    </div>

    <div v-if="compareData" class="fade-in-up">
      <div class="summary-card">
        <div class="summary-header">
          <h4>对比结论</h4>
          <el-tag :type="summaryTagType" effect="light">
            {{ isBetter ? '整体提升' : '需关注' }}
          </el-tag>
        </div>
        <p class="summary-text">{{ compareData.textSummary }}</p>
      </div>

      <el-row :gutter="20" style="margin-bottom: 24px;">
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-icon" style="background: rgba(59,130,246,0.15); color: #3b82f6;">
              <el-icon :size="24"><Download /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-values-row">
                <span class="stat-val-a">{{ compareData.summaryDelta.total_input.value1.toLocaleString() }}</span>
                <el-icon :size="14" color="#94a3b8"><ArrowRight /></el-icon>
                <span class="stat-val-b">{{ compareData.summaryDelta.total_input.value2.toLocaleString() }}</span>
              </div>
              <p>总输入量</p>
              <div class="delta-badge" :class="getDeltaClass(compareData.summaryDelta.total_input, 'input')">
                <el-icon><component :is="getDeltaIcon(compareData.summaryDelta.total_input)" /></el-icon>
                <span>{{ formatDelta(compareData.summaryDelta.total_input) }}</span>
              </div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-icon" style="background: rgba(16,185,129,0.15); color: #10b981;">
              <el-icon :size="24"><Upload /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-values-row">
                <span class="stat-val-a">{{ compareData.summaryDelta.total_output.value1.toLocaleString() }}</span>
                <el-icon :size="14" color="#94a3b8"><ArrowRight /></el-icon>
                <span class="stat-val-b">{{ compareData.summaryDelta.total_output.value2.toLocaleString() }}</span>
              </div>
              <p>总输出量</p>
              <div class="delta-badge" :class="getDeltaClass(compareData.summaryDelta.total_output, 'output')">
                <el-icon><component :is="getDeltaIcon(compareData.summaryDelta.total_output)" /></el-icon>
                <span>{{ formatDelta(compareData.summaryDelta.total_output) }}</span>
              </div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-icon" style="background: rgba(239,68,68,0.15); color: #ef4444;">
              <el-icon :size="24"><WarningFilled /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-values-row">
                <span class="stat-val-a">{{ compareData.summaryDelta.error_count.value1 }}</span>
                <el-icon :size="14" color="#94a3b8"><ArrowRight /></el-icon>
                <span class="stat-val-b">{{ compareData.summaryDelta.error_count.value2 }}</span>
              </div>
              <p>错误数</p>
              <div class="delta-badge" :class="getDeltaClass(compareData.summaryDelta.error_count, 'error')">
                <el-icon><component :is="getDeltaIcon(compareData.summaryDelta.error_count)" /></el-icon>
                <span>{{ formatDelta(compareData.summaryDelta.error_count) }}</span>
              </div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-icon" style="background: rgba(245,158,11,0.15); color: #f59e0b;">
              <el-icon :size="24"><Clock /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-values-row">
                <span class="stat-val-a">{{ formatDuration(compareData.summaryDelta.duration_ms.value1) }}</span>
                <el-icon :size="14" color="#94a3b8"><ArrowRight /></el-icon>
                <span class="stat-val-b">{{ formatDuration(compareData.summaryDelta.duration_ms.value2) }}</span>
              </div>
              <p>运行耗时</p>
              <div class="delta-badge" :class="getDeltaClass(compareData.summaryDelta.duration_ms, 'duration')">
                <el-icon><component :is="getDeltaIcon(compareData.summaryDelta.duration_ms)" /></el-icon>
                <span>{{ formatDelta(compareData.summaryDelta.duration_ms) }}</span>
              </div>
            </div>
          </div>
        </el-col>
      </el-row>

      <div class="table-card">
        <div class="table-header">
          <h4>节点级对比</h4>
          <div style="display: flex; align-items: center; gap: 16px;">
            <span class="legend-item">
              <span class="legend-dot increase"></span>上升/增加
            </span>
            <span class="legend-item">
              <span class="legend-dot decrease"></span>下降/减少
            </span>
            <el-switch
              v-model="showDiffOnly"
              active-text="仅看差异行"
              inactive-text="显示全部"
              inline-prompt
            />
          </div>
        </div>
        <el-table :data="filteredNodeComparisons" stripe style="width: 100%">
          <el-table-column label="节点名称" min-width="160" fixed="left">
            <template #default="{ row }">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span>{{ row.node_name }}</span>
                <el-tag v-if="!row.exists1" size="small" type="info">新增</el-tag>
                <el-tag v-if="!row.exists2" size="small" type="danger">已移除</el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="120">
            <template #default="{ row }">{{ row.node_type || '-' }}</template>
          </el-table-column>
          <el-table-column label="状态" width="180">
            <template #default="{ row }">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="status-badge small" :class="row.status1">
                  <span class="dot"></span>{{ runStatusMap[row.status1] || '-' }}
                </span>
                <el-icon :size="12" color="#94a3b8"><ArrowRight /></el-icon>
                <span class="status-badge small" :class="row.status2">
                  <span class="dot"></span>{{ runStatusMap[row.status2] || '-' }}
                </span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="输入量" width="160">
            <template #default="{ row }">
              <div class="compare-cell">
                <span class="cell-val-a">{{ row.input_count.value1.toLocaleString() }}</span>
                <span class="cell-arrow">→</span>
                <span class="cell-val-b" :class="{ 'diff-increase': row.input_count.delta > 0, 'diff-decrease': row.input_count.delta < 0 }">
                  {{ row.input_count.value2.toLocaleString() }}
                </span>
                <span v-if="row.input_count.delta !== 0" class="cell-delta" :class="row.input_count.delta > 0 ? 'increase' : 'decrease'">
                  <el-icon :size="10"><component :is="getDeltaIcon(row.input_count)" /></el-icon>
                  {{ row.input_count.deltaPercent ? row.input_count.deltaPercent + '%' : (row.input_count.delta > 0 ? '+' : '') + row.input_count.delta }}
                </span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="输出量" width="160">
            <template #default="{ row }">
              <div class="compare-cell">
                <span class="cell-val-a">{{ row.output_count.value1.toLocaleString() }}</span>
                <span class="cell-arrow">→</span>
                <span class="cell-val-b" :class="{ 'diff-increase': row.output_count.delta > 0, 'diff-decrease': row.output_count.delta < 0 }">
                  {{ row.output_count.value2.toLocaleString() }}
                </span>
                <span v-if="row.output_count.delta !== 0" class="cell-delta" :class="row.output_count.delta > 0 ? 'increase' : 'decrease'">
                  <el-icon :size="10"><component :is="getDeltaIcon(row.output_count)" /></el-icon>
                  {{ row.output_count.deltaPercent ? row.output_count.deltaPercent + '%' : (row.output_count.delta > 0 ? '+' : '') + row.output_count.delta }}
                </span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="错误数" width="140">
            <template #default="{ row }">
              <div class="compare-cell">
                <span class="cell-val-a">{{ row.error_count.value1 }}</span>
                <span class="cell-arrow">→</span>
                <span class="cell-val-b" :class="{ 'diff-increase': row.error_count.delta > 0, 'diff-decrease': row.error_count.delta < 0 }">
                  {{ row.error_count.value2 }}
                </span>
                <span v-if="row.error_count.delta !== 0" class="cell-delta" :class="row.error_count.delta > 0 ? 'increase-error' : 'decrease-error'">
                  <el-icon :size="10"><component :is="getDeltaIcon(row.error_count)" /></el-icon>
                  {{ row.error_count.delta > 0 ? '+' : '' }}{{ row.error_count.delta }}
                </span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="耗时" width="180">
            <template #default="{ row }">
              <div class="compare-cell">
                <span class="cell-val-a">{{ formatDuration(row.duration_ms.value1) }}</span>
                <span class="cell-arrow">→</span>
                <span class="cell-val-b" :class="{ 'diff-increase': row.duration_ms.delta > 0, 'diff-decrease': row.duration_ms.delta < 0 }">
                  {{ formatDuration(row.duration_ms.value2) }}
                </span>
                <span v-if="row.duration_ms.delta !== 0" class="cell-delta" :class="row.duration_ms.delta > 0 ? 'increase' : 'decrease'">
                  <el-icon :size="10"><component :is="getDeltaIcon(row.duration_ms)" /></el-icon>
                  {{ row.duration_ms.deltaPercent ? row.duration_ms.deltaPercent + '%' : formatDuration(row.duration_ms.delta) }}
                </span>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <div v-else-if="loading" class="empty-state fade-in-up">
      <el-icon :size="48" color="#94a3b8"><Loading /></el-icon>
      <p>加载对比数据中...</p>
    </div>
    <div v-else class="empty-state fade-in-up">
      <el-icon :size="48" color="#94a3b8"><DataLine /></el-icon>
      <p>请在左右两侧选择要对比的运行记录</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/utils/request'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const pipelines = ref([])
const runs1 = ref([])
const runs2 = ref([])
const selectedPipeline1 = ref(null)
const selectedPipeline2 = ref(null)
const selectedRun1 = ref(null)
const selectedRun2 = ref(null)
const compareData = ref(null)
const showDiffOnly = ref(false)

const runStatusMap = { running: '运行中', completed: '已完成', failed: '失败', cancelled: '已取消', pending: '等待中' }

const formatRunLabel = (run) => {
  const status = runStatusMap[run.status] || run.status
  const time = dayjs(run.start_time).format('MM-DD HH:mm')
  return `#${run.id} ${time} (${status})`
}

const formatDuration = (ms) => {
  if (!ms || ms <= 0) return '-'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

const formatDelta = (deltaObj) => {
  if (deltaObj.delta === 0) return '无变化'
  const sign = deltaObj.delta > 0 ? '+' : ''
  if (deltaObj.deltaPercent !== null) {
    return `${sign}${deltaObj.deltaPercent}%`
  }
  return `${sign}${deltaObj.delta}`
}

const getDeltaIcon = (deltaObj) => {
  if (deltaObj.delta === 0) return 'Minus'
  return deltaObj.delta > 0 ? 'CaretTop' : 'CaretBottom'
}

const getDeltaClass = (deltaObj, metric) => {
  if (deltaObj.delta === 0) return 'neutral'
  const isIncrease = deltaObj.delta > 0
  if (metric === 'error' || metric === 'duration') {
    return isIncrease ? 'decrease' : 'increase'
  }
  return isIncrease ? 'increase' : 'decrease'
}

const hasNodeDiff = (node) => {
  return node.input_count.delta !== 0 ||
         node.output_count.delta !== 0 ||
         node.error_count.delta !== 0 ||
         node.duration_ms.delta !== 0 ||
         node.exists1 !== node.exists2
}

const filteredNodeComparisons = computed(() => {
  if (!compareData.value) return []
  if (!showDiffOnly.value) return compareData.value.nodeComparisons
  return compareData.value.nodeComparisons.filter(hasNodeDiff)
})

const isBetter = computed(() => {
  if (!compareData.value) return true
  const outputDelta = compareData.value.summaryDelta.total_output
  const errorDelta = compareData.value.summaryDelta.error_count
  let score = 0
  if (outputDelta.delta > 0) score++
  if (outputDelta.delta < 0) score--
  if (errorDelta.delta < 0) score++
  if (errorDelta.delta > 0) score--
  return score >= 0
})

const summaryTagType = computed(() => {
  return isBetter.value ? 'success' : 'warning'
})

const loadPipelines = async () => {
  try {
    const res = await api.get('/monitor/pipelines')
    pipelines.value = res.data
  } catch { /* handled */ }
}

const loadRuns = async (side) => {
  const pipelineId = side === 'left' ? selectedPipeline1.value : selectedPipeline2.value
  if (!pipelineId) {
    if (side === 'left') runs1.value = []
    else runs2.value = []
    return
  }
  try {
    const res = await api.get(`/monitor/pipelines/${pipelineId}/runs`)
    if (side === 'left') runs1.value = res.data
    else runs2.value = res.data
  } catch { /* handled */ }
}

const onPipelineChange = (side) => {
  if (side === 'left') {
    selectedRun1.value = null
  } else {
    selectedRun2.value = null
  }
  compareData.value = null
  loadRuns(side)
}

const onRunChange = () => {
  if (selectedRun1.value && selectedRun2.value) {
    loadCompareData()
  } else {
    compareData.value = null
  }
}

const loadCompareData = async () => {
  if (!selectedRun1.value || !selectedRun2.value) return
  loading.value = true
  try {
    const res = await api.get('/monitor/compare', {
      params: { runId1: selectedRun1.value, runId2: selectedRun2.value }
    })
    compareData.value = res.data
  } catch { /* handled */ } finally {
    loading.value = false
  }
}

const initFromQuery = () => {
  const runId = route.query.runId
  const side = route.query.side || 'left'
  const pipelineId = route.query.pipelineId

  if (pipelineId) {
    if (side === 'left') {
      selectedPipeline1.value = parseInt(pipelineId)
    } else {
      selectedPipeline2.value = parseInt(pipelineId)
    }
  }

  if (runId) {
    if (side === 'left') {
      selectedRun1.value = parseInt(runId)
    } else {
      selectedRun2.value = parseInt(runId)
    }
  }
}

onMounted(async () => {
  await loadPipelines()
  initFromQuery()
  if (selectedPipeline1.value) await loadRuns('left')
  if (selectedPipeline2.value) await loadRuns('right')
  if (selectedRun1.value && selectedRun2.value) {
    loadCompareData()
  }
})
</script>

<style scoped>
.compare-selector {
  display: flex;
  align-items: stretch;
  gap: 0;
  margin-bottom: 24px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 24px;
}

.selector-panel {
  flex: 1;
  padding: 0 16px;
}

.selector-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.side-badge {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: white;
}
.side-a { background: linear-gradient(135deg, #6366f1, #818cf8); }
.side-b { background: linear-gradient(135deg, #10b981, #34d399); }

.vs-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px;
  border-left: 1px solid var(--border-color);
  border-right: 1px solid var(--border-color);
}

.summary-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 20px 24px;
  margin-bottom: 24px;
  background: linear-gradient(135deg, rgba(99,102,241,0.05), rgba(16,185,129,0.05));
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.summary-header h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.summary-text {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.stat-values-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.stat-val-a {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
}

.stat-val-b {
  font-size: 18px;
  color: var(--text-primary);
  font-weight: 700;
}

.delta-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  margin-top: 4px;
}

.delta-badge.increase {
  background: rgba(16,185,129,0.15);
  color: #10b981;
}

.delta-badge.decrease {
  background: rgba(239,68,68,0.15);
  color: #ef4444;
}

.delta-badge.neutral {
  background: rgba(148,163,184,0.15);
  color: #94a3b8;
}

.table-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 20px 24px;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.table-header h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend-dot.increase { background: #10b981; }
.legend-dot.decrease { background: #ef4444; }

.compare-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.cell-val-a {
  color: var(--text-secondary);
  font-size: 12px;
}

.cell-arrow {
  color: #64748b;
  font-size: 11px;
}

.cell-val-b {
  font-weight: 600;
  color: var(--text-primary);
}

.cell-val-b.diff-increase { color: #10b981; }
.cell-val-b.diff-decrease { color: #ef4444; }

.cell-delta {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 8px;
}

.cell-delta.increase {
  background: rgba(16,185,129,0.1);
  color: #10b981;
}

.cell-delta.decrease {
  background: rgba(239,68,68,0.1);
  color: #ef4444;
}

.cell-delta.increase-error {
  background: rgba(239,68,68,0.1);
  color: #ef4444;
}

.cell-delta.decrease-error {
  background: rgba(16,185,129,0.1);
  color: #10b981;
}

.status-badge.small {
  font-size: 10px;
  padding: 2px 6px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: var(--text-secondary);
  gap: 12px;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

.stat-card .stat-info h3 {
  font-size: 18px;
}
</style>
