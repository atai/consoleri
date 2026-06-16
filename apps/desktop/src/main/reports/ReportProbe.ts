import type { ReportHostResultBase } from '@consoleri/core'

export interface ReportProbe<TResult extends ReportHostResultBase> {
  probe(hostId: string, profileId: string): Promise<TResult>
}
