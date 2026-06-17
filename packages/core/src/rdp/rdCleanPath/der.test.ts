import { describe, expect, it } from 'vitest'
import {
  derDecodeInteger,
  derDecodeTLV,
  derEncodeInteger,
  derEncodeLength,
  derEncodeUtf8String,
  derWrap
} from './der'

describe('derEncodeLength', () => {
  it('encodes short and long lengths', () => {
    expect(derEncodeLength(0)).toEqual(Buffer.from([0]))
    expect(derEncodeLength(127)).toEqual(Buffer.from([127]))
    expect(derEncodeLength(256)).toEqual(Buffer.from([0x82, 0x01, 0x00]))
  })
})

describe('derEncodeInteger', () => {
  it('roundtrips through decode', () => {
    const encoded = derEncodeInteger(3390)
    const tlv = derDecodeTLV(encoded, 0)
    expect(derDecodeInteger(tlv.value)).toBe(3390)
  })

  it('encodes zero', () => {
    const encoded = derEncodeInteger(0)
    const tlv = derDecodeTLV(encoded, 0)
    expect(derDecodeInteger(tlv.value)).toBe(0)
  })
})

describe('derEncodeUtf8String', () => {
  it('wraps UTF-8 payload', () => {
    const encoded = derEncodeUtf8String('db.example:3389')
    const tlv = derDecodeTLV(encoded, 0)
    expect(tlv.value.toString('utf-8')).toBe('db.example:3389')
  })
})

describe('derWrap roundtrip', () => {
  it('preserves nested content', () => {
    const inner = derEncodeUtf8String('test')
    const wrapped = derWrap(0xa2, inner)
    const outer = derDecodeTLV(wrapped, 0)
    const innerTlv = derDecodeTLV(outer.value, 0)
    expect(innerTlv.value.toString('utf-8')).toBe('test')
  })
})
