import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DeploySession, StepResult, StepStatus, Service } from '@/types/deployment'

export const GLOBAL_STEPS = 2
export const SERVICE_STEPS = 6

function totalSteps(servicesCount: number): number {
  return GLOBAL_STEPS + servicesCount * SERVICE_STEPS
}

function createInitialSteps(count: number): StepResult[] {
  return Array.from({ length: count }, (_, i): StepResult => ({
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
    return session.value.steps.slice(0, index).every(
      s => s.status === 'success' || s.status === 'warning' || s.status === 'skipped'
    )
  })

  // ── Resolved path accessors ──────────────────────────────
  const resolvedDeployPath = computed(() => session.value?.resolvedDeployPath ?? null)
  const resolvedSvcPaths = computed(() => session.value?.resolvedSvcPaths ?? {})

  function setResolvedDeployPath(path: string): void {
    if (!session.value) return
    session.value.resolvedDeployPath = path
  }

  function setResolvedSvcPath(serviceId: string, path: string): void {
    if (!session.value) return
    session.value.resolvedSvcPaths[serviceId] = path
  }

  // ── Actions ──────────────────────────────────────────────
  function startSession(deploymentId: string, services: Service[]): void {
    session.value = {
      deploymentId,
      startedAt: Date.now(),
      steps: createInitialSteps(totalSteps(services.length)),
      isRunning: false,
      currentStepIndex: -1,
      resolvedDeployPath: null,
      resolvedSvcPaths: {},
      services,
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
    resolvedSvcPaths,
    setResolvedDeployPath,
    setResolvedSvcPath,
    startSession,
    markStepRunning,
    appendStepOutput,
    finishStep,
    resetSession,
  }
})
