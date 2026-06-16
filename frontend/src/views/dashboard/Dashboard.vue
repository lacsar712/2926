<template>
  <div class="page-container dashboard-page" v-loading="loading">
    <div class="welcome-section fade-in-up">
      <div class="welcome-text">
        <h2>{{ greeting }}，{{ userInfo?.nickname || '用户' }}</h2>
        <p>欢迎回到数据生产线平台，今天也是高效工作的一天</p>
      </div>
      <div class="welcome-badges">
        <el-tag :type="roleTagType" effect="dark" round size="large">
          <el-icon style="margin-right: 4px;"><User /></el-icon>
          {{ roleLabel }}
        </el-tag>
      </div>
      <div class="time-range-switch">
        <el-radio-group v-model="daysRange" size="small" @change="loadSummary">
          <el-radio-button :value="7">近 7 天</el-radio-button>
          <el-radio-button :value="14">近 14 天</el-radio-button>
          <el-radio-button :value="30">近 30 天</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div class="stat-cards fade-in-up">
      <div class="stat-card" v-for="card in statCards" :key="card.key">
        <div class="stat-icon" :style="{ background: card.bgColor }">
          <el-icon :size="24" :color="card.iconColor"><component :is="card.icon" /></el-icon>
        </div>
        <div class="stat-info">
          <h3>{{ card.value }}</h3>
          <p>{{ card.label }}</p>
        </div>
        <div class="stat-sparkline" :ref="el => setChartRef(card.key, el)"></div>
      </div>
    </div>

    <div class="main-content fade-in-up">
      <div class="content-left">
        <div class="section-card">
          <div class="section-header">
            <h3><el-icon><EditPen /></el-icon> 最近编辑的生产线</h3>
          </div>
          <div class="section-body">
            <div v-if="summary.recentPipelines?.length === 0" class="empty-hint">暂无数据</div>
            <div v-for="item in summary.recentPipelines" :key="item.id" class="list-item" @click="$router.push(`/pipeline/flow/${item.id}`)">
              <div class="item-main">
                <span class="item-name">{{ item.name }}</span>
                <span class="status-badge" :class="item.status">
                  <span class="dot"></span>{{ statusMap[item.status] }}
                </span>
              </div>
              <div class="item-meta">
                <span>{{ item.creator_name || '系统' }}</span>
                <span>{{ formatDate(item.updated_at) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="section-card">
          <div class="section-header">
            <h3><el-icon><WarningFilled /></el-icon> 最近失败运行</h3>
          </div>
          <div class="section-body">
            <div v-if="summary.recentFailedRuns?.length === 0" class="empty-hint">暂无失败运行</div>
            <div v-for="item in summary.recentFailedRuns" :key="item.run_id" class="list-item failed-item" @click="$router.push(`/monitor/detail/${item.run_id}`)">
              <div class="item-main">
                <span class="item-name">{{ item.pipeline_name }}</span>
                <el-tag type="danger" size="small" effect="dark" round>
                  {{ item.error_count }} 个错误
                </el-tag>
              </div>
              <div class="item-meta">
                <span class="error-summary">运行 #{{ item.run_id }} 失败</span>
                <span>{{ formatDate(item.start_time) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="content-right">
        <div class="section-card quick-actions">
          <div class="section-header">
            <h3><el-icon><Promotion /></el-icon> 快捷操作</h3>
          </div>
          <div class="section-body">
            <el-button type="primary" size="large" class="action-btn" @click="$router.push('/pipeline')">
              <el-icon><Plus /></el-icon>创建生产线
            </el-button>
            <el-button size="large" class="action-btn" @click="$router.push('/monitor')">
              <el-icon><DataLine /></el-icon>查看监控
            </el-button>
            <el-button size="large" class="action-btn" @click="$router.push('/notifications')">
              <el-icon><Bell /></el-icon>通知中心
              <el-badge v-if="summary.pendingCount > 0" :value="summary.pendingCount" :max="99" class="action-badge" />
            </el-button>
          </div>
        </div>

        <div class="section-card trend-chart-card">
          <div class="section-header">
            <h3><el-icon><TrendCharts /></el-icon> 运行趋势</h3>
          </div>
          <div class="section-body">
            <div ref="trendChartRef" class="trend-chart"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import { getDashboardSummary } from '@/api/dashboard'

const loading = ref(false)
const daysRange = ref(7)
const summary = reactive({
  pipelineCount: 0,
  todayRunCount: 0,
  pendingCount: 0,
  failedRunCount: 0,
  trend: { labels: [], run: [], failed: [] },
  recentPipelines: [],
  recentFailedRuns: []
})

const statusMap = { draft: '草稿', published: '已发布', running: '运行中', stopped: '已停止', error: '异常' }

const userInfo = computed(() => {
  try { return JSON.parse(localStorage.getItem('userInfo') || '{}') } catch { return {} }
})

const roleLabel = computed(() => {
  const map = { admin: '管理员', editor: '编辑者', viewer: '查看者' }
  return map[userInfo.value?.role] || '用户'
})

const roleTagType = computed(() => {
  const map = { admin: 'danger', editor: 'warning', viewer: 'info' }
  return map[userInfo.value?.role] || 'info'
})

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

const statCards = computed(() => [
  {
    key: 'pipeline',
    label: '我的生产线数',
    value: summary.pipelineCount,
    icon: 'Share',
    bgColor: 'rgba(99, 102, 241, 0.15)',
    iconColor: '#818cf8',
    data: summary.trend.run
  },
  {
    key: 'todayRun',
    label: '今日运行次数',
    value: summary.todayRunCount,
    icon: 'VideoPlay',
    bgColor: 'rgba(16, 185, 129, 0.15)',
    iconColor: '#10b981',
    data: summary.trend.run
  },
  {
    key: 'pending',
    label: '待处理事项',
    value: summary.pendingCount,
    icon: 'Bell',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    iconColor: '#f59e0b',
    data: summary.trend.run
  },
  {
    key: 'failed',
    label: `近 ${daysRange.value} 日失败运行`,
    value: summary.failedRunCount,
    icon: 'WarningFilled',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    iconColor: '#ef4444',
    data: summary.trend.failed
  }
])

const chartRefs = {}
const setChartRef = (key, el) => {
  if (el) chartRefs[key] = el
}

const sparklineInstances = {}
const trendChartRef = ref()
let trendInstance = null

const formatDate = (d) => d ? dayjs(d).format('MM-DD HH:mm') : '-'

const loadSummary = async () => {
  loading.value = true
  try {
    const res = await getDashboardSummary({ days: daysRange.value })
    Object.assign(summary, res.data)
    await nextTick()
    renderSparklines()
    renderTrendChart()
  } catch { /* handled */ } finally { loading.value = false }
}

const renderSparklines = () => {
  statCards.value.forEach(card => {
    const el = chartRefs[card.key]
    if (!el) return
    if (sparklineInstances[card.key]) {
      sparklineInstances[card.key].dispose()
    }
    const chart = echarts.init(el)
    sparklineInstances[card.key] = chart
    const data = card.data || []
    chart.setOption({
      grid: { top: 5, right: 0, bottom: 5, left: 0 },
      xAxis: { show: false, type: 'category', data: data.map((_, i) => i) },
      yAxis: { show: false, type: 'value', min: 0 },
      series: [{
        type: 'line',
        data,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: card.iconColor },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: card.iconColor + '40' },
            { offset: 1, color: card.iconColor + '05' }
          ])
        }
      }],
      tooltip: { show: false }
    })
  })
}

