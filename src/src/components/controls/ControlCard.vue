<script setup lang="ts">
import TagBadge from '@/components/ui/TagBadge.vue'
import type { ControlConnection } from '@/types/deployment'
import { useConfirm } from "primevue/useconfirm"
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../ui/BaseButton.vue'

const props = defineProps<{
  control: ControlConnection
}>()

const emit = defineEmits<{
  clone: [id: string]
  delete: [id: string]
}>()

const router = useRouter()
const menuOpen = ref(false)

const confirm = useConfirm();

function handleClick() {
  router.push(`/controls/${props.control.id}`)
}

function toggleMenu(e: MouseEvent) {
  e.stopPropagation()
  menuOpen.value = !menuOpen.value
}

function closeMenu() {
  menuOpen.value = false
}

function handleClone(e: Event) {
  e.stopPropagation()
  emit('clone', props.control.id)
  closeMenu()
}

function handleDelete(e: Event) {
  e.stopPropagation()
  confirm.require({
    message: 'Are you sure you want to delete this control?',
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    accept: () => {
      emit('delete', props.control.id)
    },
    reject: () => {
      // Do nothing
    }
  });
  closeMenu()
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

      <!-- Context Actions -->
      <div class="card-menu-box">
        <button class="icon-btn" title="More Actions" @click="toggleMenu">⋯</button>
        <div v-if="menuOpen" v-click-outside="closeMenu" class="card-dropdown">
          <button class="dropdown-item" @click="handleClone">
            <span class="icon">📋</span> Clone
          </button>
          <div class="divider"></div>
          <button class="dropdown-item delete" @click="handleDelete">
            <span class="icon">🗑️</span> Delete
          </button>
        </div>
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

.server-info,
.app-info,
.path-info {
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
  transition: background-color 0.12s;
}

.icon-btn:hover {
  background-color: var(--color-surface-2);
  color: var(--color-text-primary);
}

/* ── Dropdown ────────────────────────────────────────────── */

.card-menu-box {
  position: relative;
}

.card-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background-color: var(--color-surface-2);
  border: 1px solid var(--color-surface-3);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  z-index: 10;
  min-width: 140px;
  animation: pop-in 0.12s ease;
}

@keyframes pop-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

.dropdown-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.1s;
  text-align: left;
}

.dropdown-item:hover {
  background-color: var(--color-surface-3);
  color: var(--color-text-primary);
}

.dropdown-item.delete:hover {
  color: var(--color-error);
  background-color: color-mix(in srgb, var(--color-error) 10%, transparent);
}

.dropdown-item .icon {
  font-size: 14px;
}

.divider {
  height: 1px;
  background-color: var(--color-surface-3);
  margin: 4px 0;
}
</style>
