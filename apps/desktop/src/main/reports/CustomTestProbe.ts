import type { CustomTestHostResult } from '@consoleri/core'
import { execSshCommand } from '../sessions/SshConnectHelper'
import { sshReportConnection } from './SshReportConnection'
import type { CustomTestProbeOptions, ReportProbe } from './ReportProbe'

export class CustomTestProbe implements ReportProbe<CustomTestHostResult> {
  async probe(
    hostId: string,
    profileId: string,
    options?: CustomTestProbeOptions
  ): Promise<CustomTestHostResult> {
    const started = Date.now()
    const commands = options?.commands ?? []
    const continueOnError = options?.continueOnError ?? false
    const onCommandProgress = options?.onCommandProgress

    const connection = await sshReportConnection.connectForProfile(hostId, profileId)
    if (!connection.ok) {
      return {
        hostId,
        profileId,
        status: connection.status,
        durationMs: Date.now() - started,
        error: connection.error,
        log: connection.log,
        commands: []
      }
    }

    const log = [...connection.log]
    const commandResults: CustomTestHostResult['commands'] = []
    let pipelineStopped = false

    try {
      for (let index = 0; index < commands.length; index++) {
        const { command } = commands[index]!
        onCommandProgress?.(index, commands.length)

        if (pipelineStopped) {
          commandResults.push({
            index,
            command,
            status: 'skipped',
            code: null,
            stdout: '',
            stderr: '',
            durationMs: 0
          })
          continue
        }

        const cmdStarted = Date.now()
        log.push(`Running: ${command}`)
        const { code, stderr, stdout } = await execSshCommand(connection.client, command)
        const durationMs = Date.now() - cmdStarted

        if (stderr.trim()) {
          log.push(`stderr: ${stderr.trim()}`)
        }

        const status = code === 0 ? 'ok' : 'fail'
        const cmdResult: CustomTestHostResult['commands'][number] = {
          index,
          command,
          status,
          code,
          stdout,
          stderr,
          durationMs
        }

        if (code !== 0) {
          const message = stderr.trim() || `Remote command exited with code ${code}`
          cmdResult.error = message
          log.push(`Command failed: ${message}`)
        }

        commandResults.push(cmdResult)

        if (code !== 0 && !continueOnError) {
          pipelineStopped = true
        }
      }

      onCommandProgress?.(commands.length, commands.length)

      const hasFailure = commandResults.some((c) => c.status === 'fail')
      const hostStatus = hasFailure ? 'fail' : 'ok'

      if (hostStatus === 'ok') {
        log.push('All commands completed successfully')
      }

      return {
        hostId,
        profileId,
        status: hostStatus,
        durationMs: Date.now() - started,
        commands: commandResults,
        log
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      log.push(`Execution failed: ${message}`)
      return {
        hostId,
        profileId,
        status: 'fail',
        durationMs: Date.now() - started,
        error: message,
        commands: commandResults,
        log
      }
    } finally {
      connection.client.end()
    }
  }
}

export const customTestProbe = new CustomTestProbe()
