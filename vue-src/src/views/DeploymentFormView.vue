<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDeploymentsStore } from '@/stores/deployments'
import DeploymentForm from '@/components/deployments/DeploymentForm.vue'

const route = useRoute()
const router = useRouter()
const store = useDeploymentsStore()

const id = route.params.id as string
const isEditMode = !!id

const deployment = computed(() => isEditMode ? store.getById(id) : undefined)

onMounted(async () => {
  if (store.deployments.length === 0) {
    await store.load()
  }
  
  if (isEditMode && !deployment.value) {
    // If we're in edit mode but the ID is invalid, go back home
    router.replace('/')
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
  try {
    if (isEditMode) {
      await store.update(id, formData)
      router.push(`/deployments/${id}`)
    } else {
      const newDeployment = await store.create(formData)
      router.push(`/deployments/${newDeployment.id}`)
    }
  } catch (err) {
    console.error('Failed to save deployment:', err)
    // In a real app, we'd show a toast here
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

    <div class="form-container">
      <DeploymentForm
        :initial-data="deployment"
        :submit-label="isEditMode ? 'Save Changes' : 'Create Deployment'"
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

.form-container {
  background-color: var(--color-surface-1);
  border: 1px solid var(--color-surface-3);
  border-radius: 12px;
  padding: 32px;
}
</style>
