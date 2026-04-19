<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { z } from 'zod'
import { useOpenDialog } from '@/composables/useFileDialog'
import { execSSH } from '@/composables/useSSH'
import { useSettingsStore } from '@/stores/settings'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import type { ControlConnection, AuthMethod } from '@/types/deployment'

const props = defineProps<{
  initialData?: ControlConnection
  submitLabel?: string
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [data: Omit<ControlConnection, 'id' | 'createdAt' | 'updatedAt'>]
  cancel: []
}>()

const settingsStore = useSettingsStore()

// ── Form State ──────────────────────────────────────────────

const form = ref({
  name: '',
  host: '',
  username: '',
  authMethod: 'key' as AuthMethod,
  privateKeyPath: '',
  password: '',
  sshPort: '22',
  applicationName: '',
  applicationHttpPort: '',
  applicationHttpsPort: '',
  rootDeploymentPath: '',
  servicesPath: '',
  logsPath: 'logs',
  tagsString: '',
})

const errors = ref<Record<string, string>>({})
const testStatus = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
const testMessage = ref('')

// ── Validation Schema ────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  host: z.string().min(1, 'Host is required'),
  username: z.string().min(1, 'Username is required'),
  authMethod: z.enum(['key', 'password']),
  sshPort: z.number().int().min(1).max(65535),
  applicationName: z.string().min(1, 'Application name is required'),
  applicationHttpPort: z.number().int().optional().or(z.literal(0)),
  applicationHttpsPort: z.number().int().optional().or(z.literal(0)),
  rootDeploymentPath: z.string().min(1, 'Root deployment path is required'),
  servicesPath: z.string().min(1, 'Services path is required'),
  logsPath: z.string().min(1, 'Logs path is required'),
  privateKeyPath: z.string().optional(),
  password: z.string().optional(),
}).refine((data) => {
  if (data.authMethod === 'password') return !!data.password
  return true
}, {
  message: 'Password is required for password authentication',
  path: ['password'],
})

const connectionSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  username: z.string().min(1, 'Username is required'),
  authMethod: z.enum(['key', 'password']),
  sshPort: z.number().int().min(1).max(65535),
  privateKeyPath: z.string().optional(),
  password: z.string().optional(),
}).refine((data) => {
  if (data.authMethod === 'key') return !!data.privateKeyPath
  return true
}, {
  message: 'Private key path is required for key authentication',
  path: ['privateKeyPath'],
}).refine((data) => {
  if (data.authMethod === 'password') return !!data.password
  return true
}, {
  message: 'Password is required for password authentication',
  path: ['password'],
})

// ── Lifecycle ────────────────────────────────────────────────

onMounted(() => {
  if (props.initialData) {
    const d = props.initialData
    form.value = {
      name: d.name,
      host: d.host,
      username: d.username,
      authMethod: d.authMethod,
      privateKeyPath: d.privateKeyPath || '',
      password: d.password || '',
      sshPort: String(d.sshPort),
      applicationName: d.applicationName,
      applicationHttpPort: d.applicationHttpPort ? String(d.applicationHttpPort) : '',
      applicationHttpsPort: d.applicationHttpsPort ? String(d.applicationHttpsPort) : '',
      rootDeploymentPath: d.rootDeploymentPath,
      servicesPath: d.servicesPath,
      logsPath: d.logsPath,
      tagsString: d.tags.join(', '),
    }
  }
})

// ── Actions ──────────────────────────────────────────────────

async function pickPrivateKey() {
  const path = await useOpenDialog({ title: 'Select SSH Private Key' })
  if (path) form.value.privateKeyPath = path
}

async function handleTestConnection() {
  testStatus.value = 'loading'
  testMessage.value = ''

  const result = connectionSchema.safeParse({ 
    ...form.value, 
    sshPort: Number(form.value.sshPort),
  })

  if (!result.success) {
    result.error.issues.forEach((issue) => {
      const path = issue.path[0]
      if (typeof path === 'string') errors.value[path] = issue.message
    })
    testStatus.value = 'error'
    testMessage.value = 'Please fix validation errors first.'
    return
  }

  try {
    const res = await execSSH(result.data, 'echo ok')
    if (res.exitCode === 0 && res.output.includes('ok')) {
      testStatus.value = 'success'
      testMessage.value = 'Connection successful!'
    } else {
      testStatus.value = 'error'
      testMessage.value = res.output || 'Connection failed.'
    }
  } catch (err) {
    testStatus.value = 'error'
    testMessage.value = String(err)
  }
}

function handleSubmit() {
  errors.value = {}

  const result = schema.safeParse({ 
    ...form.value, 
    sshPort: Number(form.value.sshPort),
    applicationHttpPort: form.value.applicationHttpPort ? Number(form.value.applicationHttpPort) : undefined,
    applicationHttpsPort: form.value.applicationHttpsPort ? Number(form.value.applicationHttpsPort) : undefined,
  })

  if (!result.success) {
    result.error.issues.forEach((issue) => {
      const path = issue.path[0]
      if (typeof path === 'string') errors.value[path] = issue.message
    })
    return
  }

  const tags = form.value.tagsString
    .split(/[ ,]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0)

  emit('submit', {
    ...result.data,
    tags,
    serviceOverrides: props.initialData?.serviceOverrides || {}
  })
}
</script>

