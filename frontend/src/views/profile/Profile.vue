<template>
  <div class="profile-page page-container">
    <div class="page-header">
      <h1 class="page-title">个人中心</h1>
    </div>

    <el-tabs v-model="activeTab" class="profile-tabs" @tab-change="handleTabChange">
      <el-tab-pane label="基本信息" name="basic">
        <el-card class="profile-card">
          <div class="profile-header">
            <div class="avatar-section">
              <el-avatar :size="80" :style="{ background: 'var(--gradient-primary)' }" class="profile-avatar">
                {{ form.nickname?.charAt(0) || 'U' }}
              </el-avatar>
            </div>
            <div class="user-info-section">
              <h2 class="user-name">{{ form.nickname }}</h2>
              <p class="user-role">{{ roleLabel }}</p>
            </div>
          </div>

          <el-form
            ref="formRef"
            :model="form"
            :rules="rules"
            label-width="100px"
            class="profile-form"
          >
            <el-form-item label="用户名" prop="username">
              <el-input v-model="form.username" disabled />
            </el-form-item>
            <el-form-item label="昵称" prop="nickname">
              <el-input v-model="form.nickname" placeholder="请输入昵称" maxlength="20" show-word-limit />
            </el-form-item>
            <el-form-item label="邮箱" prop="email">
              <el-input v-model="form.email" placeholder="请输入邮箱" />
            </el-form-item>
            <el-form-item label="手机号" prop="phone">
              <el-input v-model="form.phone" placeholder="请输入手机号" maxlength="11" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="handleSave">
                保存修改
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="安全设置" name="security">
        <el-card class="profile-card">
          <h3 class="section-title">修改密码</h3>
          <p class="section-desc">为了账户安全，建议定期更换密码</p>

          <el-form
            ref="passwordFormRef"
            :model="passwordForm"
            :rules="passwordRules"
            label-width="100px"
            class="password-form"
          >
            <el-form-item label="旧密码" prop="oldPassword">
              <el-input v-model="passwordForm.oldPassword" type="password" placeholder="请输入旧密码" show-password />
            </el-form-item>
            <el-form-item label="新密码" prop="newPassword">
              <el-input v-model="passwordForm.newPassword" type="password" placeholder="请输入新密码（至少6位）" show-password />
            </el-form-item>
            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input v-model="passwordForm.confirmPassword" type="password" placeholder="请再次输入新密码" show-password />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="changingPassword" @click="handleChangePassword">
                修改密码
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="偏好设置" name="preference">
        <el-card class="profile-card">
          <h3 class="section-title">主题设置</h3>
          <p class="section-desc">选择您喜欢的显示主题</p>
          <div class="theme-options">
            <div
              v-for="option in themeOptions"
              :key="option.value"
              class="theme-option"
              :class="{ active: preferenceForm.theme === option.value }"
              @click="selectTheme(option.value)"
            >
              <div class="theme-preview" :class="option.value">
                <el-icon class="theme-icon"><component :is="option.icon" /></el-icon>
              </div>
              <span class="theme-label">{{ option.label }}</span>
            </div>
          </div>
        </el-card>

        <el-card class="profile-card">
          <h3 class="section-title">列表设置</h3>
          <p class="section-desc">配置列表的默认分页大小</p>
          <el-form label-width="140px" class="preference-form">
            <el-form-item label="默认分页大小">
              <el-select v-model="preferenceForm.pageSize" style="width: 200px">
                <el-option v-for="size in pageSizeOptions" :key="size" :label="`每页 ${size} 条`" :value="size" />
              </el-select>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card class="profile-card">
          <h3 class="section-title">编排设置</h3>
          <p class="section-desc">配置生产线编排相关的偏好</p>
          <el-form label-width="140px" class="preference-form">
            <el-form-item label="自动保存">
              <el-switch
                v-model="preferenceForm.autoSave"
                active-text="开启"
                inactive-text="关闭"
              />
              <span class="form-hint">开启后，编排内容将自动保存，防止数据丢失</span>
            </el-form-item>
          </el-form>
        </el-card>

        <div class="preference-actions">
          <el-button type="primary" :loading="savingPreference" @click="handleSavePreference">
            保存偏好设置
          </el-button>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getProfile, updateProfile, changePassword } from '@/api/profile'
import { usePreferenceStore } from '@/stores/preference'

const router = useRouter()
const preferenceStore = usePreferenceStore()

const activeTab = ref('basic')
const formRef = ref()
const passwordFormRef = ref()
const saving = ref(false)
const changingPassword = ref(false)
const savingPreference = ref(false)

const form = reactive({
  id: null,
  username: '',
  nickname: '',
  email: '',
  phone: '',
  role: '',
  avatar: ''
})

