import { os } from '@neutralinojs/lib'
import type { Deployment } from '@/types/deployment'

export interface ExecResult {
  output: string
  exitCode: number
}

/**
 * Build SSH flags based on deployment auth method.
 */
function sshFlags(deployment: Deployment): string {
  const portFlag = `-p ${deployment.sshPort}`
  const strictFlag = '-o StrictHostKeyChecking=no -o BatchMode=yes'
  if (deployment.authMethod === 'key' && deployment.privateKeyPath) {
    return `${portFlag} -i "${deployment.privateKeyPath}" ${strictFlag}`
  }
  return `${portFlag} ${strictFlag}`
}

/**
 * Execute an SSH command on the remote host.
 * Returns stdout/stderr combined and the exit code.
 */
export async function execSSH(deployment: Deployment, remoteCmd: string): Promise<ExecResult> {
  const flags = sshFlags(deployment)
  const userHost = `${deployment.username}@${deployment.host}`

  let command: string
  if (deployment.authMethod === 'password' && deployment.password) {
    // Requires sshpass on host OS
    command = `sshpass -p "${deployment.password}" ssh ${flags} ${userHost} "${remoteCmd}"`
  } else {
    command = `ssh ${flags} ${userHost} "${remoteCmd}"`
  }

  try {
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
 * Copy a local file to the remote host via SCP.
 */
export async function execSCP(
  deployment: Deployment,
  localPath: string,
  remoteDest: string
): Promise<ExecResult> {
  const portFlag = `-P ${deployment.sshPort}`
  const strictFlag = '-o StrictHostKeyChecking=no'
  const userHost = `${deployment.username}@${deployment.host}`

  let command: string
  if (deployment.authMethod === 'key' && deployment.privateKeyPath) {
    command = `scp ${portFlag} -i "${deployment.privateKeyPath}" ${strictFlag} "${localPath}" ${userHost}:"${remoteDest}"`
  } else if (deployment.authMethod === 'password' && deployment.password) {
    command = `sshpass -p "${deployment.password}" scp ${portFlag} ${strictFlag} "${localPath}" ${userHost}:"${remoteDest}"`
  } else {
    command = `scp ${portFlag} ${strictFlag} "${localPath}" ${userHost}:"${remoteDest}"`
  }

  try {
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
 * Check whether sshpass is available on the host OS.
 */
export async function checkSshpass(): Promise<boolean> {
  try {
    const result = await os.execCommand('sshpass -V')
    return result.exitCode === 0
  } catch {
    return false
  }
}
