import { os, filesystem } from '@neutralinojs/lib'
import type { Deployment, SSHConfig } from '@/types/deployment'

export interface ExecResult {
  output: string
  exitCode: number
}

// ── Platform ──────────────────────────────────────────────

// ── Execution Helpers ─────────────────────────────────────
const DEFAULT_TIMEOUT_MS = 10000 // Reduced from 15s to 10s for faster failover
const TOOL_TIMEOUT_MS = 2000    // Shorter timeout for local tool checks
export const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000 // 5 min — large JARs can be ~100 MB
export const REMOTE_DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000 // 5 min — large JARs can be ~100 MB


async function withTimeout<T>(promise: Promise<T>, ms: number = DEFAULT_TIMEOUT_MS, label: string = 'Command'): Promise<T> {
  let timer: any
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

function getOS(): string {
  // NL_OS is injected by NeutralinoJS binary: 'Windows' | 'Linux' | 'Darwin'
  return (globalThis as any).NL_OS ?? (navigator.platform.startsWith('Win') ? 'Windows' : 'Linux')
}

// ── Tool availability ─────────────────────────────────────

const availabilityCache: Record<string, Promise<boolean>> = {}

async function checkTool(cmd: string): Promise<boolean> {
  if (!availabilityCache[cmd]) {
    availabilityCache[cmd] = (async () => {
      try {
        const result = await withTimeout(os.execCommand(cmd), TOOL_TIMEOUT_MS, `Check ${cmd}`)
        return result.exitCode === 0
      } catch {
        return false
      }
    })()
  }
  return availabilityCache[cmd]
}

export async function checkSshpass(): Promise<boolean> {
  return checkTool('sshpass -V')
}

export async function checkPlink(): Promise<boolean> {
  return checkTool('plink -V')
}

// ── SSH_ASKPASS helper ────────────────────────────────────

/**
 * Creates a temporary askpass script, calls fn(path), then deletes it.
 * The script outputs the password when invoked by SSH.
 */
async function withAskpassFile<T>(password: string, fn: (path: string) => Promise<T>): Promise<T> {
  const platform = getOS()
  const isWin = platform === 'Windows'

  // Base64-encode the password to avoid all shell/CMD escaping issues
  const encoder = new TextEncoder()
  const bytes = encoder.encode(password)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const b64 = btoa(binary)

  let content: string
  let ext: string

  if (isWin) {
    // bat file: decode base64 via built-in PowerShell, no extra tools needed
    content = `@powershell -NoProfile -Command "[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64}'))"`
    ext = 'bat'
  } else {
    // sh script: decode base64 via built-in base64 utility
    // macOS uses -D flag, Linux uses -d; try both
    content = `#!/bin/sh\nprintf '%s' "$(printf '%s' '${b64}' | base64 -d 2>/dev/null || printf '%s' '${b64}' | base64 -D 2>/dev/null)"\n`
    ext = 'sh'
  }

  const tempDir = isWin
    ? (await os.getEnv('TEMP').catch(() => '') || 'C:\\Windows\\Temp')
    : '/tmp'

  const askpassPath = `${tempDir.replace(/[/\\]+$/, '')}/${isWin ? '' : ''}hdg_ask_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  try {
    await filesystem.writeFile(askpassPath, content)
    if (!isWin) {
      await os.execCommand(`chmod +x "${askpassPath}"`)
    }
    return await fn(askpassPath)
  } finally {
    try { await filesystem.remove(askpassPath) } catch { /* best-effort cleanup */ }
  }
}

/**
 * Build the env-var prefix that activates SSH_ASKPASS for a given script path.
 * Works on both Windows (CMD SET syntax) and Unix (env var prefix syntax).
 */
function askpassEnvPrefix(askpassPath: string): string {
  if (getOS() === 'Windows') {
    // CMD: set vars then run command
    return `SET "DISPLAY=:0" && SET "SSH_ASKPASS_REQUIRE=force" && SET "SSH_ASKPASS=${askpassPath}" &&`
  }
  return `SSH_ASKPASS="${askpassPath}" SSH_ASKPASS_REQUIRE=force DISPLAY=:0`
}

// ── Remote command encoding ───────────────────────────────

/**
 * Wraps a remote command as `echo <base64> | base64 -d | sh` so that
 * the local shell never sees double-quotes, dollar signs, or parens from
 * the remote command — preventing local expansion and quoting errors.
 * The remote sh receives the original command verbatim and executes it.
 */
function wrapRemoteCmd(cmd: string): string {
  const bytes = new TextEncoder().encode(cmd)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  const b64 = btoa(binary)
  return `echo ${b64} | base64 -d | sh`
}

// ── Result normalisation ──────────────────────────────────

function toResult(r: { stdOut: string; stdErr: string; exitCode: number }): ExecResult {
  return {
    output: r.stdOut + (r.stdErr ? `\n${r.stdErr}` : ''),
    exitCode: r.exitCode,
  }
}

// ── SSH execution ─────────────────────────────────────────

async function execSSHWithPasswordTimeout(deployment: SSHConfig, remoteCmd: string, timeoutMs: number): Promise<ExecResult> {
  const { password = '', host, username, sshPort } = deployment

  const wrapped = wrapRemoteCmd(remoteCmd)

  // 1. sshpass (Linux / macOS with Homebrew)
  if (await checkSshpass()) {
    const flags = `-p ${sshPort} -o StrictHostKeyChecking=no -o BatchMode=yes`
    const res = await withTimeout(
      os.execCommand(`sshpass -p "${password}" ssh ${flags} ${username}@${host} "${wrapped}"`),
      timeoutMs,
      'SSH (sshpass)'
    )
    return toResult(res)
  }

  // 2. plink (Windows with PuTTY installed)
  if (await checkPlink()) {
    const res = await withTimeout(
      os.execCommand(`plink -P ${sshPort} -pw "${password}" -batch ${username}@${host} "${wrapped}"`),
      timeoutMs,
      'SSH (plink)'
    )
    return toResult(res)
  }

  // 3. SSH_ASKPASS — uses OpenSSH built into Windows 10/11 or any modern Linux/macOS
  //    No extra tools required. Creates a temp script that outputs the password when SSH calls it.
  return withAskpassFile(password, async (askpassPath) => {
    const prefix = askpassEnvPrefix(askpassPath)
    // Omit -o BatchMode=yes here: BatchMode blocks SSH_ASKPASS
    const flags = `-p ${sshPort} -o StrictHostKeyChecking=no -o PasswordAuthentication=yes`
    const cmd = `${prefix} ssh ${flags} ${username}@${host} "${wrapped}"`
    const res = await withTimeout(os.execCommand(cmd), timeoutMs, 'SSH (askpass)')
    return toResult(res)
  })
}

async function execSSHWithPassword(deployment: SSHConfig, remoteCmd: string): Promise<ExecResult> {
  return await execSSHWithPasswordTimeout(deployment, remoteCmd, DEFAULT_TIMEOUT_MS)
}

export async function execSSHWithTimeout(deployment: SSHConfig, remoteCmd: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<ExecResult> {
  if (deployment.authMethod === 'password') {
    return await execSSHWithPasswordTimeout(deployment, remoteCmd, timeoutMs)
  }
  const keyFlag = deployment.privateKeyPath ? `-i "${deployment.privateKeyPath}"` : ''
  const flags = `-p ${deployment.sshPort} -o StrictHostKeyChecking=no -o BatchMode=yes ${keyFlag}`.trim()
  const res = await withTimeout(
    os.execCommand(`ssh ${flags} ${deployment.username}@${deployment.host} "${wrapRemoteCmd(remoteCmd)}"`),
    timeoutMs,
    'SSH Command'
  )
  return toResult(res)
}

export async function execSSH(deployment: SSHConfig, remoteCmd: string): Promise<ExecResult> {
  return execSSHWithTimeout(deployment, remoteCmd, DEFAULT_TIMEOUT_MS)
}

// ── SCP execution ─────────────────────────────────────────

async function execSCPWithPassword(deployment: SSHConfig, localPath: string, remoteDest: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<ExecResult> {
  const { password = '', host, username, sshPort } = deployment

  // 1. sshpass
  if (await checkSshpass()) {
    const flags = `-P ${sshPort} -o StrictHostKeyChecking=no`
    const res = await withTimeout(
      os.execCommand(`sshpass -p "${password}" scp ${flags} "${localPath}" ${username}@${host}:"${remoteDest}"`),
      timeoutMs,
      'SCP (sshpass)'
    )
    return toResult(res)
  }

  // 2. pscp (PuTTY SCP, bundled with PuTTY)
  if (await checkTool('pscp -V')) {
    const res = await withTimeout(
      os.execCommand(`pscp -P ${sshPort} -pw "${password}" -batch "${localPath}" ${username}@${host}:"${remoteDest}"`),
      timeoutMs,
      'SCP (pscp)'
    )
    return toResult(res)
  }

  // 3. SSH_ASKPASS fallback — scp honours SSH_ASKPASS just like ssh does
  return withAskpassFile(password, async (askpassPath) => {
    const prefix = askpassEnvPrefix(askpassPath)
    const flags = `-P ${sshPort} -o StrictHostKeyChecking=no -o PasswordAuthentication=yes`
    const cmd = `${prefix} scp ${flags} "${localPath}" ${username}@${host}:"${remoteDest}"`
    const res = await withTimeout(os.execCommand(cmd), timeoutMs, 'SCP (askpass)')
    return toResult(res)
  })
}

export async function execSCP(deployment: SSHConfig, localPath: string, remoteDest: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<ExecResult> {
  if (deployment.authMethod === 'password') {
    return await execSCPWithPassword(deployment, localPath, remoteDest, timeoutMs)
  }
  const keyFlag = deployment.privateKeyPath ? `-i "${deployment.privateKeyPath}"` : ''
  const flags = `-P ${deployment.sshPort} -o StrictHostKeyChecking=no ${keyFlag}`.trim()
  const res = await withTimeout(
    os.execCommand(`scp ${flags} "${localPath}" ${deployment.username}@${deployment.host}:"${remoteDest}"`),
    timeoutMs,
    'SCP Command'
  )
  return toResult(res)
}

// ── Command builders (kept for diagnostics / external use) ─

export async function buildSshCommand(deployment: SSHConfig, remoteCmd: string): Promise<string> {
  const { password = '', host, username, sshPort, privateKeyPath } = deployment
  const isPassword = deployment.authMethod === 'password'

  if (isPassword && await checkSshpass()) {
    return `sshpass -p "${password}" ssh -p ${sshPort} -o StrictHostKeyChecking=no -o BatchMode=yes ${username}@${host} "${remoteCmd}"`
  }
  if (isPassword && await checkPlink()) {
    return `plink -P ${sshPort} -pw "${password}" -batch ${username}@${host} "${remoteCmd}"`
  }
  if (isPassword) {
    return `(SSH_ASKPASS via temp script — use execSSH() to execute)`
  }
  const keyFlag = privateKeyPath ? `-i "${privateKeyPath}"` : ''
  return `ssh -p ${sshPort} -o StrictHostKeyChecking=no -o BatchMode=yes ${keyFlag} ${username}@${host} "${remoteCmd}"`.replace(/\s+/g, ' ').trim()
}

export async function buildScpCommand(deployment: SSHConfig, localPath: string, remoteDest: string): Promise<string> {
  const { password = '', host, username, sshPort, privateKeyPath } = deployment
  const isPassword = deployment.authMethod === 'password'

  if (isPassword && await checkSshpass()) {
    return `sshpass -p "${password}" scp -P ${sshPort} -o StrictHostKeyChecking=no "${localPath}" ${username}@${host}:"${remoteDest}"`
  }
  if (isPassword && await checkTool('pscp -V')) {
    return `pscp -P ${sshPort} -pw "${password}" -batch "${localPath}" ${username}@${host}:"${remoteDest}"`
  }
  if (isPassword) {
    return `(SSH_ASKPASS via temp script — use execSCP() to execute)`
  }
  const keyFlag = privateKeyPath ? `-i "${privateKeyPath}"` : ''
  return `scp -P ${sshPort} -o StrictHostKeyChecking=no ${keyFlag} "${localPath}" ${username}@${host}:"${remoteDest}"`.replace(/\s+/g, ' ').trim()
}
