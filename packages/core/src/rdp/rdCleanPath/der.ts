const TAG_SEQUENCE = 0x30
const TAG_INTEGER = 0x02
const TAG_OCTET_STRING = 0x04
const TAG_UTF8STRING = 0x0c

function tagContext(n: number): number {
  return 0xa0 + n
}

export function derEncodeLength(length: number): Buffer {
  if (length < 0x80) {
    return Buffer.from([length])
  }
  const bytes: number[] = []
  let temp = length
  while (temp > 0) {
    bytes.unshift(temp & 0xff)
    temp >>= 8
  }
  return Buffer.from([0x80 | bytes.length, ...bytes])
}

export function derWrap(tag: number, content: Buffer): Buffer {
  const len = derEncodeLength(content.length)
  return Buffer.concat([Buffer.from([tag]), len, content])
}

export function derEncodeInteger(value: number): Buffer {
  if (value === 0) {
    return derWrap(TAG_INTEGER, Buffer.from([0]))
  }
  const bytes: number[] = []
  let temp = value
  while (temp > 0) {
    bytes.unshift(temp & 0xff)
    temp >>= 8
  }
  if (bytes[0]! & 0x80) {
    bytes.unshift(0)
  }
  return derWrap(TAG_INTEGER, Buffer.from(bytes))
}

export function derEncodeUtf8String(str: string): Buffer {
  return derWrap(TAG_UTF8STRING, Buffer.from(str, 'utf-8'))
}

export function derEncodeOctetString(buf: Buffer): Buffer {
  return derWrap(TAG_OCTET_STRING, buf)
}

export function derWrapContext(tagNum: number, content: Buffer): Buffer {
  return derWrap(tagContext(tagNum), content)
}

export interface DerTLV {
  tag: number
  value: Buffer
  totalLength: number
}

export function derDecodeLength(buf: Buffer, offset: number): { length: number; bytesRead: number } {
  const first = buf[offset]!
  if (first < 0x80) {
    return { length: first, bytesRead: 1 }
  }
  const numBytes = first & 0x7f
  let length = 0
  for (let i = 0; i < numBytes; i++) {
    length = (length << 8) | buf[offset + 1 + i]!
  }
  return { length, bytesRead: 1 + numBytes }
}

export function derDecodeTLV(buf: Buffer, offset: number): DerTLV {
  const tag = buf[offset]!
  const { length, bytesRead } = derDecodeLength(buf, offset + 1)
  const headerLen = 1 + bytesRead
  const value = buf.subarray(offset + headerLen, offset + headerLen + length)
  return { tag, value, totalLength: headerLen + length }
}

export function derDecodeInteger(buf: Buffer): number {
  let val = 0
  for (let i = 0; i < buf.length; i++) {
    val = (val << 8) | buf[i]!
  }
  return val
}

export function derDecodeChildren(buf: Buffer): DerTLV[] {
  const children: DerTLV[] = []
  let offset = 0
  while (offset < buf.length) {
    const tlv = derDecodeTLV(buf, offset)
    children.push(tlv)
    offset += tlv.totalLength
  }
  return children
}

export { TAG_SEQUENCE, TAG_INTEGER, TAG_OCTET_STRING, TAG_UTF8STRING, tagContext }
