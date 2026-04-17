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

function hasWildcard(path: string): boolean {
  return path.includes('*') || path.includes('?')
}

export function useDeployRunner() {
  const sessionStore = useSessionStore()
  const deploymentsStore = useDeploymentsStore()
  const isDeploying = ref(false)

  /**
   * Resolve a wildcard deploy path on the remote host.
   * Returns the newest matching directory, or null if none found.
   * Uses `ls -dt` so the first result is the most recently modified match.
   */
  async function resolveDeployPath(deployment: Deployment): Promise<string | null> {
    const path = deployment.remoteDeployPath
    // List all matching entries sorted by mtime descending, take the first
    const result = await execSSH(deployment, `ls -1dt ${path} 2>/dev/null | head -1`)
    const resolved = result.output.split('\n')[0].trim().replace(/\/+$/, '')
    if (!resolved) return null
    // Verify it is actually a directory
    const check = await execSSH(deployment, `[ -d "${resolved}" ] && echo ok`)
    return check.output.includes('ok') ? resolved : null
  }

  /**
   * Build the effective deployment, overriding remoteDeployPath with
   * the session-resolved path if a wildcard was expanded in step 2.
   */
  function effectiveDeployment(deployment: Deployment): Deployment {
    const resolved = sessionStore.resolvedDeployPath
    if (!resolved) return deployment
    return { ...deployment, remoteDeployPath: resolved }
  }

  async function runStep(deployment: Deployment, stepIndex: number): Promise<boolean> {
    sessionStore.markStepRunning(stepIndex)

    let result = { output: '', exitCode: 1 }
    let status: StepStatus = 'error'

    try {
      if (stepIndex === 0) {
        // ── Step 1: Test Connection ───────────────────────────
        result = await execSSH(deployment, 'exit')
        status = result.exitCode === 0 ? 'success' : 'error'

      } else if (stepIndex === 1) {
        // ── Step 2: Validate Remote Path ──────────────────────
        const deployPath = deployment.remoteDeployPath

        if (hasWildcard(deployPath)) {
          const resolved = await resolveDeployPath(deployment)
          if (!resolved) {
            result = { output: `No directory matching "${deployPath}" found on the remote host.`, exitCode: 1 }
            status = 'error'
          } else {
            sessionStore.setResolvedDeployPath(resolved)
            result = { output: `Wildcard resolved → ${resolved}\nPath valid`, exitCode: 0 }
            status = 'success'
          }
        } else {
          result = await execSSH(deployment, `mkdir -p "${deployPath}" && [ -d "${deployPath}" ] && echo "Path valid"`)
          status = result.exitCode === 0 ? 'success' : 'error'
        }

      } else {
        // ── Steps 3–7: use resolved deploy path ───────────────
        const dep = effectiveDeployment(deployment)
        const svcPath = remoteServicePath(dep)
        const jarName = remoteJarFilename(dep)
        const logPath = remoteServiceLogPath(dep)

        switch (stepIndex) {
          case 2: // Upload Archive
            result = await execSCP(dep, dep.localJarPath, `${dep.remoteDeployPath}/`)
            status = result.exitCode === 0 ? 'success' : 'error'
            break

          case 3: // Extract Files
            result = await execSSH(dep,
              `mkdir -p "${svcPath}" && cd "${svcPath}" && jar xf "${dep.remoteDeployPath}/${jarName}"`)
            status = result.exitCode === 0 ? 'success' : 'error'
            break

          case 4: // Verify Running Instance
            result = await execSSH(dep, `pgrep -f "${svcPath}"`)
            status = result.exitCode === 0 ? 'success' : 'warning'
            if (status === 'warning') result.output = 'No existing process found.'
            break

          case 5: // Stop Existing Service
            result = await execSSH(dep, `pkill -f "${svcPath}" || echo "Nothing to kill"`)
            status = result.exitCode === 0 ? 'success' : 'warning'
            break

          case 6: // Launch Service
            if (!dep.startCommand) {
              result = { output: 'Error: No start command configured.', exitCode: 1 }
              status = 'error'
            } else {
              const cmd = `cd "${svcPath}" && nohup ${dep.startCommand} > "${logPath}" 2>&1 & sleep 1 && pgrep -f "${svcPath}"`
              result = await execSSH(dep, cmd)
              status = result.exitCode === 0 ? 'success' : 'error'
            }
            break
        }
      }
    } catch (err) {
      result = { output: String(err), exitCode: 1 }
      status = 'error'
    }

    sessionStore.appendStepOutput(stepIndex, result.output)
    sessionStore.finishStep(stepIndex, status, result.exitCode ?? 1)
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
