import type { CustomTestCommand, ReportHostResultBase } from '@consoleri/core'

export interface CustomTestProbeOptions {
  commands: CustomTestCommand[]
  continueOnError: boolean
  onCommandProgress?: (index: number, total: number) => void
}

export interface ReportProbe<TResult extends ReportHostResultBase> {
  probe(hostId: string, profileId: string, options?: CustomTestProbeOptions): Promise<TResult>
}
