<template>
  <div class="login-page">
    <div class="login-bg">
      <div class="bg-circle c1"></div>
      <div class="bg-circle c2"></div>
      <div class="bg-circle c3"></div>
    </div>
    <div class="login-card fade-in-up">
      <div class="login-header">
        <div class="login-logo">
          <el-icon :size="40"><Share /></el-icon>
        </div>
        <h1>数据生产线可视化平台</h1>
        <p>DataPipeline Visualization Platform</p>
      </div>
      <el-form ref="formRef" :model="form" :rules="rules" @submit.prevent="handleLogin" size="large">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" prefix-icon="Lock" show-password @keyup.enter="handleLogin" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" class="login-btn" :loading="loading" @click="handleLogin">
            {{ loading ? '登录中...' : '登 录' }}
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '@/utils/request'

const router = useRouter()
const formRef = ref()
const loading = ref(false)
const form = reactive({ username: '', password: '' })
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const handleLogin = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    const res = await api.post('/auth/login', form)
    localStorage.setItem('token', res.data.token)
    localStorage.setItem('userInfo', JSON.stringify(res.data.user))
    ElMessage.success('登录成功')
    router.push('/')
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-dark);
  position: relative;
  overflow: hidden;
}
.login-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.bg-circle {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.3;
}
.c1 { width: 400px; height: 400px; background: #6366f1; top: -100px; right: -100px; animation: float 8s ease-in-out infinite; }
.c2 { width: 300px; height: 300px; background: #8b5cf6; bottom: -50px; left: -50px; animation: float 10s ease-in-out infinite reverse; }
.c3 { width: 200px; height: 200px; background: #a78bfa; top: 50%; left: 50%; animation: float 12s ease-in-out infinite; }
@keyframes float {
  0%, 100% { transform: translate(0, 0); }
  33% { transform: translate(30px, -30px); }
  66% { transform: translate(-20px, 20px); }
}
.login-card {
  width: 420px;
  padding: 48px 40px;
  background: rgba(30, 41, 59, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  position: relative;
  z-index: 1;
}
.login-header {
  text-align: center;
  margin-bottom: 32px;
}
.login-logo {
  width: 72px;
  height: 72px;
  margin: 0 auto 16px;
  background: var(--gradient-primary);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
}
.login-header h1 {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}
.login-header p {
  font-size: 13px;
  color: var(--text-secondary);
}
.login-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  border-radius: 10px !important;
}
</style>