<template>
  <form class="control-form" @submit.prevent="handleSubmit">
    <div class="form-grid">
      <!-- Section: General -->
      <div class="form-section">
        <h3 class="section-title">General Information</h3>
        <div class="section-content">
          <BaseInput
            v-model="form.name"
            label="Configuration Name"
            placeholder="e.g. My Server Control"
            required
            :error="errors.name"
          />
          <BaseInput
            v-model="form.tagsString"
            label="Tags"
            placeholder="e.g. cloud, production (comma separated)"
            hint="Used for filtering on the dashboard"
          />
        </div>
      </div>

      <!-- Section: SSH Connection -->
      <div class="form-section">
        <h3 class="section-title">SSH Connection</h3>
        <div class="section-content">
          <div class="row">
            <BaseInput
              v-model="form.host"
              label="Host"
              placeholder="e.g. 192.168.1.10"
              required
              :error="errors.host"
              class="flex-1"
            />
            <BaseInput
              v-model="form.sshPort"
              type="number"
              label="Port"
              required
              :error="errors.sshPort"
              style="width: 80px"
            />
          </div>
          <BaseInput
            v-model="form.username"
            label="Username"
            placeholder="e.g. root"
            required
            :error="errors.username"
          />

          <div class="input-field">
            <label class="input-label">Authentication Method</label>
            <div class="auth-toggle">
              <button
                type="button"
                :class="['toggle-btn', { active: form.authMethod === 'key' }]"
                @click="form.authMethod = 'key'"
              >
                SSH Key
              </button>
              <button
                type="button"
                :class="['toggle-btn', { active: form.authMethod === 'password' }]"
                @click="form.authMethod = 'password'"
              >
                Password
              </button>
            </div>
          </div>

          <div v-if="form.authMethod === 'key'" class="field-with-action">
            <BaseInput
              v-model="form.privateKeyPath"
              label="Private Key Path"
              placeholder="/path/to/id_rsa"
              required
              read-only
              :error="errors.privateKeyPath"
              class="flex-1"
            />
            <BaseButton size="sm" class="action-btn" @click="pickPrivateKey">Browse</BaseButton>
          </div>

          <BaseInput
            v-if="form.authMethod === 'password'"
            v-model="form.password"
            type="password"
            label="Password"
            placeholder="••••••••"
            required
            :error="errors.password"
          />

          <div class="test-connection-box">
            <BaseButton
              type="button"
              variant="secondary"
              size="sm"
              :loading="testStatus === 'loading'"
              @click="handleTestConnection"
            >
              Test Connection
            </BaseButton>
            <div v-if="testStatus !== 'idle'" :class="['test-result', testStatus]" :title="testMessage">
              {{ testMessage }}
            </div>
          </div>
        </div>
      </div>

      <!-- Section: Application Settings -->
      <div class="form-section">
        <h3 class="section-title">Application Settings</h3>
        <div class="section-content">
          <BaseInput
            v-model="form.applicationName"
            label="Application Name"
            placeholder="e.g. my-app"
            required
            :error="errors.applicationName"
          />
          <div class="row">
            <BaseInput
              v-model="form.applicationHttpPort"
              type="number"
              label="HTTP Port"
              placeholder="e.g. 80"
              class="flex-1"
            />
            <BaseInput
              v-model="form.applicationHttpsPort"
              type="number"
              label="HTTPS Port"
              placeholder="e.g. 443"
              class="flex-1"
            />
          </div>
        </div>
      </div>

      <!-- Section: Remote Paths -->
      <div class="form-section">
        <h3 class="section-title">Remote Paths</h3>
        <div class="section-content">
          <BaseInput
            v-model="form.rootDeploymentPath"
            label="Root Deployment Path"
            placeholder="e.g. /opt/my-app"
            required
            :error="errors.rootDeploymentPath"
          />
          <BaseInput
            v-model="form.servicesPath"
            label="Services Path"
            placeholder="e.g. ./temp/services*"
            required
            :error="errors.servicesPath"
            hint="Supports wildcards (*) and relative paths"
          />
          <BaseInput
            v-model="form.logsPath"
            label="Logs Path"
            placeholder="e.g. ./logs"
            required
            :error="errors.logsPath"
            hint="Relative to root deployment path"
          />
        </div>
      </div>
    </div>

    <div class="form-actions">
      <div class="flex-spacer"></div>
      <BaseButton variant="ghost" @click="emit('cancel')">Cancel</BaseButton>
      <BaseButton type="submit" variant="primary" :loading="props.loading">
        {{ props.submitLabel || 'Save Configuration' }}
      </BaseButton>
    </div>
  </form>
</template>

<style scoped>
.control-form {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 32px;
}

@media (max-width: 1024px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--color-surface-3);
  padding-bottom: 8px;
  margin: 0;
}

.section-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.row {
  display: flex;
  gap: 12px;
}

.flex-1 {
  flex: 1;
}

.field-with-action {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.action-btn {
  margin-bottom: 2px;
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 24px;
  border-top: 1px solid var(--color-surface-3);
}

.flex-spacer {
  flex: 1;
}

.test-result {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 4px;
  max-width: 300px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.test-result.success {
  color: var(--color-success);
  background-color: color-mix(in srgb, var(--color-success) 10%, transparent);
}

.test-result.error {
  color: var(--color-error);
  background-color: color-mix(in srgb, var(--color-error) 10%, transparent);
}

.input-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.auth-toggle {
  display: flex;
  background-color: var(--color-surface-2);
  border: 1px solid var(--color-surface-3);
  border-radius: 6px;
  padding: 2px;
  width: fit-content;
}

.toggle-btn {
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  padding: 4px 12px;
  transition: background-color 0.15s, color 0.15s;
}

.toggle-btn.active {
  background-color: var(--color-surface-3);
  color: var(--color-text-primary);
}

.toggle-btn:hover:not(.active) {
  color: var(--color-text-primary);
}
</style>
