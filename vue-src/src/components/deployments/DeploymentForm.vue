<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { useOpenDialog } from '@/composables/useFileDialog'
import { execSSH } from '@/composables/useSSH'
import { useSettingsStore } from '@/stores/settings'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import type { Deployment, Service, AuthMethod } from '@/types/deployment'

const props = defineProps<{
  initialData?: Deployment
  submitLabel?: string
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [data: Omit<Deployment, 'id' | 'createdAt' | 'updatedAt'>]
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
  remoteDeployPath: '',
  remoteLogPath: '',
  tagsString: '',
  description: '',
})

type ServiceDraft = {
  id: string
  name: string
  localJarPath: string
  startCommand: string
  stopCommand: string
}

const services = ref<ServiceDraft[]>([
  { id: uuidv4(), name: '', localJarPath: '', startCommand: '', stopCommand: '' }
])

const errors = ref<Record<string, string>>({})
const servicesErrors = ref<Array<Record<string, string>>>([{}])
const testStatus = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
const testMessage = ref('')

// ── Validation Schema ────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  host: z.string().min(1, 'Host is required'),
  username: z.string().min(1, 'Username is required'),
  authMethod: z.enum(['key', 'password']),
  sshPort: z.number().int().min(1).max(65535),
  remoteDeployPath: z.string().min(1, 'Remote deploy path is required'),
  remoteLogPath: z.string().min(1, 'Remote log path is required'),
  description: z.string().optional(),
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

function validateServices(): boolean {
  let valid = true
  servicesErrors.value = services.value.map(s => {
    const errs: Record<string, string> = {}
    if (!s.name.trim()) { errs.name = 'Service name is required'; valid = false }
    if (!s.localJarPath.trim()) { errs.localJarPath = 'JAR path is required'; valid = false }
    return errs
  })
  return valid
}

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
      remoteDeployPath: d.remoteDeployPath,
      remoteLogPath: d.remoteLogPath,
      tagsString: d.tags.join(', '),
      description: d.description || '',
    }
    if (d.services.length > 0) {
      services.value = d.services.map(s => ({
        id: s.id,
        name: s.name,
        localJarPath: s.localJarPath,
        startCommand: s.startCommand,
        stopCommand: s.stopCommand || '',
      }))
      servicesErrors.value = d.services.map(() => ({}))
    }
  }
})

// ── Actions ──────────────────────────────────────────────────

async function pickPrivateKey() {
  const path = await useOpenDialog({ title: 'Select SSH Private Key' })
  if (path) form.value.privateKeyPath = path
}

async function pickJar(index: number) {
  const path = await useOpenDialog({
    title: 'Select JAR File',
    filters: [{ name: 'JAR Files', extensions: ['jar'] }]
  })
  if (path && services.value[index]) services.value[index]!.localJarPath = path
}

function addService() {
  services.value.push({ id: uuidv4(), name: '', localJarPath: '', startCommand: '', stopCommand: '' })
  servicesErrors.value.push({})
}

function removeService(index: number) {
  if (services.value.length <= 1) return
  services.value.splice(index, 1)
  servicesErrors.value.splice(index, 1)
}

