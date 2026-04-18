import type { Service } from '@/types/deployment'

/**
 * Basename of the local JAR file for a service.
 * e.g. 'auth-service-1.0.0.jar'
 */
export function remoteJarFilename(service: Service): string {
  return service.localJarPath.split(/[/\\]/).pop() ?? service.localJarPath
}

/**
 * Derived log path: remoteLogPath + '/' + serviceName + '.log'
 * e.g. /opt/my-app/logs/my-service.log
 */
export function remoteServiceLogPath(remoteLogPath: string, serviceName: string): string {
  return `${remoteLogPath.replace(/\/$/, '')}/${serviceName}.log`
}
