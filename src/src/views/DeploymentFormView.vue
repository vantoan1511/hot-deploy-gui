<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDeploymentsStore } from '@/stores/deployments'
import type { Deployment } from '@/types/deployment'
import DeploymentForm from '@/components/deployments/DeploymentForm.vue'

const route = useRoute()
const router = useRouter()
const store = useDeploymentsStore()

const id = route.params.id as string
const isEditMode = !!id

// Plaintext deployment for edit mode — populated after load so password is decrypted
const deployment = ref<Deployment | undefined>(undefined)
const isSaving = ref(false)
const feedback = ref<{ type: 'success' | 'error'; message: string } | null>(null)
let feedbackTimer: any = null

function showFeedback(type: 'success' | 'error', message: string) {
  if (feedbackTimer) clearTimeout(feedbackTimer)
  feedback.value = { type, message }
  feedbackTimer = setTimeout(() => { feedback.value = null }, 3000)
}

onMounted(async () => {
  if (store.deployments.length === 0) {
    await store.load()
  }

  if (isEditMode) {
    const plain = await store.getPlaintextDeployment(id)
    if (!plain) {
      router.replace('/')
      return
    }
    deployment.value = plain
  }
})

async function handleCancel() {
  if (isEditMode) {
    router.push(`/deployments/${id}`)
  } else {
    router.push('/')
  }
}

async function handleSubmit(formData: any) {
  isSaving.value = true
  try {
    if (isEditMode) {
      await store.update(id, formData)
      showFeedback('success', 'Changes saved successfully!')
      setTimeout(() => {
        router.push(`/deployments/${id}`)
      }, 400)
    } else {
      const newDeployment = await store.create(formData)
      showFeedback('success', 'Deployment created successfully!')
      setTimeout(() => {
        router.push(`/deployments/${newDeployment.id}`)
      }, 400)
    }
  } catch (err: any) {
    console.error('Failed to save deployment:', err)
    showFeedback('error', `Failed to save: ${err.message || err}`)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="view-page">
    <div class="view-header">
      <h1 class="page-title">{{ isEditMode ? 'Edit Deployment' : 'New Deployment' }}</h1>
      <p class="page-sub">
        {{ isEditMode ? `Updating ${deployment?.name}` : 'Configure a new remote deployment target' }}
      </p>
    </div>

    <div v-if="feedback" class="feedback-banner" :class="feedback.type">
      {{ feedback.message }}
    </div>

    <div class="form-container">
      <DeploymentForm
        v-if="!isEditMode || deployment"
        :initial-data="deployment"
        :submit-label="isEditMode ? 'Save Changes' : 'Create Deployment'"
        :loading="isSaving"
        @submit="handleSubmit"
        @cancel="handleCancel"
      />
    </div>
  </div>
</template>

<style scoped>
.view-page {
  padding: 28px 32px;
  max-width: 1100px;
  margin: 0 auto;
}

.view-header {
  margin-bottom: 32px;
}

.page-title {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.page-sub {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-muted);
}

.feedback-banner {
  padding: 10px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 13px;
  font-weight: 500;
  animation: slide-down 0.2s ease;
}

.feedback-banner.success {
  background-color: color-mix(in srgb, var(--color-success) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent);
  color: var(--color-success);
}

.feedback-banner.error {
  background-color: color-mix(in srgb, var(--color-error) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-error) 30%, transparent);
  color: var(--color-error);
}

@keyframes slide-down {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.form-container {
  background-color: var(--color-surface-1);
  border: 1px solid var(--color-surface-3);
  border-radius: 12px;
  padding: 32px;
}
</style>
