import {
  buildInventoryCollectScript,
  parseInventoryCollectOutput,
  type InventoryHostResult
} from '@consoleri/core'
import { execSshCommand } from '../sessions/SshConnectHelper'
import { sshReportConnection } from './SshReportConnection'
import type { ReportProbe } from './ReportProbe'

export class InventoryProbe implements ReportProbe<InventoryHostResult> {
  async probe(hostId: string, profileId: string): Promise<InventoryHostResult> {
    const started = Date.now()

    const connection = await sshReportConnection.connectForProfile(hostId, profileId)
    if (!connection.ok) {
      return {
        hostId,
        profileId,
        status: connection.status,
        durationMs: Date.now() - started,
        error: connection.error,
        log: connection.log
      }
    }

    const log = [...connection.log]
    try {
      log.push('Collecting inventory data…')
      const script = buildInventoryCollectScript()
      const { code, stderr, stdout } = await execSshCommand(connection.client, script)
      if (stderr.trim()) {
        log.push(`stderr: ${stderr.trim()}`)
      }
      if (code !== 0) {
        const message = stderr.trim() || `Remote command exited with code ${code}`
        log.push(`Collection failed: ${message}`)
        return {
          hostId,
          profileId,
          status: 'fail',
          durationMs: Date.now() - started,
          error: message,
          log
        }
      }

      const inventory = parseInventoryCollectOutput(stdout)
      if (!inventory) {
        const message = 'Failed to parse inventory data from remote output'
        log.push(message)
        if (stdout.trim()) {
          log.push('--- stdout ---')
          log.push(stdout.trim())
        }
        return {
          hostId,
          profileId,
          status: 'fail',
          durationMs: Date.now() - started,
          error: message,
          log
        }
      }

      log.push('Inventory collected successfully')
      return {
        hostId,
        profileId,
        status: 'ok',
        durationMs: Date.now() - started,
        inventory,
        log
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      log.push(`Collection failed: ${message}`)
      return {
        hostId,
        profileId,
        status: 'fail',
        durationMs: Date.now() - started,
        error: message,
        log
      }
    } finally {
      connection.client.end()
    }
  }
}

export const inventoryProbe = new InventoryProbe()
