import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DeploySession, StepResult, StepStatus } from '@/types/deployment'

const TOTAL_STEPS = 7

function createInitialSteps(): StepResult[] {
  return Array.from({ length: TOTAL_STEPS }, (_, i): StepResult => ({
    stepIndex: i,
    status: 'idle' as StepStatus,
    startedAt: null,
    finishedAt: null,
    output: '',
    exitCode: null,
  }))
}

export const useSessionStore = defineStore('session', () => {
  // ── State ────────────────────────────────────────────────
  const session = ref<DeploySession | null>(null)

  // ── Getters ──────────────────────────────────────────────
  const isRunning = computed(() => session.value?.isRunning ?? false)
  const currentStepIndex = computed(() => session.value?.currentStepIndex ?? -1)
  const steps = computed(() => session.value?.steps ?? [])

  function stepResult(index: number): StepResult | undefined {
    return session.value?.steps[index]
  }

  const canStartStep = (index: number) => computed(() => {
    if (!session.value) return false
    if (isRunning.value) return false
    // All steps before must be success (or warning for steps 5-6)
    return session.value.steps.slice(0, index).every(
      s => s.status === 'success' || s.status === 'warning'
    )
  })

  // ── Actions ──────────────────────────────────────────────
  function startSession(deploymentId: string): void {
    session.value = {
      deploymentId,
      startedAt: Date.now(),
      steps: createInitialSteps(),
      isRunning: false,
      currentStepIndex: -1,
    }
  }

  function markStepRunning(index: number): void {
    if (!session.value) return
    const step = session.value.steps[index]
    if (!step) return
    session.value.steps[index] = {
      stepIndex: step.stepIndex,
      status: 'running',
      startedAt: Date.now(),
      finishedAt: null,
      output: '',
      exitCode: null,
    }
    session.value.currentStepIndex = index
    session.value.isRunning = true
  }

  function appendStepOutput(index: number, chunk: string): void {
    if (!session.value) return
    const step = session.value.steps[index]
    if (!step) return
    step.output += chunk
  }

  function finishStep(index: number, status: StepStatus, exitCode: number): void {
    if (!session.value) return
    const step = session.value.steps[index]
    if (!step) return
    step.status = status
    step.finishedAt = Date.now()
    step.exitCode = exitCode
    session.value.isRunning = false
  }

  function resetSession(): void {
    session.value = null
  }

  return {
    session,
    isRunning,
    currentStepIndex,
    steps,
    stepResult,
    canStartStep,
    startSession,
    markStepRunning,
    appendStepOutput,
    finishStep,
    resetSession,
  }
})
