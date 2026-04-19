<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useControlsStore } from '@/stores/controls'
import type { ControlConnection } from '@/types/deployment'
import ControlForm from '@/components/controls/ControlForm.vue'

const route = useRoute()
const router = useRouter()
const store = useControlsStore()

const id = route.params.id as string
const isEditMode = !!id

const control = ref<ControlConnection | undefined>(undefined)

onMounted(async () => {
  if (store.controls.length === 0) {
    await store.load()
  }

  if (isEditMode) {
    const plain = await store.getPlaintextControl(id)
    if (!plain) {
      router.replace('/controls')
      return
    }
    control.value = plain
  }
})

function handleCancel() {
  if (isEditMode) {
    router.push(`/controls/${id}`)
  } else {
    router.push('/controls')
  }
}

async function handleSubmit(formData: any) {
  try {
    if (isEditMode) {
      await store.update(id, formData)
      router.push(`/controls/${id}`)
    } else {
      const newControl = await store.create(formData)
      router.push(`/controls/${newControl.id}`)
    }
  } catch (err) {
    console.error('Failed to save control:', err)
  }
}
</script>

<template>
  <div class="view-page">
    <div class="view-header">
      <h1 class="page-title">{{ isEditMode ? 'Edit Control' : 'New Server Control' }}</h1>
      <p class="page-sub">
        {{ isEditMode ? `Updating ${control?.name}` : 'Configure a new remote server for management' }}
      </p>
    </div>

    <div class="form-container">
      <ControlForm
        v-if="!isEditMode || control"
        :initial-data="control"
        :submit-label="isEditMode ? 'Save Changes' : 'Create Control'"
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
