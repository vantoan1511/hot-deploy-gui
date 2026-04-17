import { ref } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useDeploymentsStore } from '@/stores/deployments'
import { execSSH, execSCP } from './useSSH'
import { remoteJarFilename, remoteServiceLogPath } from '@/utils/pathUtils'
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
   * Resolve a glob pattern to the newest matching directory on the remote host.
   * Uses `find -name` so the glob is handled by find internally — no shell
   * expansion needed, which avoids issues with wrapRemoteCmd's sh-via-pipe context.
   * When multiple directories match, returns the most recently modified one.
   */
  async function resolveRemoteDir(deployment: Deployment, pattern: string): Promise<string | null> {
    const lastSlash = pattern.lastIndexOf('/')
    const parent = pattern.substring(0, lastSlash)
    const nameGlob = pattern.substring(lastSlash + 1)

    const found = await execSSH(deployment,
      `find "${parent}" -maxdepth 1 -name "${nameGlob}" -type d 2>/dev/null`)
    const dirs = found.output.split('\n').map(l => l.trim().replace(/\/+$/, '')).filter(Boolean)
    if (dirs.length === 0) return null
    if (dirs.length === 1) return dirs[0]

    // Multiple matches: pick newest by mtime
    const mtimeSorted = await execSSH(deployment, `ls -1dt ${dirs.join(' ')} 2>/dev/null`)
    const first = mtimeSorted.output.split('\n').map(l => l.trim()).find(l => l.length > 0)
    return first?.replace(/\/+$/, '') || null
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
        result = await execSSH(deployment, 'echo "Connected as $(whoami)@$(hostname) ($(uname -s))"')
        status = result.exitCode === 0 ? 'success' : 'error'

      } else if (stepIndex === 1) {
        // ── Step 2: Validate Remote Paths ─────────────────────
        const deployPath = deployment.remoteDeployPath
        let resolvedDeploy: string | null = null

        // 2a. Resolve deploy path (wildcard or exact existence check)
        if (hasWildcard(deployPath)) {
          resolvedDeploy = await resolveRemoteDir(deployment, deployPath)
          if (!resolvedDeploy) {
            result = { output: `No directory matching "${deployPath}" found on the remote host.`, exitCode: 1 }
            status = 'error'
          } else {
            sessionStore.setResolvedDeployPath(resolvedDeploy)
          }
        } else {
          const check = await execSSH(deployment, `[ -d "${deployPath}" ] && echo ok`)
          if (check.output.includes('ok')) {
            resolvedDeploy = deployPath
          } else {
            result = { output: `Remote deploy path does not exist: "${deployPath}"`, exitCode: 1 }
            status = 'error'
          }
        }

        // 2b. Resolve service directory — fail fast if not found
        // Resolution order:
        //   1. Explicit wildcard (my-service*)  → newest match via ls -dt
        //   2. Exact name with version suffix    → direct directory check (no wildcard appended)
        //   3. Base name only (my-service)       → fall back to my-service* wildcard
        if (resolvedDeploy) {
          const name = deployment.serviceName
          let resolvedSvc: string | null = null
          let svcPattern: string

          if (hasWildcard(name)) {
            // Case 1: explicit wildcard
            svcPattern = name
            resolvedSvc = await resolveRemoteDir(deployment, `${resolvedDeploy}/${svcPattern}`)
          } else {
            // Case 2: try exact match first (handles my-service-1.3.65 and my-service-1.3.65-SNAPSHOT)
            const exactCheck = await execSSH(deployment, `[ -d "${resolvedDeploy}/${name}" ] && echo ok`)
            if (exactCheck.output.includes('ok')) {
              resolvedSvc = `${resolvedDeploy}/${name}`
              svcPattern = name
            } else {
              // Case 3: fall back to wildcard (handles bare base name → my-service*)
              svcPattern = `${name}*`
              resolvedSvc = await resolveRemoteDir(deployment, `${resolvedDeploy}/${svcPattern}`)
            }
          }

          if (!resolvedSvc) {
            result = { output: `No service directory matching "${resolvedDeploy}/${svcPattern}" found on the remote host.`, exitCode: 1 }
            status = 'error'
          } else {
            sessionStore.setResolvedSvcPath(resolvedSvc)
            const deployLine = hasWildcard(deployPath)
              ? `Deploy path (wildcard) → ${resolvedDeploy}`
              : `Deploy path: ${resolvedDeploy}`
            result = { output: `${deployLine}\nService directory → ${resolvedSvc}`, exitCode: 0 }
            status = 'success'
          }
        }

      } else {
        // ── Steps 3–7: use session-resolved paths ─────────────
        const dep = effectiveDeployment(deployment)
        const jarName = remoteJarFilename(dep)
        const logPath = remoteServiceLogPath(dep)
        const svcPath = sessionStore.resolvedSvcPath

        // Guard: svcPath must have been resolved by Step 2
        if (stepIndex > 2 && !svcPath) {
          result = { output: 'Service directory not resolved. Run step 2 first.', exitCode: 1 }
          status = 'error'
        } else {
          switch (stepIndex) {
            case 2: { // Upload Archive
              const scpResult = await execSCP(dep, dep.localJarPath, `${dep.remoteDeployPath}/`)
              if (scpResult.exitCode === 0) {
                const verify = await execSSH(dep, `ls -lh "${dep.remoteDeployPath}/${jarName}"`)
                result = { exitCode: 0, output: verify.output.trim() || `Uploaded: ${jarName}` }
                status = 'success'
              } else {
                result = scpResult
                status = 'error'
              }
              break
            }

            case 3: // Extract Files — service dir must already exist, no mkdir
              result = await execSSH(dep,
                `cd "${svcPath}" && jar xf "${dep.remoteDeployPath}/${jarName}" && echo "Extracted to: ${svcPath}" && ls -lh "${svcPath}" | head -10`)
              status = result.exitCode === 0 ? 'success' : 'error'
              break

            case 4: { // Verify Running Instance
              const pids = await execSSH(dep, `pgrep -f "${svcPath}"`)
              if (pids.exitCode === 0 && pids.output.trim()) {
                const pidList = pids.output.trim().split('\n').join(',')
                const details = await execSSH(dep, `ps -p ${pidList} -o pid,etime,comm --no-headers 2>/dev/null`)
                result = { exitCode: 0, output: details.output.trim() || pids.output.trim() }
                status = 'success'
              } else {
                result = { exitCode: 1, output: 'No running process found.' }
                status = 'warning'
              }
              break
            }

            case 5: // Stop Existing Service
              result = await execSSH(dep, `pkill -f "${svcPath}" && echo "Service stopped successfully" || echo "No running process found"`)
              status = result.exitCode === 0 ? 'success' : 'warning'
              break

            case 6: // Launch Service
              if (!dep.startCommand) {
                result = { output: 'Skipped: no start command configured.', exitCode: 0 }
                status = 'skipped'
              } else {
                const cmd = `cd "${svcPath}" && nohup ${dep.startCommand} > "${logPath}" 2>&1 & sleep 1 && pgrep -f "${svcPath}"`
                const launchResult = await execSSH(dep, cmd)
                if (launchResult.exitCode === 0) {
                  result = { exitCode: 0, output: `Service launched (PID: ${launchResult.output.trim()})` }
                } else {
                  result = launchResult
                }
                status = launchResult.exitCode === 0 ? 'success' : 'error'
              }
              break
          }
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
