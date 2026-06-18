<template>
  <div class="app-layout">
    <aside class="sidebar" :class="{ collapsed: isCollapsed }">
      <div class="sidebar-header">
        <div class="logo-area">
          <div class="logo-icon">
            <el-icon :size="28"><Share /></el-icon>
          </div>
          <transition name="fade">
            <span v-if="!isCollapsed" class="logo-text">DataPipeline</span>
          </transition>
        </div>
        <el-icon class="collapse-btn" @click="isCollapsed = !isCollapsed">
          <component :is="isCollapsed ? 'Expand' : 'Fold'" />
        </el-icon>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapsed"
        class="sidebar-menu"
        background-color="transparent"
        text-color="#94a3b8"
        active-text-color="#818cf8"
        router
      >
        <el-menu-item index="/dashboard">
          <el-icon><Odometer /></el-icon>
          <template #title>工作台</template>
        </el-menu-item>
        <el-menu-item index="/templates">
          <el-icon><Collection /></el-icon>
          <template #title>模板库</template>
        </el-menu-item>
        <el-menu-item index="/pipeline">
          <el-icon><Operation /></el-icon>
          <template #title>生产线管理</template>
        </el-menu-item>
        <el-menu-item index="/monitor">
          <el-icon><DataLine /></el-icon>
          <template #title>生产线监控</template>
        </el-menu-item>
        <el-menu-item index="/schedule">
          <el-icon><Timer /></el-icon>
          <template #title>调度任务</template>
        </el-menu-item>
        <el-sub-menu index="/system">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>系统管理</span>
          </template>
          <el-menu-item index="/system/user">
            <el-icon><User /></el-icon>
            <template #title>用户管理</template>
          </el-menu-item>
          <el-menu-item index="/system/tag">
            <el-icon><PriceTag /></el-icon>
            <template #title>标签管理</template>
          </el-menu-item>
          <el-menu-item index="/system/log">
            <el-icon><Document /></el-icon>
            <template #title>操作日志</template>
          </el-menu-item>
          <el-menu-item index="/system/quality-rule">
            <el-icon><DataAnalysis /></el-icon>
            <template #title>数据质量规则</template>
          </el-menu-item>
          <el-menu-item index="/system/component-doc">
            <el-icon><Notebook /></el-icon>
            <template #title>组件文档管理</template>
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </aside>
    <div class="main-area">
      <header class="topbar">
        <div class="breadcrumb-area">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="$route.meta.title">{{ $route.meta.title }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <GlobalSearch />
        <div class="topbar-actions">
          <NotificationPanel />
        </div>
        <div class="user-area">
          <el-dropdown trigger="click" @command="handleCommand">
            <div class="user-info">
              <el-avatar :size="32" :style="{ background: 'var(--gradient-primary)' }">
                {{ userInfo?.nickname?.charAt(0) || 'U' }}
              </el-avatar>
              <span class="username">{{ userInfo?.nickname || '用户' }}</span>
              <el-icon><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>
                  <el-icon><User /></el-icon>
                  {{ userInfo?.username }} ({{ roleLabel }})
                </el-dropdown-item>
                <el-dropdown-item divided command="profile">
                  <el-icon><UserFilled /></el-icon>
                  个人中心
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>
      <main class="content-area">
        <router-view v-slot="{ Component }">
          <transition name="fade-transform" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NotificationPanel from '@/components/NotificationPanel.vue'
import GlobalSearch from '@/components/GlobalSearch.vue'

const route = useRoute()
const router = useRouter()
const isCollapsed = ref(false)

const userInfo = computed(() => {
  try { return JSON.parse(localStorage.getItem('userInfo') || '{}') } catch { return {} }
})

const activeMenu = computed(() => route.meta.activeMenu || route.path)
const roleLabel = computed(() => {
  const map = { admin: '管理员', editor: '编辑者', viewer: '查看者' }
  return map[userInfo.value?.role] || '用户'
})

const handleCommand = (cmd) => {
  if (cmd === 'profile') {
    router.push('/profile')
  } else if (cmd === 'logout') {
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
    router.push('/login')
  }
}
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
.sidebar {
  width: 240px;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  flex-shrink: 0;
}
.sidebar.collapsed {
  width: 64px;
}
.sidebar-header {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-color);
  overflow: hidden;
}
.collapsed .sidebar-header {
  justify-content: center;
  padding: 0;
}
.collapsed .logo-area {
  display: none;
}
.logo-area {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
}
.logo-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}
.logo-text {
  font-size: 16px;
  font-weight: 700;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  white-space: nowrap;
}
.collapse-btn {
  cursor: pointer;
  color: var(--text-secondary);
  transition: var(--transition);
  flex-shrink: 0;
  font-size: 18px;
}
.collapse-btn:hover {
  color: var(--primary);
}
.sidebar-menu {
  flex: 1;
  padding: 12px 8px;
  overflow-y: auto;
}
.sidebar-menu .el-menu-item,
.sidebar-menu :deep(.el-sub-menu__title) {
  border-radius: var(--radius-sm);
  margin-bottom: 4px;
  height: 44px;
  line-height: 44px;
}
.sidebar-menu .el-menu-item:hover,
.sidebar-menu :deep(.el-sub-menu__title:hover) {
  background: var(--bg-hover) !important;
}
.sidebar-menu .el-menu-item.is-active {
  background: rgba(99, 102, 241, 0.15) !important;
  color: var(--primary-light) !important;
}
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--gradient-bg);
}
.topbar {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: rgba(30, 41, 59, 0.6);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 16px;
}
.breadcrumb-area :deep(.el-breadcrumb__inner) {
  color: var(--text-secondary) !important;
}
.breadcrumb-area :deep(.el-breadcrumb__inner.is-link) {
  color: var(--text-secondary) !important;
}
.topbar :deep(.global-search) {
  margin-left: auto;
}
.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: var(--transition);
}
.user-info:hover {
  background: var(--bg-hover);
}
.username {
  font-size: 14px;
  color: var(--text-primary);
}
.content-area {
  flex: 1;
  overflow: hidden;
}
.fade-transform-enter-active,
.fade-transform-leave-active {
  transition: all 0.3s;
}
.fade-transform-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}
.fade-transform-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
