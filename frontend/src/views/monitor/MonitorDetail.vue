<template>
  <div class="page-container">
    <div class="page-header fade-in-up">
      <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
        <el-button @click="$router.back()" text><el-icon><ArrowLeft /></el-icon>返回</el-button>
        <h2 class="page-title">{{ runDetail?.pipeline_name || '监控详情' }}</h2>
        <span class="status-badge" :class="runDetail?.status">
          <span class="dot"></span>{{ runStatusMap[runDetail?.status] }}
        </span>
      </div>
      <div class="header-actions">
        <el-button type="primary" plain :icon="DataAnalysis" @click="addToCompare">
          加入对比
        </el-button>
      </div>
    </div>

    <!-- 运行概要 -->
    <el-row :gutter="20" class="fade-in-up" style="margin-bottom: 24px;">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: rgba(59,130,246,0.15); color: #3b82f6;">
            <el-icon :size="24"><Download /></el-icon>
          </div>
          <div class="stat-info">
            <h3>{{ runDetail?.total_input?.toLocaleString() || 0 }}</h3>
            <p>总输入量</p>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: rgba(16,185,129,0.15); color: #10b981;">
            <el-icon :size="24"><Upload /></el-icon>
          </div>
          <div class="stat-info">
            <h3>{{ runDetail?.total_output?.toLocaleString() || 0 }}</h3>
            <p>总输出量</p>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: rgba(239,68,68,0.15); color: #ef4444;">
            <el-icon :size="24"><WarningFilled /></el-icon>
          </div>
          <div class="stat-info">
            <h3>{{ runDetail?.error_count || 0 }}</h3>
            <p>错误数</p>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: rgba(245,158,11,0.15); color: #f59e0b;">
            <el-icon :size="24"><Clock /></el-icon>
          </div>
          <div class="stat-info">
            <h3>{{ calcDuration(runDetail?.start_time, runDetail?.end_time) }}</h3>
            <p>运行耗时</p>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 节点流转可视化 -->
    <div class="flow-monitor-card fade-in-up" style="margin-bottom: 24px;">
      <h4>数据流转可视化</h4>
      <div class="flow-pipeline">
        <div v-for="(node, idx) in nodeDetails" :key="node.id" class="flow-node-wrapper">
          <div class="flow-node" :class="node.status" @click="selectedNodeDetail = node">
            <div class="flow-node-icon" :class="node.status">
              <el-icon v-if="node.status === 'completed'"><CircleCheck /></el-icon>
              <el-icon v-else-if="node.status === 'running'" class="spin"><Loading /></el-icon>
              <el-icon v-else-if="node.status === 'failed'"><CircleClose /></el-icon>
              <el-icon v-else><Clock /></el-icon>
            </div>
            <div class="flow-node-info">
              <span class="flow-node-name">{{ node.node_name }}</span>
              <span class="flow-node-type">{{ node.node_type }}</span>
            </div>
            <div class="flow-node-stats">
              <div class="flow-stat">
                <span class="flow-stat-label">输入</span>
                <span class="flow-stat-value" style="color: var(--info);">{{ node.input_count?.toLocaleString() }}</span>
              </div>
              <div class="flow-stat">
                <span class="flow-stat-label">输出</span>
                <span class="flow-stat-value" style="color: var(--success);">{{ node.output_count?.toLocaleString() }}</span>
              </div>
              <div class="flow-stat" v-if="node.error_count > 0">
                <span class="flow-stat-label">错误</span>
                <span class="flow-stat-value" style="color: var(--danger);">{{ node.error_count }}</span>
              </div>
            </div>
            <div class="flow-progress">
              <div class="flow-progress-bar" :class="node.status"
                :style="{ width: node.status === 'completed' ? '100%' : node.status === 'running' ? '60%' : '0%' }">
              </div>
            </div>
          </div>
          <div v-if="idx < nodeDetails.length - 1" class="flow-arrow">
            <div class="arrow-line" :class="{ active: node.status === 'completed' }">
              <div class="arrow-particle" v-if="node.status === 'completed'"></div>
            </div>
            <el-icon class="arrow-icon" :class="{ active: node.status === 'completed' }"><ArrowRight /></el-icon>
          </div>
        </div>
      </div>
    </div>

    <!-- 节点数据详情 -->
    <div class="detail-card fade-in-up" v-if="selectedNodeDetail">
      <div class="detail-header">
        <h4>节点详情 - {{ selectedNodeDetail.node_name }}</h4>
        <el-button text circle @click="selectedNodeDetail = null"><el-icon><Close /></el-icon></el-button>
      </div>
      <el-row :gutter="20">
        <el-col :span="12">
          <div class="data-section">
            <h5><el-icon><Download /></el-icon> 输入数据样例</h5>
            <pre class="data-preview">{{ formatJson(selectedNodeDetail.input_sample) }}</pre>
          </div>
        </el-col>
        <el-col :span="12">
          <div class="data-section">
            <h5><el-icon><Upload /></el-icon> 输出数据样例</h5>
            <pre class="data-preview">{{ formatJson(selectedNodeDetail.output_sample) }}</pre>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 节点运行详情表 -->
    <div class="table-card fade-in-up">
      <h4>节点运行详情</h4>
      <el-table :data="nodeDetails" stripe>
        <el-table-column prop="node_name" label="节点名称" min-width="140" />
        <el-table-column prop="node_type" label="类型" width="140" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span class="status-badge" :class="row.status"><span class="dot"></span>{{ nodeStatusMap[row.status] }}</span>
          </template>
        </el-table-column>
        <el-table-column label="输入" width="100">
          <template #default="{ row }"><span style="color: var(--info);">{{ row.input_count?.toLocaleString() }}</span></template>
        </el-table-column>
        <el-table-column label="输出" width="100">
          <template #default="{ row }"><span style="color: var(--success);">{{ row.output_count?.toLocaleString() }}</span></template>
        </el-table-column>
        <el-table-column label="错误" width="80">
          <template #default="{ row }"><span :style="{color: row.error_count > 0 ? 'var(--danger)' : 'var(--text-secondary)'}">{{ row.error_count }}</span></template>
        </el-table-column>
        <el-table-column label="耗时" width="120">
          <template #default="{ row }">{{ calcDuration(row.start_time, row.end_time) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="selectedNodeDetail = row">
              <el-icon><View /></el-icon>数据
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DataAnalysis } from '@element-plus/icons-vue'
import api from '@/utils/request'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const runId = route.params.id
const runDetail = ref(null)
const nodeDetails = ref([])
const selectedNodeDetail = ref(null)

