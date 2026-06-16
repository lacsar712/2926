<template>
  <div class="page-container">
    <div class="page-header fade-in-up">
      <h2 class="page-title">标签管理</h2>
      <el-button type="primary" @click="openDialog()"><el-icon><Plus /></el-icon>新建标签</el-button>
    </div>
    <div class="tag-grid fade-in-up" v-loading="loading">
      <div v-for="tag in list" :key="tag.id" class="tag-card">
        <div class="tag-color-bar" :style="{ background: tag.color }"></div>
        <div class="tag-content">
          <div class="tag-name">
            <span class="tag-dot" :style="{ background: tag.color }"></span>
            {{ tag.name }}
          </div>
          <div class="tag-actions">
            <el-button size="small" text circle @click="openDialog(tag)"><el-icon><Edit /></el-icon></el-button>
            <el-popconfirm title="确认删除？" @confirm="handleDelete(tag.id)">
              <template #reference><el-button size="small" text circle type="danger"><el-icon><Delete /></el-icon></el-button></template>
            </el-popconfirm>
          </div>
        </div>
      </div>
      <div v-if="!loading && list.length === 0" class="empty-state">
        <el-icon :size="48" color="var(--text-secondary)"><PriceTag /></el-icon>
        <p>暂无标签</p>
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="editId ? '编辑标签' : '新建标签'" width="400px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="60px">
        <el-form-item label="名称" prop="name"><el-input v-model="form.name" placeholder="标签名称" maxlength="20" /></el-form-item>
        <el-form-item label="颜色">
          <el-color-picker v-model="form.color" :predefine="preColors" />
          <span style="margin-left: 12px; color: var(--text-secondary); font-size: 13px;">{{ form.color }}</span>
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

const loading = ref(false)
const submitting = ref(false)
const list = ref([])
const dialogVisible = ref(false)
const editId = ref(null)
const formRef = ref()
const form = reactive({ name: '', color: '#409EFF' })
const formRules = { name: [{ required: true, message: '请输入标签名称', trigger: 'blur' }] }
const preColors = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#ff6b6b', '#51cf66', '#6366f1', '#8b5cf6', '#06b6d4', '#ec4899', '#f59e0b']

const loadList = async () => {
  loading.value = true
  try {
    const res = await api.get('/tags')
    list.value = res.data
  } catch { /* handled */ } finally { loading.value = false }
}

const openDialog = (item) => {
  editId.value = item?.id || null
  form.name = item?.name || ''
  form.color = item?.color || '#409EFF'
  dialogVisible.value = true
}

const handleSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    if (editId.value) {
      await api.put(`/tags/${editId.value}`, form)
      ElMessage.success('更新成功')
    } else {
      await api.post('/tags', form)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadList()
  } catch { /* handled */ } finally { submitting.value = false }
}

const handleDelete = async (id) => {
  try {
    await api.delete(`/tags/${id}`)
    ElMessage.success('删除成功')
    loadList()
  } catch { /* handled */ }
}

onMounted(loadList)
</script>

<style scoped>
.tag-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}
.tag-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  overflow: hidden;
  transition: var(--transition);
}
.tag-card:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-hover);
  transform: translateY(-2px);
}
.tag-color-bar { height: 4px; }
.tag-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
}
.tag-name {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 500;
}
.tag-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.tag-actions { display: flex; gap: 4px; }
.empty-state { grid-column: 1/-1; text-align: center; padding: 60px 0; color: var(--text-secondary); }
.empty-state p { margin-top: 12px; }
</style>
