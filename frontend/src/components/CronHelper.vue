<template>
  <div class="cron-helper">
    <div class="cron-input-row">
      <el-input
        v-model="cronExpression"
        placeholder="请输入cron表达式，如: 0 0 2 * * ?"
        @input="parseCron"
      />
      <el-button type="primary" @click="showPresets">常用预设</el-button>
    </div>

    <div class="cron-description" v-if="humanDescription">
      <el-icon :size="16" color="#409eff"><InfoFilled /></el-icon>
      <span>{{ humanDescription }}</span>
    </div>

    <div class="cron-fields">
      <div class="cron-field">
        <label>分钟</label>
        <el-select v-model="fields.minute" @change="buildCron" filterable allow-create>
          <el-option v-for="opt in minuteOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <div class="field-help">0-59</div>
      </div>
      <div class="cron-field">
        <label>小时</label>
        <el-select v-model="fields.hour" @change="buildCron" filterable allow-create>
          <el-option v-for="opt in hourOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <div class="field-help">0-23</div>
      </div>
      <div class="cron-field">
        <label>日期</label>
        <el-select v-model="fields.day" @change="buildCron" filterable allow-create>
          <el-option v-for="opt in dayOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <div class="field-help">1-31</div>
      </div>
      <div class="cron-field">
        <label>月份</label>
        <el-select v-model="fields.month" @change="buildCron" filterable allow-create>
          <el-option v-for="opt in monthOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <div class="field-help">1-12</div>
      </div>
      <div class="cron-field">
        <label>星期</label>
        <el-select v-model="fields.week" @change="buildCron" filterable allow-create>
          <el-option v-for="opt in weekOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <div class="field-help">1-7 或 ?</div>
      </div>
    </div>

    <el-dialog v-model="presetDialogVisible" title="常用预设" width="400px">
      <el-radio-group v-model="selectedPreset" @change="applyPreset">
        <div class="preset-list">
          <el-radio v-for="preset in presets" :key="preset.value" :value="preset.value" class="preset-item">
            <div class="preset-label">{{ preset.label }}</div>
            <div class="preset-cron">{{ preset.value }}</div>
            <div class="preset-desc">{{ preset.description }}</div>
          </el-radio>
        </div>
      </el-radio-group>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { InfoFilled } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: '0 0 2 * * ?'
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const cronExpression = ref(props.modelValue)
const presetDialogVisible = ref(false)
const selectedPreset = ref('')

const fields = reactive({
  second: '0',
  minute: '0',
  hour: '2',
  day: '*',
  month: '*',
  week: '?'
})

const minuteOptions = [
  { value: '*', label: '每分钟' },
  { value: '0', label: '0分' },
  { value: '30', label: '30分' },
  { value: '0,30', label: '0和30分' },
  ...Array.from({ length: 60 }, (_, i) => ({ value: String(i), label: `${i}分` }))
]

const hourOptions = [
  { value: '*', label: '每小时' },
  { value: '0', label: '0点' },
  { value: '2', label: '2点' },
  { value: '6', label: '6点' },
  { value: '8', label: '8点' },
  { value: '12', label: '12点' },
  { value: '18', label: '18点' },
  { value: '22', label: '22点' },
  { value: '0,6,12,18', label: '0/6/12/18点' },
  ...Array.from({ length: 24 }, (_, i) => ({ value: String(i), label: `${i}点` }))
]

const dayOptions = [
  { value: '*', label: '每天' },
  { value: '?', label: '不指定' },
  { value: '1', label: '1号' },
  { value: '15', label: '15号' },
  { value: '1,15', label: '1和15号' },
  ...Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}号` }))
]

const monthOptions = [
  { value: '*', label: '每月' },
  { value: '1', label: '1月' },
  { value: '6', label: '6月' },
  { value: '12', label: '12月' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}月` }))
]

const weekOptions = [
  { value: '?', label: '不指定' },
  { value: '1', label: '周日' },
  { value: '2', label: '周一' },
  { value: '3', label: '周二' },
  { value: '4', label: '周三' },
  { value: '5', label: '周四' },
  { value: '6', label: '周五' },
  { value: '7', label: '周六' },
  { value: '2,3,4,5,6', label: '工作日' },
  { value: '1,7', label: '周末' }
]

