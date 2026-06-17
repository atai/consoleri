import { describe, expect, it } from 'vitest'
import { RDCLEANPATH_VERSION } from '../constants'
import {
  TAG_SEQUENCE,
  derEncodeInteger,
  derEncodeOctetString,
  derEncodeUtf8String,
  derWrap,
  derWrapContext
} from './der'
import {
  buildRDCleanPathError,
  buildRDCleanPathResponse,
  parseRDCleanPathRequest
} from './pdu'

function buildTestRequest(destination = 'db.example:3389'): Buffer {
  const parts = [
    derWrapContext(0, derEncodeInteger(RDCLEANPATH_VERSION)),
    derWrapContext(2, derEncodeUtf8String(destination)),
    derWrapContext(6, derEncodeOctetString(Buffer.from([0x03, 0x00, 0x00, 0x13, 0x0e])))
  ]
  return derWrap(TAG_SEQUENCE, Buffer.concat(parts))
}

describe('parseRDCleanPathRequest', () => {
  it('parses a valid request', () => {
    const request = buildTestRequest()
    const parsed = parseRDCleanPathRequest(request)
    expect(parsed.destination).toBe('db.example:3389')
    expect(parsed.x224ConnectionRequest).toEqual(Buffer.from([0x03, 0x00, 0x00, 0x13, 0x0e]))
    expect(parsed.proxyAuth).toBeNull()
  })

  it('rejects unsupported versions', () => {
    const parts = [
      derWrapContext(0, derEncodeInteger(1)),
      derWrapContext(2, derEncodeUtf8String('db.example:3389')),
      derWrapContext(6, derEncodeOctetString(Buffer.from([0x01])))
    ]
    const request = derWrap(TAG_SEQUENCE, Buffer.concat(parts))
    expect(() => parseRDCleanPathRequest(request)).toThrow(/Unsupported RDCleanPath version/)
  })
})

describe('buildRDCleanPathResponse', () => {
  it('builds a DER sequence response', () => {
    const response = buildRDCleanPathResponse(
      'db.example:3389',
      Buffer.from([0x03, 0x00, 0x00, 0x13, 0x0e]),
      [Buffer.from([0x30, 0x01, 0x02])]
    )
    expect(response[0]).toBe(TAG_SEQUENCE)
    expect(response.length).toBeGreaterThan(10)
  })
})

describe('buildRDCleanPathError', () => {
  it('builds an error sequence', () => {
    const response = buildRDCleanPathError(1, 502)
    expect(response[0]).toBe(TAG_SEQUENCE)
    expect(response.length).toBeGreaterThan(5)
  })
})
