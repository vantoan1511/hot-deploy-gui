import { os } from '@neutralinojs/lib'
import type { Deployment } from '@/types/deployment'

export interface ExecResult {
  output: string
  exitCode: number
}

/**
 * Build SSH command based on available tools (sshpass or plink).
 */
export async function buildSshCommand(deployment: Deployment, remoteCmd: string): Promise<string> {
  const isPassword = deployment.authMethod === 'password'
  const pass = deployment.password || ''
  
  // Try sshpass (Linux/Standard)
  const hasSshpass = await checkSshpass()
  if (isPassword && hasSshpass) {
    const flags = `-p ${deployment.sshPort} -o StrictHostKeyChecking=no -o BatchMode=yes`
    return `sshpass -p "${pass}" ssh ${flags} ${deployment.username}@${deployment.host} "${remoteCmd}"`
  }

  // Try plink (Windows Alternative)
  const hasPlink = await checkPlink()
  if (isPassword && hasPlink) {
    const flags = `-P ${deployment.sshPort} -pw "${pass}" -batch`
    return `plink ${flags} ${deployment.username}@${deployment.host} "${remoteCmd}"`
  }

  // Default: OpenSSH (may fail if password is required but no agent/sshpass)
  const flags = `-p ${deployment.sshPort} -o StrictHostKeyChecking=no -o BatchMode=yes`
  if (deployment.authMethod === 'key' && deployment.privateKeyPath) {
    return `ssh ${flags} -i "${deployment.privateKeyPath}" ${deployment.username}@${deployment.host} "${remoteCmd}"`
  }
  return `ssh ${flags} ${deployment.username}@${deployment.host} "${remoteCmd}"`
}

/**
 * Build SCP command based on available tools.
 */
export async function buildScpCommand(
  deployment: Deployment,
  localPath: string,
  remoteDest: string
): Promise<string> {
  const isPassword = deployment.authMethod === 'password'
  const pass = deployment.password || ''

  // Try sshpass
  const hasSshpass = await checkSshpass()
  if (isPassword && hasSshpass) {
    const flags = `-P ${deployment.sshPort} -o StrictHostKeyChecking=no`
    return `sshpass -p "${pass}" scp ${flags} "${localPath}" ${deployment.username}@${deployment.host}:"${remoteDest}"`
  }

  // Try pscp (PuTTY SCP)
  const hasPscp = await checkTool('pscp -V')
  if (isPassword && hasPscp) {
    const flags = `-P ${deployment.sshPort} -pw "${pass}" -batch`
    return `pscp ${flags} "${localPath}" ${deployment.username}@${deployment.host}:"${remoteDest}"`
  }

  // Default: OpenSSH scp
  const flags = `-P ${deployment.sshPort} -o StrictHostKeyChecking=no`
  if (deployment.authMethod === 'key' && deployment.privateKeyPath) {
    return `scp ${flags} -i "${deployment.privateKeyPath}" "${localPath}" ${deployment.username}@${deployment.host}:"${remoteDest}"`
  }
  return `scp ${flags} "${localPath}" ${deployment.username}@${deployment.host}:"${remoteDest}"`
}

/**
 * Execute an SSH command.
 */
export async function execSSH(deployment: Deployment, remoteCmd: string): Promise<ExecResult> {
  try {
    const command = await buildSshCommand(deployment, remoteCmd)
    const result = await os.execCommand(command)
    return {
      output: result.stdOut + (result.stdErr ? `\n${result.stdErr}` : ''),
      exitCode: result.exitCode,
    }
  } catch (err) {
    return { output: String(err), exitCode: 1 }
  }
}

/**
 * Copy a file via SCP.
 */
export async function execSCP(
  deployment: Deployment,
  localPath: string,
  remoteDest: string
): Promise<ExecResult> {
  try {
    const command = await buildScpCommand(deployment, localPath, remoteDest)
    const result = await os.execCommand(command)
    return {
      output: result.stdOut + (result.stdErr ? `\n${result.stdErr}` : ''),
      exitCode: result.exitCode,
    }
  } catch (err) {
    return { output: String(err), exitCode: 1 }
  }
}

/**
 * Generic tool checker.
 */
async function checkTool(cmd: string): Promise<boolean> {
  try {
    const result = await os.execCommand(cmd)
    return result.exitCode === 0
  } catch {
    return false
  }
}

export async function checkSshpass(): Promise<boolean> {
  return checkTool('sshpass -V')
}

export async function checkPlink(): Promise<boolean> {
  return checkTool('plink -V')
}
