<template>
  <div class="page-container">
    <div class="page-header fade-in-up">
      <h2 class="page-title">操作日志</h2>
    </div>
    <div class="table-card fade-in-up">
      <div class="table-header">
        <el-input v-model="filters.username" placeholder="搜索操作人..." clearable prefix-icon="Search" style="width: 200px" @clear="loadList" @keyup.enter="loadList" />
        <el-input v-model="filters.action" placeholder="搜索操作类型..." clearable style="width: 200px" @clear="loadList" @keyup.enter="loadList" />
        <el-button type="primary" plain @click="loadList"><el-icon><Search /></el-icon>搜索</el-button>
      </div>
      <el-table :data="list" stripe v-loading="loading">
        <el-table-column prop="username" label="操作人" width="100" />
        <el-table-column label="操作类型" width="140">
          <template #default="{ row }">
            <el-tag size="small" :type="getActionType(row.action)">{{ row.action }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="target" label="操作对象" min-width="160" />
        <el-table-column prop="detail" label="详情" min-width="200" show-overflow-tooltip />
        <el-table-column prop="ip" label="IP地址" width="140" />
        <el-table-column label="操作时间" width="180">
          <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
        </el-table-column>
      </el-table>
      <div style="display: flex; justify-content: center; margin-top: 16px;">
        <el-pagination background layout="total, prev, pager, next" :total="total" :page-size="pageSize" v-model:current-page="page" @current-change="loadList" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '@/utils/request'
import dayjs from 'dayjs'
import { usePreferenceStore } from '@/stores/preference'

const preferenceStore = usePreferenceStore()

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = computed(() => preferenceStore.pageSize)
const filters = reactive({ username: '', action: '' })
const formatDate = (d) => d ? dayjs(d).format('YYYY-MM-DD HH:mm:ss') : '-'
const getActionType = (action) => {
  if (action?.includes('创建')) return 'success'
  if (action?.includes('删除')) return 'danger'
  if (action?.includes('编辑') || action?.includes('更新')) return 'warning'
  if (action?.includes('登录')) return 'primary'
  return 'info'
}

const loadList = async () => {
  loading.value = true
  try {
    const res = await api.get('/logs', { params: { ...filters, page: page.value, pageSize: pageSize.value } })
    list.value = res.data.list
    total.value = res.data.total
  } catch { /* handled */ } finally { loading.value = false }
}

onMounted(loadList)
</script>

<style scoped>
.table-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 24px;
}
.table-header {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
</style>
