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

  const sessionStatus = computed(() => {
    if (!session.value) return 'idle'
    if (session.value.isRunning) return 'running'
    const anyError = session.value.steps.some(s => s.status === 'error')
    const allDone = session.value.steps.every(s => s.status !== 'idle' && s.status !== 'running')
    if (anyError) return 'failed'
    if (allDone) return 'completed'
    return 'idle'
  })

  const fullLog = computed(() => {
    if (!session.value) return ''
    return session.value.steps
      .map(s => {
        if (s.status === 'idle') return ''
        const header = `\n--- STEP ${s.stepIndex + 1}: ${s.output ? '' : '(Pending output...)'}\n`
        return header + (s.output || '')
      })
      .filter(l => l.length > 0)
      .join('\n')
  })

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
  const resolvedDeployPath = computed(() => session.value?.resolvedDeployPath ?? null)

  function setResolvedDeployPath(path: string): void {
    if (!session.value) return
    session.value.resolvedDeployPath = path
  }

  function startSession(deploymentId: string): void {
    session.value = {
      deploymentId,
      startedAt: Date.now(),
      steps: createInitialSteps(),
      isRunning: false,
      currentStepIndex: -1,
      resolvedDeployPath: null,
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
    sessionStatus,
    fullLog,
    stepResult,
    canStartStep,
    resolvedDeployPath,
    setResolvedDeployPath,
    startSession,
    markStepRunning,
    appendStepOutput,
    finishStep,
    resetSession,
  }
})
