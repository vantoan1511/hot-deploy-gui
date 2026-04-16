<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue?: string
  label?: string
  placeholder?: string
  type?: string
  error?: string
  hint?: string
  disabled?: boolean
  required?: boolean
  id?: string
}>(), {
  type: 'text',
  disabled: false,
  required: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="input-field">
    <label v-if="props.label" :for="props.id" class="input-label">
      {{ props.label }}
      <span v-if="props.required" class="input-required" aria-hidden="true">*</span>
    </label>

    <input
      :id="props.id"
      :type="props.type"
      :value="props.modelValue"
      :placeholder="props.placeholder"
      :disabled="props.disabled"
      :required="props.required"
      :class="['input', { 'input--error': !!props.error }]"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />

    <p v-if="props.error" class="input-error-msg" role="alert">{{ props.error }}</p>
    <p v-else-if="props.hint" class="input-hint">{{ props.hint }}</p>
  </div>
</template>

<style scoped>
.input-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.input-required {
  color: var(--color-error);
  margin-left: 2px;
}

.input {
  background-color: var(--color-surface-2);
  border: 1px solid var(--color-surface-3);
  border-radius: 6px;
  color: var(--color-text-primary);
  font-family: inherit;
  font-size: 13px;
  height: 34px;
  padding: 0 10px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  width: 100%;
}

.input::placeholder {
  color: var(--color-text-muted);
}

.input:focus {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary-500) 20%, transparent);
}

.input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input--error {
  border-color: var(--color-error);
}

.input--error:focus {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-error) 20%, transparent);
}

.input-error-msg {
  font-size: 11px;
  color: var(--color-error);
  margin: 0;
}

.input-hint {
  font-size: 11px;
  color: var(--color-text-muted);
  margin: 0;
}
</style>
