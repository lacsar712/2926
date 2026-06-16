<template>
  <div class="page-container">
    <div class="page-header fade-in-up">
      <h2 class="page-title">数据质量规则</h2>
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon>新建规则
      </el-button>
    </div>

    <div class="filter-bar fade-in-up">
      <el-select v-model="filterType" placeholder="按类型筛选" clearable style="width: 180px" @change="loadList">
        <el-option v-for="opt in typeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
      </el-select>
      <el-select v-model="filterEnabled" placeholder="按状态筛选" clearable style="width: 160px" @change="loadList">
        <el-option label="已启用" :value="1" />
        <el-option label="已禁用" :value="0" />
      </el-select>
    </div>

    <div class="table-wrapper fade-in-up" v-loading="loading">
      <el-table :data="list" stripe style="width: 100%">
        <el-table-column prop="name" label="规则名称" min-width="160" />
        <el-table-column prop="rule_type" label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="typeTagMap[row.rule_type]?.type" effect="light">{{ typeTagMap[row.rule_type]?.label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="表达式" min-width="220">
          <template #default="{ row }">
            <span v-if="row.rule_type === 'not_null'">—</span>
            <span v-else class="expr-text">{{ row.expression || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="severity" label="严重级别" width="100">
          <template #default="{ row }">
            <el-tag :type="row.severity === 'error' ? 'danger' : 'warning'" effect="dark" size="small">
              {{ row.severity === 'error' ? 'Error' : 'Warning' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="enabled" label="状态" width="100">
          <template #default="{ row }">
            <el-switch :model-value="!!row.enabled" @change="(v) => toggleStatus(row.id, v)" />
          </template>
        </el-table-column>
        <el-table-column label="引用次数" width="100">
          <template #default="{ row }">
            <span class="ref-count">{{ row.reference_count || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="updater_name" label="最后修改人" width="120" />
        <el-table-column prop="updated_at" label="更新时间" width="170">
          <template #default="{ row }">{{ formatDate(row.updated_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text @click="viewReferences(row)">引用</el-button>
            <el-button size="small" text @click="openDialog(row)">编辑</el-button>
            <el-popconfirm title="确认删除此规则？" @confirm="handleDelete(row.id)">
              <template #reference>
                <el-button size="small" text type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="!loading && list.length === 0" class="empty-state">
        <el-icon :size="48" color="var(--text-secondary)"><DataAnalysis /></el-icon>
        <p>暂无质量规则</p>
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="editId ? '编辑规则' : '新建规则'" width="560px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="规则名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入规则名称" maxlength="100" />
        </el-form-item>
        <el-form-item label="规则描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="规则描述说明" maxlength="500" />
        </el-form-item>
        <el-form-item label="规则类型" prop="rule_type">
          <el-select v-model="form.rule_type" placeholder="请选择类型" style="width: 100%">
            <el-option v-for="opt in typeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.rule_type === 'regex'" label="正则表达式" prop="expression">
          <el-input v-model="form.expression" placeholder="例如：^1[3-9]\d{9}$" />
        </el-form-item>
        <el-form-item v-if="form.rule_type === 'numeric_range'" label="数值范围" prop="expression">
          <div style="display: flex; gap: 12px; width: 100%">
            <el-input-number v-model="rangeMin" :controls="false" placeholder="最小值" style="flex: 1" @change="buildRange" />
            <span style="align-self: center">~</span>
            <el-input-number v-model="rangeMax" :controls="false" placeholder="最大值" style="flex: 1" @change="buildRange" />
          </div>
        </el-form-item>
        <el-form-item v-if="form.rule_type === 'enum'" label="枚举值列表" prop="expression">
          <el-select v-model="enumValues" multiple allow-create filterable default-first-option style="width: 100%" placeholder="输入后回车添加枚举值" @change="buildEnum">
            <el-option v-for="v in enumValues" :key="v" :label="v" :value="v" />
          </el-select>
        </el-form-item>
        <el-form-item label="严重级别" prop="severity">
          <el-radio-group v-model="form.severity">
            <el-radio value="warning">
              <el-tag type="warning" effect="dark" size="small">Warning</el-tag>
              <span style="margin-left: 6px">警告</span>
            </el-radio>
            <el-radio value="error">
              <el-tag type="danger" effect="dark" size="small">Error</el-tag>
              <span style="margin-left: 6px">错误</span>
            </el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="refDrawerVisible" title="规则引用统计" size="420px">
      <div v-loading="refLoading">
        <el-empty v-if="!refLoading && referenceList.length === 0" description="该规则暂未被引用" />
        <div v-else class="ref-list">
          <div v-for="(group, pid) in groupedRefs" :key="pid" class="ref-group">
            <div class="ref-pipeline">
              <el-icon color="var(--primary)"><Share /></el-icon>
              <span>{{ group.pipeline_name }} (#{{ pid }})</span>
            </div>
            <div v-for="item in group.nodes" :key="item.node_id" class="ref-node">
              <el-icon color="#94a3b8"><Cpu /></el-icon>
              <span>{{ item.node_label }}</span>
              <el-tag size="small" type="info" style="margin-left: auto">{{ item.component }}</el-tag>
            </div>
          </div>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getQualityRules, createQualityRule, updateQualityRule,
  updateQualityRuleStatus, deleteQualityRule, getQualityRuleReferences
} from '@/api/quality-rule'
import dayjs from 'dayjs'

const loading = ref(false)
const submitting = ref(false)
const list = ref([])
const dialogVisible = ref(false)
const editId = ref(null)
const formRef = ref()
const filterType = ref('')
const filterEnabled = ref('')
const rangeMin = ref(null)
const rangeMax = ref(null)
const enumValues = ref([])
const refDrawerVisible = ref(false)
const refLoading = ref(false)
const referenceList = ref([])

const typeOptions = [
  { label: '非空校验', value: 'not_null' },
  { label: '正则匹配', value: 'regex' },
  { label: '数值范围', value: 'numeric_range' },
  { label: '枚举值', value: 'enum' }
]

const typeTagMap = {
  not_null: { label: '非空', type: '' },
  regex: { label: '正则', type: 'primary' },
  numeric_range: { label: '范围', type: 'success' },
  enum: { label: '枚举', type: 'warning' }
}

const form = reactive({
  name: '', description: '', rule_type: 'not_null',
  expression: null, severity: 'warning', enabled: 1
})

const formRules = {
  name: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  rule_type: [{ required: true, message: '请选择规则类型', trigger: 'change' }],
  severity: [{ required: true, message: '请选择严重级别', trigger: 'change' }],
  expression: [{
    validator: (_rule, value, callback) => {
      if (form.rule_type === 'not_null') { callback(); return }
      if (!value) callback(new Error('请配置表达式'))
      else callback()
    },
    trigger: 'change'
  }]
}

const groupedRefs = computed(() => {
  const map = {}
  referenceList.value.forEach(item => {
    if (!map[item.pipeline_id]) {
      map[item.pipeline_id] = { pipeline_name: item.pipeline_name, nodes: [] }
    }
    map[item.pipeline_id].nodes.push(item)
  })
  return map
})

const formatDate = (d) => d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-'

const buildRange = () => {
  if (rangeMin.value !== null || rangeMax.value !== null) {
    form.expression = JSON.stringify({ min: rangeMin.value, max: rangeMax.value })
  } else {
    form.expression = null
  }
}

const buildEnum = () => {
  if (enumValues.value && enumValues.value.length > 0) {
    form.expression = JSON.stringify(enumValues.value)
  } else {
    form.expression = null
  }
}

const parseExpression = () => {
  if (!form.expression) {
    rangeMin.value = null
    rangeMax.value = null
    enumValues.value = []
    return
  }
  try {
    const parsed = JSON.parse(form.expression)
    if (form.rule_type === 'numeric_range') {
      rangeMin.value = parsed.min ?? null
      rangeMax.value = parsed.max ?? null
    } else if (form.rule_type === 'enum') {
      enumValues.value = Array.isArray(parsed) ? parsed : []
    }
  } catch {
    rangeMin.value = null
    rangeMax.value = null
    enumValues.value = []
  }
}

const loadList = async () => {
  loading.value = true
  try {
    const params = {}
    if (filterType.value) params.type = filterType.value
    if (filterEnabled.value !== '') params.enabled = filterEnabled.value
    const res = await getQualityRules(params)
    list.value = res.data
  } finally { loading.value = false }
}

const openDialog = (item) => {
  editId.value = item?.id || null
  if (item) {
    Object.assign(form, {
      name: item.name, description: item.description || '',
      rule_type: item.rule_type, expression: item.expression,
      severity: item.severity, enabled: item.enabled
    })
    parseExpression()
  } else {
    Object.assign(form, {
      name: '', description: '', rule_type: 'not_null',
      expression: null, severity: 'warning', enabled: 1
    })
    rangeMin.value = null
    rangeMax.value = null
    enumValues.value = []
  }
  dialogVisible.value = true
}

const handleSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    if (editId.value) {
      await updateQualityRule(editId.value, form)
      ElMessage.success('更新成功')
    } else {
      await createQualityRule(form)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadList()
  } finally { submitting.value = false }
}

const toggleStatus = async (id, enabled) => {
  try {
    await updateQualityRuleStatus(id, enabled)
    ElMessage.success('状态更新成功')
    loadList()
  } catch { loadList() }
}

const handleDelete = async (id) => {
  try {
    await deleteQualityRule(id)
    ElMessage.success('删除成功')
    loadList()
  } catch { /* handled */ }
}

const viewReferences = async (row) => {
  refDrawerVisible.value = true
  refLoading.value = true
  try {
    const res = await getQualityRuleReferences(row.id)
    referenceList.value = res.data
  } finally { refLoading.value = false }
}

onMounted(loadList)
</script>

<style scoped>
.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.table-wrapper {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 12px;
}
.expr-text {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: var(--text-secondary);
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ref-count {
  font-weight: 600;
  color: var(--primary);
}
.empty-state { text-align: center; padding: 40px 0; color: var(--text-secondary); }
.empty-state p { margin-top: 12px; }
.ref-group { margin-bottom: 20px; }
.ref-pipeline {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-hover);
  border-radius: var(--radius-sm);
  font-weight: 500;
  font-size: 13px;
  margin-bottom: 8px;
}
.ref-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 8px 32px;
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
