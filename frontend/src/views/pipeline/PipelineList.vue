<template>
  <div class="page-container">
    <div class="page-header fade-in-up">
      <h2 class="page-title">生产线管理</h2>
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon>新建生产线
      </el-button>
    </div>

    <!-- 搜索过滤 -->
    <div class="filter-bar fade-in-up">
      <el-input v-model="filters.keyword" placeholder="搜索生产线名称..." clearable style="width: 280px" prefix-icon="Search" @clear="loadList" @keyup.enter="loadList" />
      <el-select v-model="filters.status" placeholder="状态筛选" clearable style="width: 140px" @change="loadList">
        <el-option label="草稿" value="draft" />
        <el-option label="已发布" value="published" />
        <el-option label="运行中" value="running" />
        <el-option label="已停止" value="stopped" />
      </el-select>
      <el-select v-model="filters.tagId" placeholder="标签筛选" clearable style="width: 160px" @change="loadList">
        <el-option v-for="tag in tags" :key="tag.id" :label="tag.name" :value="tag.id">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span :style="{ width: '8px', height: '8px', borderRadius: '50%', background: tag.color }"></span>
            {{ tag.name }}
          </div>
        </el-option>
      </el-select>
      <el-button @click="loadList" type="primary" plain><el-icon><Search /></el-icon>搜索</el-button>
    </div>

    <!-- 列表 -->
    <div class="pipeline-grid fade-in-up" v-loading="loading">
      <div v-for="item in list" :key="item.id" class="pipeline-card">
        <div class="card-header">
          <h3>{{ item.name }}</h3>
          <span class="status-badge" :class="item.status">
            <span class="dot"></span>{{ statusMap[item.status] }}
          </span>
        </div>
        <p class="card-desc">{{ item.description || '暂无描述' }}</p>
        <div class="card-tags">
          <el-tag v-for="tag in item.tags" :key="tag.id" :color="tag.color + '22'" :style="{ color: tag.color, borderColor: tag.color + '44' }" size="small" effect="dark" round>
            {{ tag.name }}
          </el-tag>
        </div>
        <div class="card-meta">
          <span><el-icon><User /></el-icon>{{ item.creator_name || '系统' }}</span>
          <span><el-icon><Clock /></el-icon>{{ formatDate(item.updated_at) }}</span>
          <span>v{{ item.version }}</span>
        </div>
        <div class="card-actions">
          <el-button size="small" type="primary" plain @click="$router.push(`/pipeline/flow/${item.id}`)">
            <el-icon><EditPen /></el-icon>编排
          </el-button>
          <el-button size="small" plain @click="openDialog(item)">
            <el-icon><Edit /></el-icon>编辑
          </el-button>
          <el-popconfirm title="确认删除该生产线？" @confirm="handleDelete(item.id)">
            <template #reference>
              <el-button size="small" type="danger" plain><el-icon><Delete /></el-icon>删除</el-button>
            </template>
          </el-popconfirm>
        </div>
      </div>
      <div v-if="!loading && list.length === 0" class="empty-state">
        <el-icon :size="48" color="var(--text-secondary)"><Box /></el-icon>
        <p>暂无生产线数据</p>
      </div>
    </div>

    <div class="pagination-bar" v-if="total > pageSize">
      <el-pagination background layout="total, prev, pager, next" :total="total" :page-size="pageSize" v-model:current-page="currentPage" @current-change="loadList" />
    </div>

    <!-- 新建/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editId ? '编辑生产线' : '新建生产线'" width="520px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="80px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入生产线名称" maxlength="50" show-word-limit />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请输入描述信息" maxlength="500" show-word-limit />
        </el-form-item>
        <el-form-item label="标签">
          <el-select v-model="form.tagIds" multiple placeholder="选择标签" style="width: 100%">
            <el-option v-for="tag in tags" :key="tag.id" :label="tag.name" :value="tag.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/request'
import dayjs from 'dayjs'

const loading = ref(false)
const submitting = ref(false)
const list = ref([])
const tags = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = 12
const dialogVisible = ref(false)
const editId = ref(null)
const formRef = ref()

const statusMap = { draft: '草稿', published: '已发布', running: '运行中', stopped: '已停止', error: '异常' }
const filters = reactive({ keyword: '', status: '', tagId: '' })
const form = reactive({ name: '', description: '', tagIds: [] })
const formRules = { name: [{ required: true, message: '请输入名称', trigger: 'blur' }] }

const formatDate = (d) => d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-'

const loadList = async () => {
  loading.value = true
  try {
    const res = await api.get('/pipelines', { params: { ...filters, page: currentPage.value, pageSize } })
    list.value = res.data.list
    total.value = res.data.total
  } catch { /* handled */ } finally { loading.value = false }
}

const loadTags = async () => {
  try {
    const res = await api.get('/tags')
    tags.value = res.data
  } catch { /* handled */ }
}

const openDialog = (item) => {
  editId.value = item?.id || null
  form.name = item?.name || ''
  form.description = item?.description || ''
  form.tagIds = item?.tags?.map(t => t.id) || []
  dialogVisible.value = true
}

const handleSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    if (editId.value) {
      await api.put(`/pipelines/${editId.value}`, form)
      ElMessage.success('更新成功')
    } else {
      await api.post('/pipelines', form)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadList()
  } catch { /* handled */ } finally { submitting.value = false }
}

const handleDelete = async (id) => {
  try {
    await api.delete(`/pipelines/${id}`)
    ElMessage.success('删除成功')
    loadList()
  } catch { /* handled */ }
}

onMounted(() => { loadList(); loadTags() })
</script>

<style scoped>
.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}
.pipeline-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 20px;
  min-height: 200px;
}
.pipeline-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 24px;
  transition: var(--transition);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pipeline-card:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-hover);
  transform: translateY(-2px);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}
.card-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.card-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-secondary);
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}
.card-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}
.card-actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
}
.empty-state {
  grid-column: 1/-1;
  text-align: center;
  padding: 60px 0;
  color: var(--text-secondary);
}
.empty-state p { margin-top: 12px; }
.pagination-bar {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}
</style>
