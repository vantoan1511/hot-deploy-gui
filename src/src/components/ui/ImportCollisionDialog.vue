<script setup lang="ts">
import { reactive, computed } from 'vue'
import type { Deployment } from '@/types/deployment'
import type { CollisionAction, CollisionDecision } from '@/stores/deployments'
import BaseButton from './BaseButton.vue'

const props = defineProps<{
  conflicts: Array<{ incoming: Deployment; existing: Deployment }>
}>()

const emit = defineEmits<{
  confirm: [decisions: CollisionDecision[]]
  cancel: []
}>()

const actions = reactive<Record<string, CollisionAction>>(
  Object.fromEntries(props.conflicts.map(c => [c.incoming.id, 'skip' as CollisionAction]))
)

function setAll(action: CollisionAction) {
  for (const c of props.conflicts) {
    actions[c.incoming.id] = action
  }
}

const decisions = computed<CollisionDecision[]>(() =>
  Object.entries(actions).map(([id, action]) => ({ id, action }))
)

const importCount = computed(() =>
  decisions.value.filter(d => d.action !== 'skip').length
)

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <Teleport to="body">
    <div class="backdrop" @click.self="emit('cancel')">
      <div class="dialog" role="dialog" aria-label="Import Conflicts">

        <div class="dialog-header">
          <h2 class="dialog-title">Import Conflicts</h2>
          <p class="dialog-sub">
            {{ conflicts.length }} deployment{{ conflicts.length !== 1 ? 's' : '' }}
            share IDs with existing entries. Choose an action for each.
          </p>
        </div>

        <div class="bulk-row">
          <span class="bulk-label">Apply to all:</span>
          <button class="bulk-btn" @click="setAll('replace')">Replace</button>
          <button class="bulk-btn" @click="setAll('keep-both')">Keep Both</button>
          <button class="bulk-btn" @click="setAll('skip')">Skip</button>
        </div>

        <div class="conflict-list">
          <div v-for="c in conflicts" :key="c.incoming.id" class="conflict-row">
            <div class="conflict-info">
              <span class="conflict-name">{{ c.incoming.name }}</span>
              <span class="conflict-meta">
                {{ c.incoming.username }}@{{ c.incoming.host }}
                &nbsp;·&nbsp;Existing: {{ fmtDate(c.existing.updatedAt) }}
                &nbsp;·&nbsp;Incoming: {{ fmtDate(c.incoming.updatedAt) }}
              </span>
            </div>
            <div class="choices">
              <label
                v-for="opt in (['replace', 'keep-both', 'skip'] as CollisionAction[])"
                :key="opt"
                class="choice"
                :class="{ active: actions[c.incoming.id] === opt }"
              >
                <input
                  type="radio"
                  :name="`action-${c.incoming.id}`"
                  :value="opt"
                  v-model="actions[c.incoming.id]"
                />
                {{ opt === 'keep-both' ? 'Keep Both' : opt.charAt(0).toUpperCase() + opt.slice(1) }}
              </label>
            </div>
          </div>
        </div>

        <div class="dialog-footer">
          <BaseButton variant="ghost" @click="emit('cancel')">Cancel</BaseButton>
          <BaseButton variant="primary" @click="emit('confirm', decisions)">
            Import{{ importCount > 0 ? ` (${importCount})` : '' }}
          </BaseButton>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
  animation: fade-in 0.15s ease;
}

.dialog {
  background-color: var(--color-surface-1);
  border: 1px solid var(--color-surface-3);
  border-radius: 10px;
  width: 100%;
  max-width: 560px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: slide-up 0.18s ease;
}

/* ── Header ─────────────────────────────────────────────── */
.dialog-header {
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--color-surface-3);
}

.dialog-title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.dialog-sub {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

/* ── Bulk actions ───────────────────────────────────────── */
.bulk-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 24px;
  border-bottom: 1px solid var(--color-surface-3);
  background-color: var(--color-surface-2);
}

.bulk-label {
  font-size: 11px;
  color: var(--color-text-muted);
  font-weight: 500;
  margin-right: 2px;
}

.bulk-btn {
  background: none;
  border: 1px solid var(--color-surface-3);
  border-radius: 4px;
  color: var(--color-text-secondary);
  font-size: 11px;
  padding: 3px 8px;
  cursor: pointer;
  transition: all 0.12s;
}

.bulk-btn:hover {
  border-color: var(--color-primary-500);
  color: var(--color-primary-500);
}

/* ── Conflict list ──────────────────────────────────────── */
.conflict-list {
  overflow-y: auto;
  flex: 1;
  padding: 8px 0;
}

.conflict-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--color-surface-2);
}

.conflict-row:last-child {
  border-bottom: none;
}

.conflict-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.conflict-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.conflict-meta {
  font-size: 11px;
  color: var(--color-text-muted);
}

.choices {
  display: flex;
  gap: 6px;
}

.choice {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: 1px solid var(--color-surface-3);
  border-radius: 5px;
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.12s;
  user-select: none;
}

.choice input[type="radio"] {
  display: none;
}

.choice:hover {
  border-color: var(--color-primary-500);
  color: var(--color-text-primary);
}

.choice.active {
  border-color: var(--color-primary-500);
  background-color: color-mix(in srgb, var(--color-primary-500) 15%, transparent);
  color: var(--color-primary-50);
}

/* ── Footer ─────────────────────────────────────────────── */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid var(--color-surface-3);
}

@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes slide-up {
  from { transform: translateY(8px); opacity: 0; }
  to   { transform: translateY(0);   opacity: 1; }
}
</style>
