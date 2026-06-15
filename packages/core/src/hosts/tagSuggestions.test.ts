import { describe, expect, it } from 'vitest'
import {
  applyTagSuggestion,
  getActiveTagToken,
  parseTagsInput,
  suggestHostTags
} from './tagSuggestions'

describe('parseTagsInput', () => {
  it('parses comma-separated tags', () => {
    expect(parseTagsInput('prod, web, eu-west')).toEqual(['prod', 'web', 'eu-west'])
  })
})

describe('getActiveTagToken', () => {
  it('returns text after the last comma', () => {
    expect(getActiveTagToken('prod, sta')).toBe(' sta')
    expect(getActiveTagToken('prod')).toBe('prod')
  })
})

describe('applyTagSuggestion', () => {
  it('replaces the active token with the selected tag', () => {
    expect(applyTagSuggestion('prod, sta', 'staging')).toBe('prod, staging, ')
    expect(applyTagSuggestion('sta', 'staging')).toBe('staging, ')
  })
})

describe('suggestHostTags', () => {
  const existing = ['prod', 'production', 'staging', 'web', 'db']

  it('returns empty list for blank query', () => {
    expect(suggestHostTags(existing, '  ', [])).toEqual([])
  })

  it('matches substrings and prefers prefix matches', () => {
    expect(suggestHostTags(existing, 'prod', [])).toEqual(['prod', 'production'])
  })

  it('excludes already selected tags', () => {
    expect(suggestHostTags(existing, 'prod', ['prod'])).toEqual(['production'])
  })

  it('is case-insensitive', () => {
    expect(suggestHostTags(existing, 'STAG', [])).toEqual(['staging'])
  })
})
