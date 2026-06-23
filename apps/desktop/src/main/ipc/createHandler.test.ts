import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createHandler } from './createHandler'

describe('createHandler(schema, fn)', () => {
  it('calls fn with parsed args when payload is valid', async () => {
    const schema = z.object({ name: z.string(), port: z.number() })
    const fn = vi.fn(async (args: z.infer<typeof schema>) => ({ ok: true, name: args.name }))
    const handler = createHandler(schema, fn)

    const result = await handler({} as Electron.IpcMainInvokeEvent, { name: 'web01', port: 22 })
    expect(fn).toHaveBeenCalledOnce()
    expect(fn).toHaveBeenCalledWith({ name: 'web01', port: 22 })
    expect(result).toEqual({ ok: true, name: 'web01' })
  })

  it('does NOT call fn and throws when payload fails schema', async () => {
    const schema = z.object({ name: z.string(), port: z.number() })
    const fn = vi.fn()
    const handler = createHandler(schema, fn)

    await expect(
      handler({} as Electron.IpcMainInvokeEvent, { name: 'web01', port: 'not-a-number' })
    ).rejects.toThrow()
    expect(fn).not.toHaveBeenCalled()
  })

  it('does NOT call fn when required field is missing', async () => {
    const schema = z.object({ id: z.string() })
    const fn = vi.fn()
    const handler = createHandler(schema, fn)

    await expect(handler({} as Electron.IpcMainInvokeEvent, {})).rejects.toThrow()
    expect(fn).not.toHaveBeenCalled()
  })

  it('passes coerced/transformed values from schema to fn', async () => {
    const schema = z.object({ id: z.string().trim() })
    const fn = vi.fn(async (args: z.infer<typeof schema>) => args.id)
    const handler = createHandler(schema, fn)

    await handler({} as Electron.IpcMainInvokeEvent, { id: '  abc  ' })
    expect(fn).toHaveBeenCalledWith({ id: 'abc' })
  })

  it('supports handlers that receive spread positional args', async () => {
    // Some IPC handlers are called with (_event, id, patch) — support tuple schemas
    const schema = z.tuple([z.string(), z.object({ name: z.string() })])
    const fn = vi.fn(async (args: [string, { name: string }]) => args[0])
    const handler = createHandler(schema, fn)

    const result = await handler({} as Electron.IpcMainInvokeEvent, 'host-1', { name: 'updated' })
    expect(fn).toHaveBeenCalledWith(['host-1', { name: 'updated' }])
    expect(result).toBe('host-1')
  })

  it('propagates errors thrown by fn without wrapping them unexpectedly', async () => {
    const schema = z.object({ id: z.string() })
    const fn = vi.fn(async () => {
      throw new Error('repo failed')
    })
    const handler = createHandler(schema, fn)

    await expect(handler({} as Electron.IpcMainInvokeEvent, { id: 'x' })).rejects.toThrow(
      'repo failed'
    )
  })
})

// ── credentials:store / credentials:delete access-policy ────────────────────
//
// These tests define the INTENDED policy before the behaviour is locked in.
// They exercise the validateCredentialRef guard that will be added to those
// handlers in the refactor phase.

import { validateCredentialRef } from './credentialPolicy'

describe('validateCredentialRef (credentials:store / credentials:delete policy)', () => {
  it('accepts profile: prefix', () => {
    expect(() => validateCredentialRef('profile:abc-123:password')).not.toThrow()
  })

  it('accepts keyfile: prefix', () => {
    expect(() => validateCredentialRef('keyfile:/home/user/.ssh/id_rsa:passphrase')).not.toThrow()
  })

  it('accepts vault: prefix', () => {
    expect(() =>
      validateCredentialRef('vault:kv2:secret/consoleri/profiles/abc:password')
    ).not.toThrow()
  })

  it('rejects arbitrary strings that do not match known prefixes', () => {
    expect(() => validateCredentialRef('../../etc/passwd')).toThrow()
    expect(() => validateCredentialRef('')).toThrow()
    expect(() => validateCredentialRef('random:stuff')).toThrow()
  })

  it('rejects null and undefined', () => {
    expect(() => validateCredentialRef(null as unknown as string)).toThrow()
    expect(() => validateCredentialRef(undefined as unknown as string)).toThrow()
  })
})
