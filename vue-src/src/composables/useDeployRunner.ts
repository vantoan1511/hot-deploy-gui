import { ref } from 'vue'
import { useSessionStore, GLOBAL_STEPS, SERVICE_STEPS } from '@/stores/session'
import { useDeploymentsStore } from '@/stores/deployments'
import { execSSH, execSCP } from './useSSH'
import { remoteJarFilename, remoteServiceLogPath } from '@/utils/pathUtils'
import type { Deployment, Service, StepStatus } from '@/types/deployment'

export const GLOBAL_STEP_NAMES = [
  'Test Connection',
  'Validate Remote Path',
]

export const SERVICE_STEP_NAMES = [
  'Resolve Service Dir',
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
   * Uses `find -name` so the glob is handled by find internally.
   */
  async function resolveRemoteDir(deployment: Deployment, pattern: string): Promise<string | null> {
    const lastSlash = pattern.lastIndexOf('/')
    const parent = pattern.substring(0, lastSlash)
    const nameGlob = pattern.substring(lastSlash + 1)

    const found = await execSSH(deployment,
      `find "${parent}" -maxdepth 1 -name "${nameGlob}" -type d 2>/dev/null`)
    const dirs = found.output.split('\n').map(l => l.trim().replace(/\/+$/, '')).filter(Boolean)
    if (dirs.length === 0) return null
    if (dirs.length === 1) return dirs[0] ?? null

    const mtimeSorted = await execSSH(deployment, `ls -1dt ${dirs.join(' ')} 2>/dev/null`)
    const first = mtimeSorted.output.split('\n').map(l => l.trim()).find(l => l.length > 0)
    return first?.replace(/\/+$/, '') || null
  }

  /**
   * Build deployment with deploy path overridden by session-resolved path.
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
        // ── Global Step 1: Test Connection ────────────────────
        result = await execSSH(deployment, 'echo "Connected as $(whoami)@$(hostname) ($(uname -s))"')
        status = result.exitCode === 0 ? 'success' : 'error'

      } else if (stepIndex === 1) {
        // ── Global Step 2: Validate Remote Path ───────────────
        const deployPath = deployment.remoteDeployPath

        if (hasWildcard(deployPath)) {
          const resolved = await resolveRemoteDir(deployment, deployPath)
          if (!resolved) {
            result = { output: `No directory matching "${deployPath}" found on the remote host.`, exitCode: 1 }
            status = 'error'
          } else {
            sessionStore.setResolvedDeployPath(resolved)
            result = { output: `Deploy path (wildcard) → ${resolved}`, exitCode: 0 }
            status = 'success'
          }
        } else {
          const check = await execSSH(deployment, `[ -d "${deployPath}" ] && echo ok`)
          if (check.output.includes('ok')) {
            sessionStore.setResolvedDeployPath(deployPath)
            result = { output: `Deploy path: ${deployPath}`, exitCode: 0 }
            status = 'success'
          } else {
            result = { output: `Remote deploy path does not exist: "${deployPath}"`, exitCode: 1 }
            status = 'error'
          }
        }

      } else {
        // ── Per-service steps ─────────────────────────────────
        const relative = stepIndex - GLOBAL_STEPS
        const serviceIndex = Math.floor(relative / SERVICE_STEPS)
        const localStep = relative % SERVICE_STEPS
        const service: Service | undefined = deployment.services[serviceIndex]

        if (!service) {
          result = { output: `No service at index ${serviceIndex}.`, exitCode: 1 }
          status = 'error'
        } else {
          const dep = effectiveDeployment(deployment)
          const jarName = remoteJarFilename(service)
          const logPath = remoteServiceLogPath(dep.remoteLogPath, service.name)
          const svcPath = sessionStore.resolvedSvcPaths[service.id] ?? null

          switch (localStep) {
            case 0: { // Resolve Service Dir
              const deployPath = dep.remoteDeployPath
              let resolvedSvc: string | null = null
              let svcPattern = service.name

              if (hasWildcard(service.name)) {
                svcPattern = service.name
                resolvedSvc = await resolveRemoteDir(deployment, `${deployPath}/${svcPattern}`)
              } else {
                const exactCheck = await execSSH(deployment, `[ -d "${deployPath}/${service.name}" ] && echo ok`)
                if (exactCheck.output.includes('ok')) {
                  resolvedSvc = `${deployPath}/${service.name}`
                  svcPattern = service.name
                } else {
                  svcPattern = `${service.name}*`
                  resolvedSvc = await resolveRemoteDir(deployment, `${deployPath}/${svcPattern}`)
                }
              }

              if (!resolvedSvc) {
                result = { output: `No service directory matching "${deployPath}/${svcPattern}" found on the remote host.`, exitCode: 1 }
                status = 'error'
              } else {
                sessionStore.setResolvedSvcPath(service.id, resolvedSvc)
                result = { output: `Service directory → ${resolvedSvc}`, exitCode: 0 }
                status = 'success'
              }
              break
            }

            case 1: { // Upload Archive
              if (!svcPath) {
                result = { output: 'Service directory not resolved. Run "Resolve Service Dir" first.', exitCode: 1 }
                status = 'error'
              } else {
                const scpResult = await execSCP(dep, service.localJarPath, `${dep.remoteDeployPath}/`)
                if (scpResult.exitCode === 0) {
                  const verify = await execSSH(dep, `ls -lh "${dep.remoteDeployPath}/${jarName}"`)
                  result = { exitCode: 0, output: verify.output.trim() || `Uploaded: ${jarName}` }
                  status = 'success'
                } else {
                  result = scpResult
                  status = 'error'
                }
              }
              break
            }

            case 2: { // Extract Files
              if (!svcPath) {
                result = { output: 'Service directory not resolved. Run "Resolve Service Dir" first.', exitCode: 1 }
                status = 'error'
              } else {
                result = await execSSH(dep,
                  `cd "${svcPath}" && jar xf "${dep.remoteDeployPath}/${jarName}" && echo "Extracted to: ${svcPath}" && ls -lh "${svcPath}" | head -10`)
                status = result.exitCode === 0 ? 'success' : 'error'
              }
              break
            }

            case 3: { // Verify Running Instance
              if (!svcPath) {
                result = { output: 'Service directory not resolved. Run "Resolve Service Dir" first.', exitCode: 1 }
                status = 'error'
              } else {
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
              }
              break
            }

            case 4: { // Stop Existing Service
              if (service.stopCommand) {
                result = await execSSH(dep, service.stopCommand)
                status = result.exitCode === 0 ? 'success' : 'warning'
              } else if (!svcPath) {
                result = { output: 'Service directory not resolved. Run "Resolve Service Dir" first.', exitCode: 1 }
                status = 'error'
              } else {
                result = await execSSH(dep,
                  `pkill -f "${svcPath}" && echo "Service stopped successfully" || echo "No running process found"`)
                status = result.exitCode === 0 ? 'success' : 'warning'
              }
              break
            }

            case 5: { // Launch Service
              if (!service.startCommand) {
                result = { output: 'Skipped: no start command configured.', exitCode: 0 }
                status = 'skipped'
              } else if (!svcPath) {
                result = { output: 'Service directory not resolved. Run "Resolve Service Dir" first.', exitCode: 1 }
                status = 'error'
              } else {
                const cmd = `cd "${svcPath}" && nohup ${service.startCommand} > "${logPath}" 2>&1 & sleep 1 && pgrep -f "${svcPath}"`
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
    sessionStore.startSession(deploymentId, deployment.services)

    try {
      const total = GLOBAL_STEPS + deployment.services.length * SERVICE_STEPS
      for (let i = 0; i < total; i++) {
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
    globalStepNames: GLOBAL_STEP_NAMES,
    serviceStepNames: SERVICE_STEP_NAMES,
    deployAll,
    runSingleStep,
  }
}
