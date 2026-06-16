<template>
  <div class="page-container">
    <div class="page-header fade-in-up">
      <h2 class="page-title">生产线监控</h2>
      <el-button type="primary" plain :icon="DataAnalysis" @click="$router.push('/monitor/compare')">
        运行对比
      </el-button>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="20" class="fade-in-up" style="margin-bottom: 24px;">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: rgba(99,102,241,0.15); color: #818cf8;">
            <el-icon :size="24"><Operation /></el-icon>
          </div>
          <div class="stat-info">
            <h3>{{ overview.totalPipelines }}</h3>
            <p>生产线总数</p>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: rgba(16,185,129,0.15); color: #10b981;">
            <el-icon :size="24"><VideoPlay /></el-icon>
          </div>
          <div class="stat-info">
            <h3>{{ overview.runningPipelines }}</h3>
            <p>运行中</p>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: rgba(59,130,246,0.15); color: #3b82f6;">
            <el-icon :size="24"><DataLine /></el-icon>
          </div>
          <div class="stat-info">
            <h3>{{ overview.totalRuns }}</h3>
            <p>累计运行次数</p>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: rgba(239,68,68,0.15); color: #ef4444;">
            <el-icon :size="24"><WarningFilled /></el-icon>
          </div>
          <div class="stat-info">
            <h3>{{ overview.failedRuns }}</h3>
            <p>失败次数</p>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 图表区 -->
    <el-row :gutter="20" class="fade-in-up" style="margin-bottom: 24px;">
      <el-col :span="14">
        <div class="chart-card">
          <h4>生产线数据吞吐量</h4>
          <div ref="throughputChart" style="height: 300px;"></div>
        </div>
      </el-col>
      <el-col :span="10">
        <div class="chart-card">
          <h4>运行状态分布</h4>
          <div ref="statusChart" style="height: 300px;"></div>
        </div>
      </el-col>
    </el-row>

    <!-- 运行记录 -->
    <div class="table-card fade-in-up">
      <div class="table-header">
        <h4>最近运行记录</h4>
        <el-select v-model="filterPipeline" placeholder="筛选生产线" clearable size="small" style="width: 200px" @change="loadRuns">
          <el-option v-for="p in pipelineStats" :key="p.id" :label="p.name" :value="p.id" />
        </el-select>
      </div>
      <el-table :data="recentRuns" stripe v-loading="loading" style="width: 100%">
        <el-table-column prop="pipeline_name" label="生产线" min-width="160" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <span class="status-badge" :class="row.status">
              <span class="dot"></span>{{ runStatusMap[row.status] }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="输入/输出" width="180">
          <template #default="{ row }">
            <span style="color: var(--info);">{{ row.total_input?.toLocaleString() }}</span>
            <span style="color: var(--text-secondary); margin: 0 4px;">→</span>
            <span style="color: var(--success);">{{ row.total_output?.toLocaleString() }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="error_count" label="错误数" width="100">
          <template #default="{ row }">
            <span :style="{ color: row.error_count > 0 ? 'var(--danger)' : 'var(--text-secondary)' }">{{ row.error_count }}</span>
          </template>
        </el-table-column>
        <el-table-column label="开始时间" width="180">
          <template #default="{ row }">{{ formatDate(row.start_time) }}</template>
        </el-table-column>
        <el-table-column label="耗时" width="120">
          <template #default="{ row }">{{ calcDuration(row.start_time, row.end_time) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="$router.push(`/monitor/detail/${row.id}`)">
              <el-icon><View /></el-icon>详情
            </el-button>
            <el-button size="small" type="success" link @click="addToCompare(row)">
              <el-icon><DataAnalysis /></el-icon>对比
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { DataAnalysis } from '@element-plus/icons-vue'
import api from '@/utils/request'
import dayjs from 'dayjs'
import * as echarts from 'echarts'

const router = useRouter()

const loading = ref(false)
const overview = ref({ totalPipelines: 0, runningPipelines: 0, totalRuns: 0, failedRuns: 0 })
const recentRuns = ref([])
const pipelineStats = ref([])
const filterPipeline = ref('')
const throughputChart = ref(null)
const statusChart = ref(null)

const runStatusMap = { running: '运行中', completed: '已完成', failed: '失败', cancelled: '已取消' }

const addToCompare = (row) => {
  router.push({
    path: '/monitor/compare',
    query: {
      runId: row.id,
      pipelineId: row.pipeline_id,
      side: 'right'
    }
  })
}
const formatDate = (d) => d ? dayjs(d).format('MM-DD HH:mm') : '-'
const calcDuration = (s, e) => {
  if (!s) return '-'
  if (!e) return '进行中...'
  const diff = dayjs(e).diff(dayjs(s), 'minute')
  return diff >= 60 ? `${Math.floor(diff / 60)}h ${diff % 60}m` : `${diff}m`
}

const loadOverview = async () => {
  loading.value = true
  try {
    const res = await api.get('/monitor/overview')
    overview.value = res.data.summary
    recentRuns.value = res.data.recentRuns
    pipelineStats.value = res.data.pipelineStats
    await nextTick()
    initCharts(res.data.pipelineStats, res.data.recentRuns)
  } catch { /* handled */ } finally { loading.value = false }
}

const loadRuns = async () => {
  try {
    const params = filterPipeline.value ? { pipelineId: filterPipeline.value } : {}
    const res = await api.get('/monitor/runs', { params })
    recentRuns.value = res.data
  } catch { /* handled */ }
}

const initCharts = (stats, runs) => {
  // 吞吐量柱状图
  if (throughputChart.value) {
    const chart1 = echarts.init(throughputChart.value)
    const names = stats.slice(0, 5).map(s => s.name.length > 8 ? s.name.slice(0, 8) + '...' : s.name)
    chart1.setOption({
      tooltip: { trigger: 'axis', backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' } },
      grid: { left: 60, right: 20, top: 20, bottom: 40 },
      xAxis: { type: 'category', data: names, axisLabel: { color: '#94a3b8', fontSize: 11 }, axisLine: { lineStyle: { color: '#334155' } } },
      yAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#334155', type: 'dashed' } } },
      series: [
        { name: '输入量', type: 'bar', data: stats.slice(0, 5).map(s => s.total_input || 0), itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#818cf8' }, { offset: 1, color: '#6366f1' }]), borderRadius: [4, 4, 0, 0] }, barWidth: 24 },
        { name: '输出量', type: 'bar', data: stats.slice(0, 5).map(s => s.total_output || 0), itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#34d399' }, { offset: 1, color: '#10b981' }]), borderRadius: [4, 4, 0, 0] }, barWidth: 24 }
      ]
    })
  }
  // 状态饼图
  if (statusChart.value) {
    const chart2 = echarts.init(statusChart.value)
    const statusCount = {}
    runs.forEach(r => { statusCount[r.status] = (statusCount[r.status] || 0) + 1 })
    const colorMap = { completed: '#818cf8', running: '#10b981', failed: '#ef4444', cancelled: '#94a3b8' }
    chart2.setOption({
      tooltip: { trigger: 'item', backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' } },
      series: [{
        type: 'pie', radius: ['45%', '70%'], center: ['50%', '50%'],
        label: { color: '#94a3b8', fontSize: 12 },
        data: Object.entries(statusCount).map(([k, v]) => ({ name: runStatusMap[k] || k, value: v, itemStyle: { color: colorMap[k] || '#94a3b8' } })),
        emphasis: { itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,0,0,0.3)' } }
      }]
    })
  }
}

onMounted(loadOverview)
</script>

<style scoped>
.chart-card, .table-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 20px;
}
.chart-card h4, .table-header h4 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-primary);
}
.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
</style>
