import { ref } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useDeploymentsStore } from '@/stores/deployments'
import { execSSH, execSCP } from './useSSH'
import { remoteServicePath, remoteJarFilename, remoteServiceLogPath } from '@/utils/pathUtils'
import type { Deployment } from '@/types/deployment'
import type { StepStatus } from '@/types/deployment'

// Step definitions (index = step number - 1)
const STEP_NAMES = [
  'Test Connection',
  'Validate Remote Path',
  'Copy JAR',
  'Extract JAR',
  'Find Running PID',
  'Kill Service',
  'Start Service',
]

export function useDeployRunner() {
  const sessionStore = useSessionStore()
  const deploymentsStore = useDeploymentsStore()
  const isDeploying = ref(false)

  /**
   * Run a single step by index. Returns true on success/warning, false on error.
   */
  async function runStep(deployment: Deployment, stepIndex: number): Promise<boolean> {
    sessionStore.markStepRunning(stepIndex)

    let result = { output: '', exitCode: 1 }
    let status: StepStatus = 'error'

    const svcPath = remoteServicePath(deployment)
    const jarName = remoteJarFilename(deployment)

    try {
      switch (stepIndex) {
        case 0: // Test Connection
          result = await execSSH(deployment, 'echo ok')
          status = result.exitCode === 0 && result.output.includes('ok') ? 'success' : 'error'
          break

        case 1: // Validate Remote Path
          result = await execSSH(deployment, `test -d "${deployment.remoteDeployPath}" && echo ok`)
          status = result.exitCode === 0 && result.output.includes('ok') ? 'success' : 'error'
          break

        case 2: // Copy JAR
          result = await execSCP(deployment, deployment.localJarPath, `${deployment.remoteDeployPath}/`)
          status = result.exitCode === 0 ? 'success' : 'error'
          break

        case 3: // Extract JAR
          result = await execSSH(
            deployment,
            `mkdir -p "${svcPath}" && cd "${svcPath}" && jar xf "${deployment.remoteDeployPath}/${jarName}"`
          )
          status = result.exitCode === 0 ? 'success' : 'error'
          break

        case 4: // Find Running PID (informational — not a hard failure)
          result = await execSSH(deployment, `pgrep -f "${svcPath}"`)
          status = result.exitCode === 0 ? 'success' : 'warning'
          break

        case 5: // Kill Service (exit code 1 = no process = non-fatal warning)
          result = await execSSH(deployment, `pkill -f "${svcPath}"`)
          status = result.exitCode === 0 ? 'success' : 'warning'
          break

        case 6: // Start Service
          if (!deployment.startCommand) {
            result = { output: 'No start command configured — skipped.', exitCode: 0 }
            status = 'warning'
          } else {
            result = await execSSH(deployment, `nohup ${deployment.startCommand} &`)
            status = result.exitCode === 0 ? 'success' : 'error'
          }
          break
      }
    } catch (err) {
      result = { output: String(err), exitCode: 1 }
      status = 'error'
    }

    sessionStore.appendStepOutput(stepIndex, result.output)
    sessionStore.finishStep(stepIndex, status, result.exitCode)
    return status !== 'error'
  }

  /**
   * Run all 7 steps in sequence. Halts on error.
   */
  async function deployAll(deploymentId: string): Promise<void> {
    const deployment = await deploymentsStore.getPlaintextDeployment(deploymentId)
    if (!deployment) throw new Error(`Deployment ${deploymentId} not found`)

    isDeploying.value = true
    sessionStore.startSession(deploymentId)

    try {
      for (let i = 0; i < STEP_NAMES.length; i++) {
        const ok = await runStep(deployment, i)
        if (!ok) break
      }
    } finally {
      isDeploying.value = false
    }
  }

  /**
   * Run a single step manually (step-by-step mode).
   */
  async function runSingleStep(deploymentId: string, stepIndex: number): Promise<void> {
    const deployment = await deploymentsStore.getPlaintextDeployment(deploymentId)
    if (!deployment) throw new Error(`Deployment ${deploymentId} not found`)
    await runStep(deployment, stepIndex)
  }

  return {
    isDeploying,
    stepNames: STEP_NAMES,
    deployAll,
    runSingleStep,
  }
}