const runStatusMap = { running: '运行中', completed: '已完成', failed: '失败', cancelled: '已取消' }
const nodeStatusMap = { pending: '等待中', running: '运行中', completed: '已完成', failed: '失败' }

const addToCompare = () => {
  if (!runDetail.value) return
  router.push({
    path: '/monitor/compare',
    query: {
      runId: runId,
      pipelineId: runDetail.value.pipeline_id,
      side: 'right'
    }
  })
}

const calcDuration = (s, e) => {
  if (!s) return '-'
  if (!e) return '进行中...'
  const diff = dayjs(e).diff(dayjs(s), 'minute')
  return diff >= 60 ? `${Math.floor(diff / 60)}h ${diff % 60}m` : `${diff}m`
}

const formatJson = (data) => {
  if (!data) return '暂无数据'
  try {
    return JSON.stringify(data, null, 2)
  } catch { return String(data) }
}

const loadDetail = async () => {
  try {
    const res = await api.get(`/monitor/runs/${runId}`)
    runDetail.value = res.data
    nodeDetails.value = res.data.nodeDetails || []
  } catch { /* handled */ }
}

onMounted(loadDetail)
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.flow-monitor-card, .detail-card, .table-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 24px;
}
.flow-monitor-card h4, .detail-card h4, .table-card h4 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 20px;
  color: var(--text-primary);
}

/* 流转管道 */
.flow-pipeline {
  display: flex;
  align-items: center;
  overflow-x: auto;
  padding: 16px 0;
  gap: 0;
}
.flow-node-wrapper {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.flow-node {
  min-width: 160px;
  background: var(--bg-dark);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 16px;
  cursor: pointer;
  transition: var(--transition);
  position: relative;
  overflow: hidden;
}
.flow-node:hover {
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-hover);
}
.flow-node.completed { border-color: var(--success); }
.flow-node.running { border-color: var(--success); box-shadow: 0 0 16px rgba(16, 185, 129, 0.2); }
.flow-node.failed { border-color: var(--danger); }

.flow-node-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  font-size: 18px;
}
.flow-node-icon.completed { background: rgba(16, 185, 129, 0.15); color: var(--success); }
.flow-node-icon.running { background: rgba(16, 185, 129, 0.15); color: var(--success); }
.flow-node-icon.failed { background: rgba(239, 68, 68, 0.15); color: var(--danger); }
.flow-node-icon.pending { background: rgba(148, 163, 184, 0.15); color: var(--text-secondary); }

.flow-node-name {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}
.flow-node-type {
  font-size: 11px;
  color: var(--text-secondary);
}
.flow-node-stats {
  display: flex;
  gap: 12px;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}
.flow-stat-label {
  font-size: 10px;
  color: var(--text-secondary);
  display: block;
}
.flow-stat-value {
  font-size: 14px;
  font-weight: 700;
}
.flow-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--border-color);
}
.flow-progress-bar {
  height: 100%;
  transition: width 1s ease;
  border-radius: 0 3px 0 0;
}
.flow-progress-bar.completed { background: var(--success); }
.flow-progress-bar.running { background: var(--success); animation: progress-pulse 2s infinite; }
.flow-progress-bar.failed { background: var(--danger); }
@keyframes progress-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.flow-arrow {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 0 4px;
}
.arrow-line {
  width: 32px;
  height: 2px;
  background: var(--border-color);
  position: relative;
}
.arrow-line.active { background: var(--success); }
.arrow-particle {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success);
  position: absolute;
  top: -2px;
  animation: particle-move 2s infinite;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
}
@keyframes particle-move {
  0% { left: 0; opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { left: 100%; opacity: 0; }
}
.arrow-icon {
  color: var(--text-secondary);
  font-size: 14px;
}
.arrow-icon.active { color: var(--success); }

.spin { animation: spin 1.5s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.data-section {
  margin-top: 16px;
}
.data-section h5 {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.data-preview {
  background: var(--bg-dark);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 16px;
  font-size: 12px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: var(--text-primary);
  overflow-x: auto;
  max-height: 300px;
  line-height: 1.6;
  white-space: pre-wrap;
}
</style>
