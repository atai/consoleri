import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useProfileFormState } from './useProfileFormState'

function installConsoleri(overrides?: {
  createReject?: Error
}) {
  Object.defineProperty(window, 'consoleri', {
    value: {
      hosts: {
        list: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({})
      },
      keys: {
        list: vi.fn().mockResolvedValue([]),
        pickFile: vi.fn().mockResolvedValue(null)
      },
      vault: {
        getSettings: vi.fn().mockResolvedValue({
          enabled: true,
          defaultBackend: 'vault'
        })
      },
      profiles: {
        create: overrides?.createReject
          ? vi.fn().mockRejectedValue(overrides.createReject)
          : vi.fn().mockResolvedValue({ id: 'new-prof' }),
        update: vi.fn().mockResolvedValue({ id: 'prof-1' })
      }
    },
    writable: true,
    configurable: true
  })
}

describe('useProfileFormState submit errors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('surfaces Vault save failures in formErrors.submit', async () => {
    installConsoleri({ createReject: new Error('permission denied') })
    const onSave = vi.fn()

    const { result } = renderHook(() =>
      useProfileFormState({
        linkHostId: 'host-1',
        onSave
      })
    )

    act(() => {
      result.current.setPassword('secret')
      result.current.setSecretBackend('vault')
    })

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn()
      } as unknown as React.FormEvent)
    })

    expect(result.current.formErrors.submit).toMatch(/permission denied/i)
    expect(result.current.formErrors.submit).toMatch(/Vault log window/i)
    expect(onSave).not.toHaveBeenCalled()
    expect(result.current.saving).toBe(false)
  })
})
