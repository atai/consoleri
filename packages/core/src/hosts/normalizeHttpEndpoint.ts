export function normalizeHttpEndpoint(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('HTTP endpoint must be a valid http(s) URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('HTTP endpoint must be a valid http(s) URL')
  }

  return url.toString()
}
