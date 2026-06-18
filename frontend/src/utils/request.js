import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '../router'

const api = axios.create({
    baseURL: '/api',
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token')
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => Promise.reject(error)
)

api.interceptors.response.use(
    (response) => {
        const { data } = response
        if (data.success === false) {
            ElMessage.error(data.message || '请求失败')
            return Promise.reject(new Error(data.message))
        }
        return data
    },
    (error) => {
        if (error.response) {
            const { status, data, config } = error.response
            const isLoginRequest = config?.url?.includes('/auth/login')
            if (status === 401 && !isLoginRequest) {
                localStorage.removeItem('token')
                localStorage.removeItem('userInfo')
                if (router.currentRoute.value.path !== '/login') {
                    router.push('/login')
                }
                ElMessage.error('登录已过期，请重新登录')
            } else {
                ElMessage.error(data?.message || `请求错误 (${status})`)
            }
        } else {
            ElMessage.error('网络连接失败')
        }
        return Promise.reject(error)
    }
)

export default api
