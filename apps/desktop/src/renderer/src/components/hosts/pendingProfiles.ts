import type { ConnectionProfile, ProfileInput } from '@shared/types'

export type PendingProfile =
  | { key: string; kind: 'new'; input: ProfileInput }
  | { key: string; kind: 'picked'; profile: ConnectionProfile }

export function pendingProfileLabel(item: PendingProfile): string {
  if (item.kind === 'new') {
    return `${item.input.name} (${item.input.protocol})`
  }
  return `${item.profile.name} (${item.profile.protocol})`
}

export async function applyPendingProfile(
  item: PendingProfile,
  hostId: string
): Promise<void> {
  if (item.kind === 'new') {
    await window.consoleri.profiles.create({ ...item.input, linkHostId: hostId })
    return
  }

  await window.consoleri.profiles.link(hostId, item.profile.id)
}

export async function applyPendingProfiles(
  items: PendingProfile[],
  hostId: string
): Promise<void> {
  for (const item of items) {
    await applyPendingProfile(item, hostId)
  }
}
