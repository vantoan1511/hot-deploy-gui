import type { Deployment } from '@/types/deployment'

/**
 * Derived path: remoteDeployPath + '/' + serviceName
 * e.g. /opt/my-app/temp/services/my-service
 */
export function remoteServicePath(d: Deployment): string {
  return `${d.remoteDeployPath.replace(/\/$/, '')}/${d.serviceName}`
}

/**
 * Basename of the local JAR file.
 * e.g. 'auth-service-1.0.0.jar'
 */
export function remoteJarFilename(d: Deployment): string {
  return d.localJarPath.split(/[/\\]/).pop() ?? d.localJarPath
}

/**
 * Derived log path: remoteLogPath + '/' + serviceName + '.log'
 * e.g. /opt/my-app/logs/my-service.log
 */
export function remoteServiceLogPath(d: Deployment): string {
  return `${d.remoteLogPath.replace(/\/$/, '')}/${d.serviceName}.log`
}
