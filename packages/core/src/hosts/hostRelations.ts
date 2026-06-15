export function normalizeRelatedHostIds(
  hostId: string,
  relatedHostIds: string[] | undefined,
  existingHostIds: Set<string>
): string[] {
  if (!relatedHostIds?.length) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const id of relatedHostIds) {
    const trimmed = id.trim()
    if (!trimmed || trimmed === hostId || seen.has(trimmed)) continue
    if (!existingHostIds.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

export function normalizeGatewayHostId(
  hostId: string,
  gatewayHostId: string | null | undefined,
  existingHosts: Array<{ id: string; gatewayHostId: string | null }>
): string | null {
  if (!gatewayHostId || gatewayHostId === hostId) return null
  const target = existingHosts.find((h) => h.id === gatewayHostId)
  if (!target) return null
  if (target.gatewayHostId === hostId) return null
  return gatewayHostId
}
