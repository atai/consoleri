import { describe, expect, it } from 'vitest'
import {
  classifyHttpStatus,
  formatHttpStatusLabel,
  connectivityResultHasHttpColumn
} from './httpStatusColor'

describe('classifyHttpStatus', () => {
  it('classifies 2xx as success', () => {
    expect(classifyHttpStatus(200)).toBe('success')
    expect(classifyHttpStatus(204)).toBe('success')
  })

  it('classifies 4xx and 5xx as error', () => {
    expect(classifyHttpStatus(404)).toBe('error')
    expect(classifyHttpStatus(503)).toBe('error')
  })

  it('classifies 1xx and 3xx as warning', () => {
    expect(classifyHttpStatus(100)).toBe('warning')
    expect(classifyHttpStatus(302)).toBe('warning')
  })

  it('classifies network errors as warning', () => {
    expect(classifyHttpStatus(undefined, 'timeout')).toBe('warning')
  })

  it('returns none when no data', () => {
    expect(classifyHttpStatus()).toBe('none')
  })
})

describe('formatHttpStatusLabel', () => {
  it('formats status code, error, and empty', () => {
    expect(formatHttpStatusLabel(200)).toBe('200')
    expect(formatHttpStatusLabel(undefined, 'fail')).toBe('ERR')
    expect(formatHttpStatusLabel()).toBe('—')
  })
})

describe('connectivityResultHasHttpColumn', () => {
  it('is true when any entry has http data', () => {
    expect(connectivityResultHasHttpColumn([{ httpStatusCode: 200 }])).toBe(true)
    expect(connectivityResultHasHttpColumn([{ httpError: 'timeout' }])).toBe(true)
    expect(connectivityResultHasHttpColumn([{}])).toBe(false)
  })
})