const rules = {
  nickname: [
    { required: true, message: '请输入昵称', trigger: 'blur' },
    { min: 2, max: 20, message: '昵称长度在 2 到 20 个字符', trigger: 'blur' }
  ],
  email: [
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ],
  phone: [
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ]
}

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== passwordForm.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const passwordRules = {
  oldPassword: [
    { required: true, message: '请输入旧密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

const preferenceForm = reactive({
  theme: 'system',
  pageSize: 10,
  autoSave: true
})

const themeOptions = [
  { value: 'light', label: '浅色模式', icon: 'Sunny' },
  { value: 'dark', label: '深色模式', icon: 'Moon' },
  { value: 'system', label: '跟随系统', icon: 'Monitor' }
]

const pageSizeOptions = [10, 20, 30, 50, 100]

const roleLabel = computed(() => {
  const map = { admin: '管理员', editor: '编辑者', viewer: '查看者' }
  return map[form.role] || '用户'
})

const loadProfile = async () => {
  try {
    const res = await getProfile()
    const data = res.data
    form.id = data.id
    form.username = data.username
    form.nickname = data.nickname
    form.email = data.email || ''
    form.phone = data.phone || ''
    form.role = data.role
    form.avatar = data.avatar || ''
  } catch (error) {
    console.error('加载个人信息失败:', error)
  }
}

const handleSave = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    const res = await updateProfile({
      nickname: form.nickname,
      email: form.email,
      phone: form.phone
    })
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}')
    userInfo.nickname = res.data.nickname
    localStorage.setItem('userInfo', JSON.stringify(userInfo))
    ElMessage.success('保存成功')
  } catch (error) {
    console.error('保存失败:', error)
  } finally {
    saving.value = false
  }
}

const handleChangePassword = async () => {
  const valid = await passwordFormRef.value?.validate().catch(() => false)
  if (!valid) return

  changingPassword.value = true
  try {
    await ElMessageBox.confirm(
      '修改密码后需要重新登录，确定要继续吗？',
      '确认修改',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await changePassword({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword
    })

    ElMessage.success('密码修改成功，请重新登录')

    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')

    setTimeout(() => {
      router.push('/login')
    }, 1000)
  } catch (error) {
    if (error !== 'cancel') {
      console.error('修改密码失败:', error)
    }
  } finally {
    changingPassword.value = false
  }
}

const selectTheme = (theme) => {
  preferenceForm.theme = theme
  preferenceStore.setTheme(theme)
}

const loadPreference = () => {
  preferenceForm.theme = preferenceStore.theme
  preferenceForm.pageSize = preferenceStore.pageSize
  preferenceForm.autoSave = preferenceStore.autoSave
}

const handleSavePreference = async () => {
  savingPreference.value = true
  try {
    await preferenceStore.savePreference({
      theme: preferenceForm.theme,
      pageSize: preferenceForm.pageSize,
      autoSave: preferenceForm.autoSave
    })
    ElMessage.success('偏好设置保存成功')
  } catch (error) {
    console.error('保存偏好设置失败:', error)
  } finally {
    savingPreference.value = false
  }
}

const handleTabChange = (tab) => {
  if (tab === 'preference') {
    loadPreference()
  }
}

onMounted(() => {
  loadProfile()
  loadPreference()
})
</script>

<style scoped>
.profile-page {
  height: 100%;
  overflow-y: auto;
}

.profile-tabs {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 20px;
}

.profile-tabs :deep(.el-tabs__header) {
  margin-bottom: 24px;
}

.profile-card {
  margin-bottom: 20px;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
}

.profile-card :deep(.el-card__body) {
  padding: 0;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 24px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  border-radius: var(--radius-md);
  margin-bottom: 24px;
}

.avatar-section {
  flex-shrink: 0;
}

.profile-avatar {
  font-size: 32px;
  font-weight: 600;
}

.user-info-section {
  flex: 1;
}

.user-name {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.user-role {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

.profile-form {
  max-width: 500px;
  padding: 0 24px 24px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 6px;
}

.section-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0 0 20px;
}

.password-form {
  max-width: 500px;
}

.theme-options {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.theme-option {
  cursor: pointer;
  text-align: center;
  transition: var(--transition);
}

.theme-option:hover .theme-preview {
  border-color: var(--primary);
  transform: translateY(-2px);
}

.theme-option.active .theme-preview {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
}

.theme-option.active .theme-label {
  color: var(--primary);
}

.theme-preview {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-md);
  border: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  transition: var(--transition);
}

.theme-preview.light {
  background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%);
}

.theme-preview.dark {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
}

.theme-preview.system {
  background: linear-gradient(135deg, #ffffff 0%, #1e293b 100%);
}

.theme-icon {
  font-size: 28px;
  color: var(--text-secondary);
}

.theme-preview.light .theme-icon {
  color: #f59e0b;
}

.theme-preview.dark .theme-icon {
  color: #818cf8;
}

.theme-label {
  font-size: 13px;
  color: var(--text-secondary);
  transition: var(--transition);
}

.preference-form {
  max-width: 400px;
}

.form-hint {
  display: block;
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 6px;
}

.preference-actions {
  text-align: right;
  padding-top: 8px;
}
</style>
