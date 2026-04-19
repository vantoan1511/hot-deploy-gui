<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { ControlConnection } from '@/types/deployment'
import TagBadge from '@/components/ui/TagBadge.vue'
import BaseButton from '../ui/BaseButton.vue'

const props = defineProps<{
  control: ControlConnection
}>()

const emit = defineEmits<{
  clone: [id: string]
  delete: [id: string]
}>()

const router = useRouter()

function handleClick() {
  router.push(`/controls/${props.control.id}`)
}
</script>

<template>
  <div class="control-card" @click="handleClick">
    <div class="card-header">
      <div class="header-main">
        <h3 class="card-name">{{ control.name }}</h3>
        <div class="auth-badge" :class="control.authMethod">
          {{ control.authMethod === 'key' ? 'SSH Key' : 'Pass' }}
        </div>
      </div>
      
      <!-- Context Menu Placeholder -->
      <div class="menu-trigger" @click.stop>
        <button class="icon-btn">⋯</button>
      </div>
    </div>

    <div class="card-body">
      <div class="server-info">
        <span class="info-icon">🖥️</span>
        <span class="info-text">{{ control.host }}:{{ control.sshPort }}</span>
      </div>
      <div class="app-info">
        <span class="info-icon">📦</span>
        <span class="info-text">{{ control.applicationName }}</span>
      </div>
      <div class="path-info">
        <span class="info-icon">📁</span>
        <span class="info-text truncate">{{ control.rootDeploymentPath }}</span>
      </div>
    </div>

    <div v-if="control.tags.length" class="card-tags">
      <TagBadge v-for="tag in control.tags" :key="tag" :label="tag" />
    </div>

    <div class="card-actions">
      <BaseButton variant="secondary" size="sm" class="full-width" @click.stop="handleClick">
        Manage Server
      </BaseButton>
    </div>
  </div>
</template>

<style scoped>
.control-card {
  background-color: var(--color-surface-1);
  border: 1px solid var(--color-surface-3);
  border-radius: 10px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.control-card:hover {
  border-color: var(--color-primary-500);
  background-color: color-mix(in srgb, var(--color-surface-1), var(--color-surface-2));
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.auth-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}

.auth-badge.key {
  background-color: color-mix(in srgb, var(--color-info) 15%, transparent);
  color: var(--color-info);
  border: 1px solid color-mix(in srgb, var(--color-info) 30%, transparent);
}

.auth-badge.password {
  background-color: color-mix(in srgb, var(--color-warning) 15%, transparent);
  color: var(--color-warning);
  border: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent);
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.server-info, .app-info, .path-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.info-icon {
  font-size: 14px;
  width: 16px;
  text-align: center;
}

.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.full-width {
  width: 100%;
}

.icon-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  border-radius: 4px;
}

.icon-btn:hover {
  background-color: var(--color-surface-2);
  color: var(--color-text-primary);
}
</style>
