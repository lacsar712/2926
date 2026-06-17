import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { getPreference, updatePreference } from '@/api/profile'

const STORAGE_KEY = 'user_preference'

const defaultPreference = {
  theme: 'dark',
  pageSize: 10,
  autoSave: true
}

const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error('读取本地偏好设置失败:', e)
  }
  return null
}

const saveToStorage = (pref) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pref))
  } catch (e) {
    console.error('保存本地偏好设置失败:', e)
  }
}

export const usePreferenceStore = defineStore('preference', () => {
  const theme = ref('dark')
  const pageSize = ref(10)
  const autoSave = ref(true)
  const loaded = ref(false)

  const applyTheme = (themeValue) => {
    const html = document.documentElement
    html.classList.remove('dark')

    let effectiveTheme = themeValue
    if (themeValue === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }

    if (effectiveTheme === 'dark') {
      html.classList.add('dark')
    }
  }

  const initTheme = () => {
    const stored = loadFromStorage()
    if (stored && stored.theme) {
      theme.value = stored.theme
    }
    applyTheme(theme.value)

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (theme.value === 'system') {
          applyTheme('system')
        }
      })
    }
  }

  const fetchPreference = async () => {
    try {
      const res = await getPreference()
      const data = res.data
      theme.value = data.theme
      pageSize.value = data.pageSize
      autoSave.value = data.autoSave
      loaded.value = true
      saveToStorage({ theme: data.theme, pageSize: data.pageSize, autoSave: data.autoSave })
      applyTheme(data.theme)
      return data
    } catch (error) {
      console.error('获取偏好设置失败:', error)
      const stored = loadFromStorage()
      if (stored) {
        theme.value = stored.theme ?? defaultPreference.theme
        pageSize.value = stored.pageSize ?? defaultPreference.pageSize
        autoSave.value = stored.autoSave ?? defaultPreference.autoSave
        applyTheme(stored.theme ?? defaultPreference.theme)
      }
      loaded.value = true
      throw error
    }
  }

  const savePreference = async (data) => {
    try {
      const res = await updatePreference(data)
      const updated = res.data
      if (data.theme !== undefined) {
        theme.value = updated.theme
        applyTheme(updated.theme)
      }
      if (data.pageSize !== undefined) {
        pageSize.value = updated.pageSize
      }
      if (data.autoSave !== undefined) {
        autoSave.value = updated.autoSave
      }
      saveToStorage({
        theme: theme.value,
        pageSize: pageSize.value,
        autoSave: autoSave.value
      })
      return updated
    } catch (error) {
      console.error('保存偏好设置失败:', error)
      throw error
    }
  }

  const setTheme = async (newTheme) => {
    theme.value = newTheme
    applyTheme(newTheme)
    saveToStorage({
      theme: newTheme,
      pageSize: pageSize.value,
      autoSave: autoSave.value
    })
    try {
      await updatePreference({ theme: newTheme })
    } catch (e) {
      console.error('同步主题到后端失败:', e)
    }
  }

  const setPageSize = async (size) => {
    pageSize.value = size
    saveToStorage({
      theme: theme.value,
      pageSize: size,
      autoSave: autoSave.value
    })
  }

  const setAutoSave = async (enabled) => {
    autoSave.value = enabled
    saveToStorage({
      theme: theme.value,
      pageSize: pageSize.value,
      autoSave: enabled
    })
  }

  return {
    theme,
    pageSize,
    autoSave,
    loaded,
    initTheme,
    fetchPreference,
    savePreference,
    setTheme,
    setPageSize,
    setAutoSave
  }
})