const renderTrendChart = () => {
  if (!trendChartRef.value) return
  if (trendInstance) trendInstance.dispose()
  trendInstance = echarts.init(trendChartRef.value)
  trendInstance.setOption({
    grid: { top: 30, right: 16, bottom: 24, left: 36 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(30, 41, 59, 0.95)',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9', fontSize: 12 }
    },
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: '#94a3b8', fontSize: 12 },
      itemWidth: 16,
      itemHeight: 8
    },
    xAxis: {
      type: 'category',
      data: summary.trend.labels,
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#64748b', fontSize: 11 },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLine: { show: false },
      axisLabel: { color: '#64748b', fontSize: 11 },
      splitLine: { lineStyle: { color: '#1e293b' } }
    },
    series: [
      {
        name: '运行数',
        type: 'bar',
        data: summary.trend.run,
        barWidth: 12,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#818cf8' },
            { offset: 1, color: '#6366f1' }
          ])
        }
      },
      {
        name: '失败数',
        type: 'line',
        data: summary.trend.failed,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: '#ef4444' },
        itemStyle: { color: '#ef4444' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(239, 68, 68, 0.2)' },
            { offset: 1, color: 'rgba(239, 68, 68, 0)' }
          ])
        }
      }
    ]
  })
}

const handleResize = () => {
  Object.values(sparklineInstances).forEach(c => c?.resize())
  trendInstance?.resize()
}

onMounted(() => {
  loadSummary()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  Object.values(sparklineInstances).forEach(c => c?.dispose())
  trendInstance?.dispose()
})
</script>

<style scoped>
.dashboard-page {
  padding: 24px;
  height: 100%;
  overflow-y: auto;
}

.welcome-section {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.welcome-text {
  flex: 1;
  min-width: 200px;
}

.welcome-text h2 {
  font-size: 24px;
  font-weight: 700;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 4px;
}

.welcome-text p {
  font-size: 14px;
  color: var(--text-secondary);
}

.welcome-badges {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-range-switch {
  margin-left: auto;
}

.stat-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  transition: var(--transition);
  cursor: default;
  position: relative;
  overflow: hidden;
}

.stat-card:hover {
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-hover);
}

.stat-sparkline {
  width: 80px;
  height: 40px;
  margin-left: auto;
  flex-shrink: 0;
}

.main-content {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
}

.content-left {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.content-right {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  transition: var(--transition);
  overflow: hidden;
}

.section-card:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-hover);
}

.section-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-header h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-body {
  padding: 12px 20px;
}

.list-item {
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: var(--transition);
}

.list-item:last-child {
  border-bottom: none;
}

.list-item:hover {
  padding-left: 8px;
}

.list-item:hover .item-name {
  color: var(--primary-light);
}

.item-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.item-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  transition: var(--transition);
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 12px;
  color: var(--text-secondary);
}

.error-summary {
  color: var(--danger);
}

.failed-item .item-name {
  color: #fca5a5;
}

.empty-hint {
  text-align: center;
  padding: 32px 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.quick-actions .section-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px;
}

.action-btn {
  width: 100%;
  justify-content: flex-start;
  font-size: 14px;
  border-radius: var(--radius-sm);
  position: relative;
}

.action-badge {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
}

.trend-chart-card .section-body {
  padding: 12px 12px 8px;
}

.trend-chart {
  width: 100%;
  height: 200px;
}

@media (max-width: 1200px) {
  .stat-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  .main-content {
    grid-template-columns: 1fr;
  }
  .content-right {
    flex-direction: row;
  }
}

@media (max-width: 768px) {
  .stat-cards {
    grid-template-columns: 1fr;
  }
  .content-right {
    flex-direction: column;
  }
}
</style>
