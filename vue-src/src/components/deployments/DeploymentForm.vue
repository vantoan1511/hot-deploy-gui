<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { z } from 'zod'
import { useOpenDialog } from '@/composables/useFileDialog'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import type { Deployment, AuthMethod } from '@/types/deployment'

const props = defineProps<{
  initialData?: Deployment
  submitLabel?: string
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [data: Omit<Deployment, 'id' | 'createdAt' | 'updatedAt'>]
  cancel: []
}>()

// ── Form State ──────────────────────────────────────────────

const form = ref({
  name: '',
  host: '',
  username: '',
  authMethod: 'key' as AuthMethod,
  privateKeyPath: '',
  password: '',
  sshPort: '22',
  localJarPath: '',
  remoteDeployPath: '',
  remoteLogPath: '',
  serviceName: '',
  startCommand: '',
  tagsString: '',
  description: '',
})

const errors = ref<Record<string, string>>({})

// ── Validation Schema ────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  host: z.string().min(1, 'Host is required'),
  username: z.string().min(1, 'Username is required'),
  authMethod: z.enum(['key', 'password']),
  sshPort: z.number().int().min(1).max(65535),
  localJarPath: z.string().min(1, 'Local JAR path is required'),
  remoteDeployPath: z.string().min(1, 'Remote deploy path is required'),
  remoteLogPath: z.string().min(1, 'Remote log path is required'),
  serviceName: z.string().min(1, 'Service name is required'),
  startCommand: z.string(),
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
      localJarPath: d.localJarPath,
      remoteDeployPath: d.remoteDeployPath,
      remoteLogPath: d.remoteLogPath,
      serviceName: d.serviceName,
      startCommand: d.startCommand,
      tagsString: d.tags.join(', '),
      description: d.description || '',
    }
  }
})

// ── Actions ──────────────────────────────────────────────────

async function pickPrivateKey() {
  const path = await useOpenDialog({
    title: 'Select SSH Private Key',
  })
  if (path) form.value.privateKeyPath = path
}

async function pickJar() {
  const path = await useOpenDialog({
    title: 'Select JAR File',
    filters: [{ name: 'JAR Files', extensions: ['jar'] }]
  })
  if (path) form.value.localJarPath = path
}

function handleSubmit() {
  errors.value = {}
  
  const result = schema.safeParse({
    ...form.value,
    sshPort: Number(form.value.sshPort)
  })

  if (!result.success) {
    result.error.issues.forEach((issue) => {
      const path = issue.path[0]
      if (typeof path === 'string') {
        errors.value[path] = issue.message
      }
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
    description: form.value.description
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

      <!-- Section: Application -->
      <div class="form-section">
        <h3 class="section-title">Application Details</h3>
        <div class="section-content">
          <div class="field-with-action">
            <BaseInput
              v-model="form.localJarPath"
              label="Local JAR Path"
              placeholder="/local/builds/app.jar"
              required
              read-only
              :error="errors.localJarPath"
              class="flex-1"
            />
            <BaseButton size="sm" class="action-btn" @click="pickJar">Browse</BaseButton>
          </div>
          <BaseInput
            v-model="form.serviceName"
            label="Service Name"
            placeholder="e.g. auth-service"
            required
            :error="errors.serviceName"
            hint="Used for process identification and remote folder name"
          />
        </div>
      </div>

      <!-- Section: Remote Paths -->
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
          <BaseInput
            v-model="form.startCommand"
            label="Start Command"
            placeholder="java -jar app.jar"
            :error="errors.startCommand"
            hint="Command to start the service after extraction"
          />
        </div>
      </div>
    </div>

    <div class="form-actions">
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

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 24px;
  border-top: 1px solid var(--color-surface-3);
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
</style>
