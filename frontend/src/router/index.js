import { createRouter, createWebHistory } from 'vue-router'

const routes = [
    {
        path: '/login',
        name: 'Login',
        component: () => import('@/views/Login.vue'),
        meta: { title: '登录', hideLayout: true }
    },
    {
        path: '/',
        component: () => import('@/layout/AppLayout.vue'),
        redirect: '/pipeline',
        children: [
            {
                path: 'templates',
                name: 'Templates',
                component: () => import('@/views/template/TemplateLibrary.vue'),
                meta: { title: '模板库', icon: 'Collection' }
            },
            {
                path: 'pipeline',
                name: 'Pipeline',
                component: () => import('@/views/pipeline/PipelineList.vue'),
                meta: { title: '生产线管理', icon: 'Operation' }
            },
            {
                path: 'pipeline/flow/:id',
                name: 'PipelineFlow',
                component: () => import('@/views/pipeline/PipelineFlow.vue'),
                meta: { title: '生产线编排', icon: 'Share', activeMenu: '/pipeline' }
            },
            {
                path: 'monitor',
                name: 'Monitor',
                component: () => import('@/views/monitor/MonitorDashboard.vue'),
                meta: { title: '生产线监控', icon: 'DataLine' }
            },
            {
                path: 'schedule',
                name: 'Schedule',
                component: () => import('@/views/schedule/ScheduleTaskList.vue'),
                meta: { title: '调度任务', icon: 'Timer' }
            },
            {
                path: 'monitor/detail/:id',
                name: 'MonitorDetail',
                component: () => import('@/views/monitor/MonitorDetail.vue'),
                meta: { title: '监控详情', icon: 'View', activeMenu: '/monitor' }
            },
            {
                path: 'monitor/compare',
                name: 'MonitorCompare',
                component: () => import('@/views/monitor/MonitorCompare.vue'),
                meta: { title: '运行对比', icon: 'Scale', activeMenu: '/monitor' }
            },
            {
                path: 'system/user',
                name: 'SystemUser',
                component: () => import('@/views/system/UserManage.vue'),
                meta: { title: '用户管理', icon: 'User' }
            },
            {
                path: 'system/tag',
                name: 'SystemTag',
                component: () => import('@/views/system/TagManage.vue'),
                meta: { title: '标签管理', icon: 'PriceTag' }
            },
            {
                path: 'system/log',
                name: 'SystemLog',
                component: () => import('@/views/system/LogManage.vue'),
                meta: { title: '操作日志', icon: 'Document' }
            },
            {
                path: 'system/quality-rule',
                name: 'SystemQualityRule',
                component: () => import('@/views/system/QualityRuleManage.vue'),
                meta: { title: '数据质量规则', icon: 'DataAnalysis' }
            },
            {
                path: 'system/component-doc',
                name: 'SystemComponentDoc',
                component: () => import('@/views/system/ComponentDocManage.vue'),
                meta: { title: '组件文档管理', icon: 'Notebook' }
            },
            {
                path: 'notifications',
                name: 'Notifications',
                component: () => import('@/views/notification/NotificationList.vue'),
                meta: { title: '通知中心', icon: 'Bell' }
            }
        ]
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

router.beforeEach((to, _from, next) => {
    document.title = `${to.meta.title || '数据生产线'} - 数据生产线可视化平台`
    if (to.path !== '/login' && !localStorage.getItem('token')) {
        next('/login')
    } else {
        next()
    }
})

export default router
