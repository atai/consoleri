import { RDCLEANPATH_VERSION } from '../constants'
import {
  TAG_SEQUENCE,
  derDecodeChildren,
  derDecodeInteger,
  derDecodeTLV,
  derEncodeInteger,
  derEncodeOctetString,
  derEncodeUtf8String,
  derWrap,
  derWrapContext
} from './der'

export interface RDCleanPathRequest {
  destination: string
  proxyAuth: string | null
  x224ConnectionRequest: Buffer
  preconnectionBlob: string | null
}

export function parseRDCleanPathRequest(data: Buffer): RDCleanPathRequest {
  const outer = derDecodeTLV(data, 0)
  if (outer.tag !== TAG_SEQUENCE) {
    throw new Error(`Expected SEQUENCE (0x30), got 0x${outer.tag.toString(16)}`)
  }

  const children = derDecodeChildren(outer.value)

  let version: number | null = null
  let destination: string | null = null
  let proxyAuth: string | null = null
  let x224ConnectionRequest: Buffer | null = null
  let preconnectionBlob: string | null = null

  for (const child of children) {
    const ctxTag = child.tag & 0x1f

    switch (ctxTag) {
      case 0: {
        const intTlv = derDecodeTLV(child.value, 0)
        version = derDecodeInteger(intTlv.value)
        break
      }
      case 2: {
        const strTlv = derDecodeTLV(child.value, 0)
        destination = strTlv.value.toString('utf-8')
        break
      }
      case 3: {
        const strTlv = derDecodeTLV(child.value, 0)
        proxyAuth = strTlv.value.toString('utf-8')
        break
      }
      case 5: {
        const strTlv = derDecodeTLV(child.value, 0)
        preconnectionBlob = strTlv.value.toString('utf-8')
        break
      }
      case 6: {
        const octTlv = derDecodeTLV(child.value, 0)
        x224ConnectionRequest = octTlv.value
        break
      }
    }
  }

  if (version !== RDCLEANPATH_VERSION) {
    throw new Error(
      `Unsupported RDCleanPath version: ${version} (expected ${RDCLEANPATH_VERSION})`
    )
  }
  if (!destination) {
    throw new Error('Missing destination in RDCleanPath request')
  }
  if (!x224ConnectionRequest) {
    throw new Error('Missing x224_connection_pdu in RDCleanPath request')
  }

  return { destination, proxyAuth, x224ConnectionRequest, preconnectionBlob }
}

export function buildRDCleanPathResponse(
  serverAddr: string,
  x224Response: Buffer,
  certChain: Buffer[]
): Buffer {
  const parts: Buffer[] = []

  parts.push(derWrapContext(0, derEncodeInteger(RDCLEANPATH_VERSION)))
  parts.push(derWrapContext(6, derEncodeOctetString(x224Response)))

  const certOctets = certChain.map((cert) => derEncodeOctetString(cert))
  const certSeq = derWrap(TAG_SEQUENCE, Buffer.concat(certOctets))
  parts.push(derWrapContext(7, certSeq))
  parts.push(derWrapContext(9, derEncodeUtf8String(serverAddr)))

  return derWrap(TAG_SEQUENCE, Buffer.concat(parts))
}

export function buildRDCleanPathError(errorCode: number, httpStatusCode?: number): Buffer {
  const errParts: Buffer[] = []
  errParts.push(derWrapContext(0, derEncodeInteger(errorCode)))

  if (httpStatusCode != null) {
    errParts.push(derWrapContext(1, derEncodeInteger(httpStatusCode)))
  }

  const errSeq = derWrap(TAG_SEQUENCE, Buffer.concat(errParts))
  const parts: Buffer[] = []
  parts.push(derWrapContext(0, derEncodeInteger(RDCLEANPATH_VERSION)))
  parts.push(derWrapContext(1, errSeq))

  return derWrap(TAG_SEQUENCE, Buffer.concat(parts))
}
