import { ref } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useDeploymentsStore } from '@/stores/deployments'
import { execSSH, execSCP } from './useSSH'
import { remoteServicePath, remoteJarFilename, remoteServiceLogPath } from '@/utils/pathUtils'
import type { Deployment } from '@/types/deployment'
import type { StepStatus } from '@/types/deployment'

const STEP_NAMES = [
  'Test Connection',
  'Validate Remote Path',
  'Upload Archive',
  'Extract Files',
  'Verify Running Instance',
  'Stop Existing Service',
  'Launch Service',
]

export function useDeployRunner() {
  const sessionStore = useSessionStore()
  const deploymentsStore = useDeploymentsStore()
  const isDeploying = ref(false)

  /**
   * Run a single step by index. 
   */
  async function runStep(deployment: Deployment, stepIndex: number): Promise<boolean> {
    sessionStore.markStepRunning(stepIndex)

    let result = { output: '', exitCode: 1 }
    let status: StepStatus = 'error'

    const svcPath = remoteServicePath(deployment)
    const jarName = remoteJarFilename(deployment)
    const logPath = remoteServiceLogPath(deployment)

    try {
      switch (stepIndex) {
        case 0: // Test Connection
          result = await execSSH(deployment, 'exit')
          status = result.exitCode === 0 ? 'success' : 'error'
          break

        case 1: // Validate Remote Path
          result = await execSSH(deployment, `mkdir -p "${deployment.remoteDeployPath}" && [ -d "${deployment.remoteDeployPath}" ] && echo "Path valid"`)
          status = result.exitCode === 0 ? 'success' : 'error'
          break

        case 2: // Upload Archive
          result = await execSCP(deployment, deployment.localJarPath, `${deployment.remoteDeployPath}/`)
          status = result.exitCode === 0 ? 'success' : 'error'
          break

        case 3: // Extract Files
          result = await execSSH(
            deployment,
            `mkdir -p "${svcPath}" && cd "${svcPath}" && jar xf "${deployment.remoteDeployPath}/${jarName}"`
          )
          status = result.exitCode === 0 ? 'success' : 'error'
          break

        case 4: // Verify Running Instance
          result = await execSSH(deployment, `pgrep -f "${svcPath}"`)
          // Warning if not running (not an error, just means nothing to kill)
          status = result.exitCode === 0 ? 'success' : 'warning'
          if (status === 'warning') result.output = 'No existing process found.'
          break

        case 5: // Stop Existing Service
          result = await execSSH(deployment, `pkill -f "${svcPath}" || echo "Nothing to kill"`)
          status = result.exitCode === 0 ? 'success' : 'warning'
          break

        case 6: // Launch Service
          if (!deployment.startCommand) {
            result = { output: 'Error: No start command configured.', exitCode: 1 }
            status = 'error'
          } else {
            // Background the command and redirect logs
            const cmd = `cd "${svcPath}" && nohup ${deployment.startCommand} > "${logPath}" 2>&1 & sleep 1 && pgrep -f "${svcPath}"`
            result = await execSSH(deployment, cmd)
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
