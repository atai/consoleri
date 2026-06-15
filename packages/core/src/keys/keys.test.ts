import { describe, expect, it } from 'vitest'
import { authTypeFromCredentialRef } from '../credentials/resolveAuth'
import {
  isKeyFileRef,
  keyFilePassphraseRef,
  keyPathFromRef,
  labelFromKeyPath,
  makeKeyFileRef
} from './credentialRef'
import { isEncryptedPrivateKey, looksLikePrivateKeyContent } from './detectPrivateKey'
import { parsePublicKeyFile, parsePublicKeyLine } from './parsePublicKey'
import { buildKeyDescriptor, shouldScanAsPrivateKey } from './pairKeys'
import { isSshDirSkipName, publicKeyPathForPrivate } from './sshDirArtifacts'
import {
  buildAuthorizedKeysInstallCommand,
  shellEscapeSingleQuoted
} from './shellEscape'
import { stableKeyId } from './stableId'

const SAMPLE_OPENSSH_PRIVATE = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
-----END OPENSSH PRIVATE KEY-----`

const SAMPLE_RSA_PRIVATE = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF4
-----END RSA PRIVATE KEY-----`

const SAMPLE_EC_PRIVATE = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIBK9sample
-----END EC PRIVATE KEY-----`

const SAMPLE_PUB =
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIG10LWZha2Uta2V5LWZvci10ZXN0IG9ubHk= test@host'

describe('credentialRef', () => {
  it('round-trips keyfile refs', () => {
    const path = 'C:/Users/me/.ssh/id_ed25519'
    const ref = makeKeyFileRef(path)
    expect(isKeyFileRef(ref)).toBe(true)
    expect(keyPathFromRef(ref)).toBe(path)
    expect(authTypeFromCredentialRef(ref)).toBe('privateKey')
  })

  it('rejects non-keyfile refs in keyPathFromRef', () => {
    expect(() => keyPathFromRef('profile:1:key')).toThrow(/Not a keyfile ref/)
  })

  it('builds passphrase vault ref', () => {
    expect(keyFilePassphraseRef('/home/u/.ssh/id_rsa')).toBe(
      'keyfile:/home/u/.ssh/id_rsa:passphrase'
    )
  })

  it('extracts label from posix and windows paths', () => {
    expect(labelFromKeyPath('/home/user/.ssh/id_ed25519')).toBe('id_ed25519')
    expect(labelFromKeyPath('C:\\Users\\me\\.ssh\\id_rsa')).toBe('id_rsa')
    expect(labelFromKeyPath('')).toBe('')
  })
})

describe('detectPrivateKey', () => {
  it('detects OpenSSH, RSA, and EC private keys', () => {
    expect(looksLikePrivateKeyContent(SAMPLE_OPENSSH_PRIVATE)).toBe(true)
    expect(looksLikePrivateKeyContent(SAMPLE_RSA_PRIVATE)).toBe(true)
    expect(looksLikePrivateKeyContent(SAMPLE_EC_PRIVATE)).toBe(true)
    expect(looksLikePrivateKeyContent('not a key')).toBe(false)
    expect(looksLikePrivateKeyContent('')).toBe(false)
  })

  it('detects encryption marker', () => {
    const encrypted = `-----BEGIN OPENSSH PRIVATE KEY-----
Proc-Type: 4,ENCRYPTED
-----END OPENSSH PRIVATE KEY-----`
    expect(isEncryptedPrivateKey(encrypted)).toBe(true)
    expect(isEncryptedPrivateKey(SAMPLE_OPENSSH_PRIVATE)).toBe(false)
    expect(isEncryptedPrivateKey('plain text')).toBe(false)
  })
})

describe('sshDirArtifacts', () => {
  it('skips non-key artifacts', () => {
    expect(isSshDirSkipName('config')).toBe(true)
    expect(isSshDirSkipName('known_hosts')).toBe(true)
    expect(isSshDirSkipName('known_hosts.old')).toBe(true)
    expect(isSshDirSkipName('authorized_keys')).toBe(true)
    expect(isSshDirSkipName('environment')).toBe(true)
    expect(isSshDirSkipName('id_ed25519.pub')).toBe(true)
    expect(isSshDirSkipName('id_ed25519')).toBe(false)
  })

  it('derives public key path', () => {
    expect(publicKeyPathForPrivate('/home/u/.ssh/id_rsa')).toBe('/home/u/.ssh/id_rsa.pub')
  })
})

describe('parsePublicKey', () => {
  it('parses type, fingerprint, and comment from a line', () => {
    const parsed = parsePublicKeyLine(SAMPLE_PUB)
    expect(parsed).not.toBeNull()
    expect(parsed!.keyType).toBe('ssh-ed25519')
    expect(parsed!.fingerprint).toMatch(/^SHA256:/)
    expect(parsed!.comment).toBe('test@host')
    expect(parsed!.line).toBe(SAMPLE_PUB)
  })

  it('returns null for invalid lines', () => {
    expect(parsePublicKeyLine('')).toBeNull()
    expect(parsePublicKeyLine('not-a-key')).toBeNull()
    expect(parsePublicKeyLine('ssh-ed25519 !!!')).toBeNull()
  })

  it('parses first non-comment line from file content', () => {
    const file = `# my key\n\n${SAMPLE_PUB}\n`
    const parsed = parsePublicKeyFile(file)
    expect(parsed?.keyType).toBe('ssh-ed25519')
  })

  it('returns null for empty file', () => {
    expect(parsePublicKeyFile('')).toBeNull()
    expect(parsePublicKeyFile('# only comments\n')).toBeNull()
  })
})

