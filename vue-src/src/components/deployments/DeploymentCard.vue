<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ref } from 'vue'
import TagBadge from '@/components/ui/TagBadge.vue'
import type { Deployment } from '@/types/deployment'

const props = defineProps<{ deployment: Deployment }>()
const emit = defineEmits<{
  clone: [id: string]
  delete: [id: string]
}>()

const router = useRouter()
const menuOpen = ref(false)

function openDetail() {
  router.push(`/deployments/${props.deployment.id}`)
}

function deploy() {
  router.push(`/deployments/${props.deployment.id}/deploy`)
}

function toggleMenu(e: MouseEvent) {
  e.stopPropagation()
  menuOpen.value = !menuOpen.value
}

function closeMenu() {
  menuOpen.value = false
}
</script>

<template>
  <article
    class="card"
    tabindex="0"
    @click="openDetail"
    @keydown.enter="openDetail"
    @keydown.space.prevent="openDetail"
  >
    <!-- Header row -->
    <div class="card-header">
      <h3 class="card-name">{{ deployment.name }}</h3>
      <button class="card-menu-btn" :aria-label="`Options for ${deployment.name}`" @click="toggleMenu">
        <span>⋯</span>
      </button>

      <!-- Context menu -->
      <div v-if="menuOpen" v-click-outside="closeMenu" class="context-menu">
        <button class="ctx-item" @click.stop="emit('clone', deployment.id); closeMenu()">
          📋 Clone
        </button>
        <button class="ctx-item ctx-item--danger" @click.stop="emit('delete', deployment.id); closeMenu()">
          🗑 Delete
        </button>
      </div>
    </div>

    <!-- Host + path summary -->
    <p class="card-host">{{ deployment.username }}@{{ deployment.host }}:{{ deployment.sshPort }}</p>
    <p class="card-path">{{ deployment.remoteDeployPath }} · {{ deployment.services.length }} service{{ deployment.services.length !== 1 ? 's' : '' }}</p>

    <!-- Footer row -->
    <div class="card-footer">
      <span class="card-auth" :class="`card-auth--${deployment.authMethod}`">
        {{ deployment.authMethod === 'key' ? '🔑 Key' : '🔒 Password' }}
      </span>
      <div class="card-tags">
        <TagBadge v-for="tag in deployment.tags.slice(0, 3)" :key="tag" :label="tag" />
      </div>
      <button class="card-deploy-btn" @click.stop="deploy">Deploy →</button>
    </div>
  </article>
</template>

<style scoped>
.card {
  position: relative;
  background-color: var(--color-surface-1);
  border: 1px solid var(--color-surface-3);
  border-radius: 8px;
  padding: 14px 16px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.12s;
  outline: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card:hover {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary-500) 30%, transparent),
              0 4px 16px rgba(0, 0, 0, 0.3);
  transform: translateY(-1px);
}

.card:focus-visible {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 2px var(--color-primary-500);
}

/* ── Header ─────────────────────────────────────────────────── */
.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.card-name {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.3;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-menu-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
  border-radius: 4px;
  transition: background-color 0.12s, color 0.12s;
  flex-shrink: 0;
  line-height: 1;
}

.card-menu-btn:hover {
  background-color: var(--color-surface-2);
  color: var(--color-text-primary);
}

/* ── Context Menu ────────────────────────────────────────────── */
.context-menu {
  position: absolute;
  top: 36px;
  right: 12px;
  background-color: var(--color-surface-2);
  border: 1px solid var(--color-surface-3);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 100;
  min-width: 130px;
  overflow: hidden;
  animation: pop-in 0.12s ease;
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  font-size: 13px;
  color: var(--color-text-primary);
  cursor: pointer;
  text-align: left;
  transition: background-color 0.1s;
}

.ctx-item:hover {
  background-color: var(--color-surface-3);
}

.ctx-item--danger {
  color: var(--color-error);
}

/* ── Meta ────────────────────────────────────────────────────── */
.card-host {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-secondary);
  font-family: 'Roboto Mono', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-path {
  margin: 0;
  font-size: 11px;
  color: var(--color-text-muted);
  font-family: 'Roboto Mono', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Footer ─────────────────────────────────────────────────── */
.card-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.card-auth {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 500;
}

.card-auth--key {
  background-color: color-mix(in srgb, var(--color-info) 12%, transparent);
  color: var(--color-info);
}

.card-auth--password {
  background-color: color-mix(in srgb, var(--color-warning) 12%, transparent);
  color: var(--color-warning);
}

.card-tags {
  display: flex;
  gap: 4px;
  flex: 1;
  flex-wrap: wrap;
}

.card-deploy-btn {
  background: none;
  border: none;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary-500);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background-color 0.12s;
  flex-shrink: 0;
}

.card-deploy-btn:hover {
  background-color: color-mix(in srgb, var(--color-primary-500) 12%, transparent);
}

@keyframes pop-in {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}
</style>
