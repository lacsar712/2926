<template>
  <div class="page-container">
    <div class="page-header fade-in-up">
      <h2 class="page-title">用户管理</h2>
      <el-button type="primary" @click="openDialog()"><el-icon><Plus /></el-icon>新建用户</el-button>
    </div>
    <div class="table-card fade-in-up">
      <div class="table-header">
        <el-input v-model="keyword" placeholder="搜索用户..." clearable prefix-icon="Search" style="width: 240px" @clear="loadList" @keyup.enter="loadList" />
        <el-select v-model="roleFilter" placeholder="角色筛选" clearable style="width: 120px" @change="loadList">
          <el-option label="管理员" value="admin" /><el-option label="编辑者" value="editor" /><el-option label="查看者" value="viewer" />
        </el-select>
      </div>
      <el-table :data="list" stripe v-loading="loading">
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="nickname" label="昵称" width="120" />
        <el-table-column prop="email" label="邮箱" min-width="180" />
        <el-table-column prop="phone" label="手机号" width="140" />
        <el-table-column label="角色" width="100">
          <template #default="{ row }">
            <el-tag :type="row.role === 'admin' ? 'danger' : row.role === 'editor' ? 'warning' : 'info'" size="small">{{ roleMap[row.role] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small" effect="dark">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="openDialog(row)"><el-icon><Edit /></el-icon>编辑</el-button>
            <el-popconfirm title="确认删除？" @confirm="handleDelete(row.id)">
              <template #reference><el-button size="small" type="danger" link><el-icon><Delete /></el-icon>删除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
      <div style="display: flex; justify-content: center; margin-top: 16px;">
        <el-pagination background layout="total, prev, pager, next" :total="total" :page-size="pageSize" v-model:current-page="page" @current-change="loadList" />
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="editId ? '编辑用户' : '新建用户'" width="480px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="80px">
        <el-form-item label="用户名" prop="username"><el-input v-model="form.username" :disabled="!!editId" /></el-form-item>
        <el-form-item label="密码" :prop="editId ? '' : 'password'"><el-input v-model="form.password" type="password" :placeholder="editId ? '留空则不修改' : '请输入密码'" show-password /></el-form-item>
        <el-form-item label="昵称" prop="nickname"><el-input v-model="form.nickname" /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="form.email" /></el-form-item>
        <el-form-item label="手机号"><el-input v-model="form.phone" /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" style="width: 100%">
            <el-option label="管理员" value="admin" /><el-option label="编辑者" value="editor" /><el-option label="查看者" value="viewer" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" v-if="editId">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="禁用" />
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
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/request'
import dayjs from 'dayjs'
import { usePreferenceStore } from '@/stores/preference'

const preferenceStore = usePreferenceStore()

const loading = ref(false)
const submitting = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = computed(() => preferenceStore.pageSize)
const keyword = ref('')
const roleFilter = ref('')
const dialogVisible = ref(false)
const editId = ref(null)
const formRef = ref()

const roleMap = { admin: '管理员', editor: '编辑者', viewer: '查看者' }
const formatDate = (d) => d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-'
const form = reactive({ username: '', password: '', nickname: '', email: '', phone: '', role: 'viewer', status: 1 })
const formRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  nickname: [{ required: true, message: '请输入昵称', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const loadList = async () => {
  loading.value = true
  try {
    const res = await api.get('/users', { params: { keyword: keyword.value, role: roleFilter.value, page: page.value, pageSize: pageSize.value } })
    list.value = res.data.list
    total.value = res.data.total
  } catch { /* handled */ } finally { loading.value = false }
}

const openDialog = (item) => {
  editId.value = item?.id || null
  form.username = item?.username || ''
  form.password = ''
  form.nickname = item?.nickname || ''
  form.email = item?.email || ''
  form.phone = item?.phone || ''
  form.role = item?.role || 'viewer'
  form.status = item?.status ?? 1
  dialogVisible.value = true
}

const handleSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    const data = { ...form }
    if (editId.value && !data.password) delete data.password
    if (editId.value) {
      await api.put(`/users/${editId.value}`, data)
      ElMessage.success('更新成功')
    } else {
      await api.post('/users', data)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadList()
  } catch { /* handled */ } finally { submitting.value = false }
}

const handleDelete = async (id) => {
  try {
    await api.delete(`/users/${id}`)
    ElMessage.success('删除成功')
    loadList()
  } catch { /* handled */ }
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