async function handleTestConnection() {
  errors.value = {}
  testStatus.value = 'loading'
  testMessage.value = ''

  const result = schema.safeParse({ ...form.value, sshPort: Number(form.value.sshPort) })

  if (!result.success) {
    result.error.issues.forEach((issue) => {
      const path = issue.path[0]
      if (typeof path === 'string') errors.value[path] = issue.message
    })
    testStatus.value = 'error'
    testMessage.value = 'Please fix validation errors first.'
    return
  }

  const tempDeployment: Deployment = {
    id: 'test',
    ...result.data,
    services: [],
    tags: [],
    createdAt: '',
    updatedAt: '',
  }

  try {
    const res = await execSSH(tempDeployment, 'exit')
    if (res.exitCode === 0) {
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

  const result = schema.safeParse({ ...form.value, sshPort: Number(form.value.sshPort) })

  if (!result.success) {
    result.error.issues.forEach((issue) => {
      const path = issue.path[0]
      if (typeof path === 'string') errors.value[path] = issue.message
    })
    return
  }

  if (!validateServices()) return

  const tags = form.value.tagsString
    .split(/[ ,]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0)

  const mappedServices: Service[] = services.value.map(s => ({
    id: s.id,
    name: s.name.trim(),
    localJarPath: s.localJarPath.trim(),
    startCommand: s.startCommand.trim(),
    stopCommand: s.stopCommand.trim() || undefined,
  }))

  emit('submit', {
    ...result.data,
    services: mappedServices,
    tags,
    description: form.value.description,
  })
}
</script>

<template>
  <form class="deployment-form" @submit.prevent="handleSubmit">
    <div class="form-grid">
      <!-- Section: General -->
      <div class="form-section">
        <h3 class="section-title">General Information</h3>
        <div class="section-content">
          <BaseInput
            v-model="form.name"
            label="Configuration Name"
            placeholder="e.g. Production — Auth Service"
            required
            :error="errors.name"
          />
          <BaseInput
            v-model="form.tagsString"
            label="Tags"
            placeholder="e.g. production, auth, web (comma separated)"
            hint="Used for filtering on the dashboard"
          />
          <div class="input-field">
            <label class="input-label">Description</label>
            <textarea
              v-model="form.description"
              class="textarea"
              placeholder="Optional notes about this deployment..."
            ></textarea>
          </div>
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
            placeholder="e.g. deploy"
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
            <p v-if="form.authMethod === 'password' && !settingsStore.sshpassAvailable && !settingsStore.plinkAvailable" class="info-msg">
              ℹ️ Using built-in OpenSSH with SSH_ASKPASS.
            </p>
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
        </div>
      </div>

      <!-- Section: Remote Environment -->
      <div class="form-section">
        <h3 class="section-title">Remote Environment</h3>
        <div class="section-content">
          <BaseInput
            v-model="form.remoteDeployPath"
            label="Remote Deploy Path"
            placeholder="/opt/services"
            required
            :error="errors.remoteDeployPath"
          />
          <BaseInput
            v-model="form.remoteLogPath"
            label="Remote Log Path"
            placeholder="/var/log/services"
            required
            :error="errors.remoteLogPath"
          />
        </div>
      </div>
    </div>

    <!-- Section: Services (full-width) -->
    <div class="form-section services-section">
      <div class="services-header">
        <h3 class="section-title">Services</h3>
        <BaseButton type="button" variant="secondary" size="sm" @click="addService">
          + Add Service
        </BaseButton>
      </div>

      <div class="services-list">
        <div
          v-for="(svc, index) in services"
          :key="svc.id"
          class="service-card"
        >
          <div class="service-card-header">
            <span class="service-index">Service {{ index + 1 }}</span>
            <button
              v-if="services.length > 1"
              type="button"
              class="remove-btn"
              @click="removeService(index)"
            >
              Remove
            </button>
          </div>

          <div class="service-card-fields">
            <BaseInput
              v-model="svc.name"
              label="Service Name"
              placeholder="e.g. auth-service"
              required
              :error="servicesErrors[index]?.name"
              hint="Used for process identification and remote folder name"
            />
            <div class="field-with-action">
              <BaseInput
                v-model="svc.localJarPath"
                label="Local JAR Path"
                placeholder="/local/builds/app.jar"
                required
                read-only
                :error="servicesErrors[index]?.localJarPath"
                class="flex-1"
              />
              <BaseButton size="sm" class="action-btn" @click="pickJar(index)">Browse</BaseButton>
            </div>
            <BaseInput
              v-model="svc.startCommand"
              label="Start Command"
              placeholder="java -jar app.jar"
              hint="Command to start after extraction (empty = skip)"
            />
            <BaseInput
              v-model="svc.stopCommand"
              label="Stop Command"
              placeholder="(optional) e.g. systemctl stop auth-service"
              hint="Custom stop command; default uses pkill"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="form-actions">
      <div v-if="testStatus !== 'idle'" :class="['test-result', testStatus]" :title="testMessage">
        {{ testMessage }}
      </div>
      <div class="flex-spacer"></div>
      <BaseButton
        type="button"
        variant="secondary"
        size="sm"
        :loading="testStatus === 'loading'"
        @click="handleTestConnection"
      >
        Test Connection
      </BaseButton>
      <BaseButton variant="ghost" @click="emit('cancel')">Cancel</BaseButton>
      <BaseButton type="submit" variant="primary" :loading="props.loading">
        {{ props.submitLabel || 'Save Configuration' }}
      </BaseButton>
    </div>
  </form>
</template>

<style scoped>
.deployment-form {
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

/* ── Services Section ────────────────────────────────────── */

.services-section {
  border-top: 1px solid var(--color-surface-3);
  padding-top: 8px;
}

.services-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-surface-3);
}

.services-header .section-title {
  border-bottom: none;
  padding-bottom: 0;
}

.services-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.service-card {
  background-color: var(--color-surface-2);
  border: 1px solid var(--color-surface-3);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.service-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.service-index {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.remove-btn {
  background: none;
  border: none;
  color: var(--color-error);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 4px;
  transition: background-color 0.12s;
}

.remove-btn:hover {
  background-color: color-mix(in srgb, var(--color-error) 10%, transparent);
}

.service-card-fields {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (max-width: 900px) {
  .service-card-fields {
    grid-template-columns: 1fr;
  }
}

/* ── Form Actions ─────────────────────────────────────────── */

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

/* ── Custom Inputs ────────────────────────────────────────── */

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

.textarea {
  background-color: var(--color-surface-2);
  border: 1px solid var(--color-surface-3);
  border-radius: 6px;
  color: var(--color-text-primary);
  font-family: inherit;
  font-size: 13px;
  min-height: 80px;
  padding: 10px;
  outline: none;
  resize: vertical;
  transition: border-color 0.15s;
}

.textarea:focus {
  border-color: var(--color-primary-500);
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

.info-msg {
  font-size: 11px;
  color: var(--color-info);
  margin: 4px 0 0;
}
</style>