const presets = [
  { value: '0 0 * * * ?', label: '每小时', description: '每小时整点执行' },
  { value: '0 0 2 * * ?', label: '每天凌晨2点', description: '每天凌晨02:00执行' },
  { value: '0 0 6 * * ?', label: '每天早上6点', description: '每天早上06:00执行' },
  { value: '0 0 8 * * ?', label: '每天早上8点', description: '每天早上08:00执行' },
  { value: '0 30 8 * * ?', label: '每天早上8点半', description: '每天早上08:30执行' },
  { value: '0 0 12 * * ?', label: '每天中午12点', description: '每天中午12:00执行' },
  { value: '0 0 18 * * ?', label: '每天晚上6点', description: '每天晚上18:00执行' },
  { value: '0 0 22 * * ?', label: '每天晚上10点', description: '每天晚上22:00执行' },
  { value: '0 0 2 ? * MON', label: '每周一凌晨2点', description: '每周一02:00执行' },
  { value: '0 0 8 ? * FRI', label: '每周五早上8点', description: '每周五08:00执行' },
  { value: '0 0 2 1 * ?', label: '每月1号凌晨2点', description: '每月1日02:00执行' },
  { value: '0 0 2 15 * ?', label: '每月15号凌晨2点', description: '每月15日02:00执行' },
  { value: '0 */5 * * * ?', label: '每5分钟', description: '每隔5分钟执行' },
  { value: '0 */30 * * * ?', label: '每30分钟', description: '每隔30分钟执行' },
  { value: '0 0 0 1 1 ?', label: '每年1月1号', description: '每年元旦00:00执行' }
]

const humanDescription = computed(() => {
  return parseCronToHuman(cronExpression.value)
})

const parseCronToHuman = (cron) => {
  if (!cron) return ''
  const parts = cron.trim().split(/\s+/)
  if (parts.length < 5) return '无效的cron表达式'

  let desc = ''
  const [minute, hour, day, month, week, second] = parts.length === 6 ? parts : ['0', ...parts]

  if (minute === '*') desc += '每分钟 '
  else if (minute.includes('/')) desc += `每${minute.split('/')[1]}分钟 `
  else if (minute.includes(',')) desc += `第${minute}分钟 `
  else if (minute !== '0') desc += `${minute}分 `

  if (hour === '*') desc += '每小时 '
  else if (hour.includes('/')) desc += `每${hour.split('/')[1]}小时 `
  else if (hour.includes(',')) desc += `${hour}点 `
  else desc += `${hour}点 `

  if (day !== '*' && day !== '?') {
    if (day.includes('/')) desc += `每${day.split('/')[1]}天 `
    else desc += `${day}号 `
  }

  if (month !== '*') {
    desc += `${month}月 `
  }

  if (week !== '*' && week !== '?') {
    const weekMap = { '1': '周日', '2': '周一', '3': '周二', '4': '周三', '5': '周四', '6': '周五', '7': '周六' }
    if (weekMap[week]) desc += weekMap[week]
    else if (week === '2,3,4,5,6') desc += '工作日'
    else if (week === '1,7') desc += '周末'
    else desc += `星期${week} `
  }

  return desc ? `将在 ${desc}执行` : ''
}

const parseCron = () => {
  const parts = cronExpression.value.trim().split(/\s+/)
  if (parts.length === 6) {
    fields.second = parts[0]
    fields.minute = parts[1]
    fields.hour = parts[2]
    fields.day = parts[3]
    fields.month = parts[4]
    fields.week = parts[5]
  } else if (parts.length === 5) {
    fields.second = '0'
    fields.minute = parts[0]
    fields.hour = parts[1]
    fields.day = parts[2]
    fields.month = parts[3]
    fields.week = parts[4]
  }
  emit('update:modelValue', cronExpression.value)
  emit('change', cronExpression.value)
}

const buildCron = () => {
  cronExpression.value = `${fields.second} ${fields.minute} ${fields.hour} ${fields.day} ${fields.month} ${fields.week}`
  emit('update:modelValue', cronExpression.value)
  emit('change', cronExpression.value)
}

const showPresets = () => {
  presetDialogVisible.value = true
  selectedPreset.value = cronExpression.value
}

const applyPreset = (value) => {
  cronExpression.value = value
  parseCron()
  presetDialogVisible.value = false
}

watch(() => props.modelValue, (val) => {
  if (val !== cronExpression.value) {
    cronExpression.value = val
    parseCron()
  }
})

onMounted(() => {
  parseCron()
})
</script>

<style scoped>
.cron-helper {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 16px;
}

.cron-input-row {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.cron-input-row .el-input {
  flex: 1;
}

.cron-description {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(64, 158, 255, 0.1);
  border-radius: var(--radius-sm);
  margin-bottom: 16px;
  font-size: 14px;
  color: var(--text-primary);
}

.cron-fields {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.cron-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cron-field label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.field-help {
  font-size: 12px;
  color: var(--text-placeholder);
}

.preset-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-item {
  display: flex;
  flex-direction: column;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  margin: 0;
  transition: all 0.2s;
}

.preset-item:hover {
  border-color: var(--primary);
  background: var(--bg-hover);
}

.preset-label {
  font-weight: 500;
  color: var(--text-primary);
}

.preset-cron {
  font-family: monospace;
  font-size: 13px;
  color: var(--primary);
  margin: 2px 0;
}

.preset-desc {
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
