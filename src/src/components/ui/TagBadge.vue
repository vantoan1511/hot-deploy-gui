<script setup lang="ts">
const props = defineProps<{
  label?: string
}>()

// Color variants cycle deterministically based on label content
function tagColor(label: string): string {
  const palette = [
    '#6366f1', '#22c55e', '#f59e0b', '#38bdf8', '#ec4899', '#a78bfa',
  ]
  let hash = 0
  for (let i = 0; i < label.length; i++) hash = label.charCodeAt(i) + ((hash << 5) - hash)
  return palette[Math.abs(hash) % palette.length] ?? '#6366f1'
}

const color = props.label ? tagColor(props.label) : '#6366f1'
</script>

<template>
  <span class="tag-badge" :style="{ '--tag-color': color }">
    <slot>{{ props.label }}</slot>
  </span>
</template>

<style scoped>
.tag-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  background-color: color-mix(in srgb, var(--tag-color) 15%, transparent);
  color: var(--tag-color);
  border: 1px solid color-mix(in srgb, var(--tag-color) 30%, transparent);
  white-space: nowrap;
}
</style>