describe('pairKeys', () => {
  it('builds descriptor with public key metadata', () => {
    const desc = buildKeyDescriptor({
      id: 'abc',
      privateKeyPath: '/home/u/.ssh/id_ed25519',
      publicKeyPath: '/home/u/.ssh/id_ed25519.pub',
      privateContent: SAMPLE_OPENSSH_PRIVATE,
      publicContent: SAMPLE_PUB,
      source: 'ssh_dir'
    })
    expect(desc).not.toBeNull()
    expect(desc!.label).toBe('id_ed25519')
    expect(desc!.keyType).toBe('ssh-ed25519')
    expect(desc!.fingerprint).toMatch(/^SHA256:/)
    expect(desc!.encrypted).toBe(false)
    expect(desc!.source).toBe('ssh_dir')
    expect(desc!.exists).toBe(true)
  })

  it('returns null for non-key content', () => {
    expect(
      buildKeyDescriptor({
        id: 'x',
        privateKeyPath: '/tmp/not-a-key',
        publicKeyPath: null,
        privateContent: 'hello',
        publicContent: null,
        source: 'custom'
      })
    ).toBeNull()
  })

  it('marks encrypted keys', () => {
    const encrypted = `-----BEGIN OPENSSH PRIVATE KEY-----
Proc-Type: 4,ENCRYPTED
-----END OPENSSH PRIVATE KEY-----`
    const desc = buildKeyDescriptor({
      id: 'enc',
      privateKeyPath: '/home/u/.ssh/id_rsa',
      publicKeyPath: null,
      privateContent: encrypted,
      publicContent: null,
      source: 'ssh_dir'
    })
    expect(desc?.encrypted).toBe(true)
  })

  it('shouldScanAsPrivateKey respects skip list and content', () => {
    expect(shouldScanAsPrivateKey('config', SAMPLE_OPENSSH_PRIVATE)).toBe(false)
    expect(shouldScanAsPrivateKey('id_ed25519', SAMPLE_OPENSSH_PRIVATE)).toBe(true)
    expect(shouldScanAsPrivateKey('id_ed25519', 'not a key')).toBe(false)
  })
})

describe('stableKeyId', () => {
  it('is stable for the same path regardless of separators', () => {
    const a = stableKeyId('C:/Users/me/.ssh/id_rsa')
    const b = stableKeyId('c:\\users\\me\\.ssh\\id_rsa')
    expect(a).toBe(b)
    expect(a).toHaveLength(16)
  })

  it('differs for different paths', () => {
    expect(stableKeyId('/a/id_rsa')).not.toBe(stableKeyId('/b/id_rsa'))
  })
})

describe('shellEscape', () => {
  it('wraps values in single quotes', () => {
    expect(shellEscapeSingleQuoted('ssh-ed25519 AAAA')).toBe("'ssh-ed25519 AAAA'")
  })

  it('escapes embedded single quotes', () => {
    expect(shellEscapeSingleQuoted("it's")).toBe("'it'\\''s'")
  })

  it('builds authorized_keys install command', () => {
    const cmd = buildAuthorizedKeysInstallCommand(SAMPLE_PUB)
    expect(cmd).toContain('mkdir -p ~/.ssh')
    expect(cmd).toContain('chmod 700 ~/.ssh')
    expect(cmd).toContain('grep -qxF')
    expect(cmd).toContain('authorized_keys')
    expect(cmd).toContain('chmod 600 ~/.ssh/authorized_keys')
    expect(cmd).toContain(shellEscapeSingleQuoted(SAMPLE_PUB))
  })
})
