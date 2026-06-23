/**
 * Smoke tests for ProfileForm.
 *
 * Goal: verify that the correct fields are rendered for each protocol
 * (ssh / rdp / vnc / wsl) and that create vs edit mode shows the right chrome.
 * Business logic (submit, clone, draft) is not tested here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import type { ConnectionProfile, Host } from '@shared/types'

// ── window.consoleri stub ─────────────────────────────────────────────────────
function installConsoleri(vaultEnabled = false) {
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
          enabled: vaultEnabled,
          defaultBackend: 'local',
          url: '',
          authMethod: 'token',
          token: '',
          defaultKvMount: 'secret',
          secretPathPrefix: 'consoleri/profiles',
          tlsSkipVerify: false,
          appRoleRoleId: '',
          appRoleSecretId: ''
        })
      },
      profiles: {
        create: vi.fn().mockResolvedValue({ id: 'new-prof' }),
        update: vi.fn().mockResolvedValue({ id: 'prof-1' })
      }
    },
    writable: true,
    configurable: true
  })
}

// ── Mock PickProfileDialog so it doesn't fetch data ───────────────────────────
vi.mock('./PickProfileDialog', () => ({
  PickProfileDialog: () => null
}))

// ── Helpers ───────────────────────────────────────────────────────────────────
import { ProfileForm } from './ProfileForm'

const noop = vi.fn()

function makeProfile(overrides: Partial<ConnectionProfile> = {}): ConnectionProfile {
  return {
    id: 'prof-1',
    name: 'My Profile',
    protocol: 'ssh',
    shell: null,
    username: 'admin',
    authMethod: 'password',
    credentialRef: null,
    jumpHostId: null,
    extra: {},
    ...overrides
  }
}

function makeHost(overrides: Partial<Host> = {}): Host {
  return {
    id: 'host-1',
    name: 'web01',
    hostname: '10.0.0.1',
    port: 22,
    osType: 'linux',
    tags: [],
    groupId: null,
    notes: '',
    defaultProfileId: null,
    uxProfileId: null,
    logVerbosity: 'info',
    relatedHostIds: [],
    gatewayHostId: null,
    httpEndpoint: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides
  }
}

beforeEach(() => {
  installConsoleri()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ── Create mode: common chrome ────────────────────────────────────────────────
describe('ProfileForm create mode', () => {
  it('shows "Add profile" heading', async () => {
    await act(async () => {
      render(<ProfileForm onSave={noop} onCancel={noop} hosts={[]} />)
    })
    expect(screen.getByText('Add profile')).toBeDefined()
  })

  it('renders a protocol selector with all protocol options', async () => {
    await act(async () => {
      render(<ProfileForm onSave={noop} onCancel={noop} hosts={[]} />)
    })
    // getByRole 'combobox' finds the protocol <select> specifically
    const protocolSelect = screen.getByRole('combobox', { name: /protocol/i })
    expect(protocolSelect).toBeDefined()
    expect(screen.getAllByRole('option', { name: 'rdp' })).toBeDefined()
    expect(screen.getAllByRole('option', { name: 'vnc' })).toBeDefined()
    expect(screen.getAllByRole('option', { name: 'wsl' })).toBeDefined()
  })

  it('renders Name and Username inputs', async () => {
    await act(async () => {
      render(<ProfileForm onSave={noop} onCancel={noop} hosts={[]} />)
    })
    expect(screen.getAllByText('Name').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Username').length).toBeGreaterThan(0)
  })

  it('renders Save and Cancel buttons', async () => {
    await act(async () => {
      render(<ProfileForm onSave={noop} onCancel={noop} hosts={[]} />)
    })
    expect(screen.getAllByRole('button', { name: 'Save' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Cancel' }).length).toBeGreaterThan(0)
  })
})

// ── Edit mode: chrome ─────────────────────────────────────────────────────────
describe('ProfileForm edit mode', () => {
  it('shows "Edit profile" heading when a profile is provided', async () => {
    await act(async () => {
      render(<ProfileForm profile={makeProfile()} onSave={noop} onCancel={noop} hosts={[]} />)
    })
    expect(screen.getByText('Edit profile')).toBeDefined()
  })

  it('shows the protocol as static text (not a selector) in edit mode', async () => {
    await act(async () => {
      render(<ProfileForm profile={makeProfile({ protocol: 'rdp' })} onSave={noop} onCancel={noop} hosts={[]} />)
    })
    // jsdom does not apply CSS text-transform:uppercase, text content stays lowercase
    expect(screen.getByText('rdp')).toBeDefined()
    // No protocol <select> (combobox) accessible by Protocol label
    expect(screen.queryByRole('combobox', { name: /protocol/i })).toBeNull()
  })

  it('pre-fills the name input with the profile name', async () => {
    await act(async () => {
      render(<ProfileForm profile={makeProfile({ name: 'My SSH Prod' })} onSave={noop} onCancel={noop} hosts={[]} />)
    })
    const input = screen.getByDisplayValue('My SSH Prod')
    expect(input).toBeDefined()
  })
})

// ── SSH protocol fields ───────────────────────────────────────────────────────
describe('ProfileForm SSH protocol fields', () => {
  it('shows Auth method selector', async () => {
    await act(async () => {
      render(<ProfileForm onSave={noop} onCancel={noop} hosts={[]} />)
    })
    expect(screen.getAllByText('Auth method').length).toBeGreaterThan(0)
  })

  it('shows Password field when authMethod is password (default)', async () => {
    await act(async () => {
      render(<ProfileForm onSave={noop} onCancel={noop} hosts={[]} />)
    })
    expect(screen.getAllByText('Password').length).toBeGreaterThan(0)
  })

  it('shows Shell field', async () => {
    await act(async () => {
      render(<ProfileForm onSave={noop} onCancel={noop} hosts={[]} />)
    })
    expect(screen.getAllByText('Shell').length).toBeGreaterThan(0)
  })

  it('shows Jump host selector when hosts provided', async () => {
    const hosts = [makeHost({ id: 'h2', name: 'bastion', hostname: 'bastion.local' })]
    await act(async () => {
      render(<ProfileForm onSave={noop} onCancel={noop} hosts={hosts} />)
    })
    expect(screen.getAllByText('Jump host (bastion)').length).toBeGreaterThan(0)
  })

  it('does NOT show RDP port or VNC port fields', async () => {
    await act(async () => {
      render(<ProfileForm onSave={noop} onCancel={noop} hosts={[]} />)
    })
    expect(screen.queryByText('RDP port')).toBeNull()
    expect(screen.queryByText('VNC port')).toBeNull()
  })
})

// ── RDP protocol fields ───────────────────────────────────────────────────────
describe('ProfileForm RDP protocol fields', () => {
  it('shows Auth method and Password fields for RDP', async () => {
    await act(async () => {
      render(<ProfileForm profile={makeProfile({ protocol: 'rdp' })} onSave={noop} onCancel={noop} hosts={[]} />)
    })
    expect(screen.getAllByText('Auth method').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Password').length).toBeGreaterThan(0)
  })

  it('shows RDP port field', async () => {
    await act(async () => {
      render(<ProfileForm profile={makeProfile({ protocol: 'rdp' })} onSave={noop} onCancel={noop} hosts={[]} />)
    })
    expect(screen.getAllByText('RDP port').length).toBeGreaterThan(0)
  })

  it('does NOT show Shell or Jump host fields for RDP', async () => {
    await act(async () => {
      render(<ProfileForm profile={makeProfile({ protocol: 'rdp' })} onSave={noop} onCancel={noop} hosts={[]} />)
    })
    expect(screen.queryByText('Shell')).toBeNull()
    expect(screen.queryByText('Jump host (bastion)')).toBeNull()
  })

  it('does NOT show VNC port field', async () => {
    await act(async () => {
      render(<ProfileForm profile={makeProfile({ protocol: 'rdp' })} onSave={noop} onCancel={noop} hosts={[]} />)
    })
    expect(screen.queryByText('VNC port')).toBeNull()
  })
})

// ── VNC protocol fields ───────────────────────────────────────────────────────
describe('ProfileForm VNC protocol fields', () => {
  it('shows Auth method and Password fields for VNC', async () => {
    await act(async () => {
      render(<ProfileForm profile={makeProfile({ protocol: 'vnc' })} onSave={noop} onCancel={noop} hosts={[]} />)
    })
    expect(screen.getAllByText('Auth method').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Password').length).toBeGreaterThan(0)
  })

  it('shows VNC port field', async () => {
    await act(async () => {
      render(<ProfileForm profile={makeProfile({ protocol: 'vnc' })} onSave={noop} onCancel={noop} hosts={[]} />)
    })
    expect(screen.getAllByText('VNC port').length).toBeGreaterThan(0)
  })

  it('does NOT show Shell, Jump host, or RDP port', async () => {
    await act(async () => {
      render(<ProfileForm profile={makeProfile({ protocol: 'vnc' })} onSave={noop} onCancel={noop} hosts={[]} />)
    })
    expect(screen.queryByText('Shell')).toBeNull()
    expect(screen.queryByText('Jump host (bastion)')).toBeNull()
    expect(screen.queryByText('RDP port')).toBeNull()
  })
})

// ── WSL protocol fields ───────────────────────────────────────────────────────
describe('ProfileForm WSL protocol fields', () => {
  it('shows Shell field for WSL', async () => {
    await act(async () => {
      render(<ProfileForm profile={makeProfile({ protocol: 'wsl' })} onSave={noop} onCancel={noop} hosts={[]} />)
    })
    expect(screen.getAllByText('Shell').length).toBeGreaterThan(0)
  })

  it('does NOT show Auth method for WSL', async () => {
    await act(async () => {
      render(<ProfileForm profile={makeProfile({ protocol: 'wsl' })} onSave={noop} onCancel={noop} hosts={[]} />)
    })
    expect(screen.queryByText('Auth method')).toBeNull()
  })

  it('does NOT show RDP port, VNC port, or Jump host for WSL', async () => {
    await act(async () => {
      render(<ProfileForm profile={makeProfile({ protocol: 'wsl' })} onSave={noop} onCancel={noop} hosts={[]} />)
    })
    expect(screen.queryByText('RDP port')).toBeNull()
    expect(screen.queryByText('VNC port')).toBeNull()
    expect(screen.queryByText('Jump host (bastion)')).toBeNull()
  })
})

// ── Key auth mode ─────────────────────────────────────────────────────────────
describe('ProfileForm key auth mode', () => {
  it('shows SSH key selector when authMethod is key', async () => {
    await act(async () => {
      render(
        <ProfileForm
          profile={makeProfile({ authMethod: 'key' })}
          onSave={noop}
          onCancel={noop}
          hosts={[]}
        />
      )
    })
    expect(screen.getAllByText('SSH key').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Pick key file…').length).toBeGreaterThan(0)
  })

  it('does NOT show Password field when authMethod is key', async () => {
    await act(async () => {
      render(
        <ProfileForm
          profile={makeProfile({ authMethod: 'key' })}
          onSave={noop}
          onCancel={noop}
          hosts={[]}
        />
      )
    })
    expect(screen.queryByText('Password')).toBeNull()
  })
})

// ── Vault backend selector ────────────────────────────────────────────────────
describe('ProfileForm vault backend selector', () => {
  it('does NOT show Secret storage selector when vault is disabled', async () => {
    await act(async () => {
      render(<ProfileForm onSave={noop} onCancel={noop} hosts={[]} />)
    })
    await act(async () => {})
    expect(screen.queryByText('Secret storage')).toBeNull()
  })

  it('shows Secret storage selector when vault is enabled', async () => {
    installConsoleri(true)
    await act(async () => {
      render(<ProfileForm onSave={noop} onCancel={noop} hosts={[]} />)
    })
    await act(async () => {})
    expect(screen.getAllByText('Secret storage').length).toBeGreaterThan(0)
  })
})

// ── Default profile checkbox ──────────────────────────────────────────────────
describe('ProfileForm default profile checkbox', () => {
  it('shows default profile checkbox only in edit mode with linkHostId and host', async () => {
    const host = makeHost({ defaultProfileId: null })
    const profile = makeProfile()
    await act(async () => {
      render(
        <ProfileForm
          profile={profile}
          host={host}
          linkHostId={host.id}
          onSave={noop}
          onCancel={noop}
          hosts={[host]}
        />
      )
    })
    expect(screen.getAllByText('Default profile for this host').length).toBeGreaterThan(0)
  })

  it('does NOT show default profile checkbox in create mode', async () => {
    await act(async () => {
      render(<ProfileForm onSave={noop} onCancel={noop} hosts={[]} />)
    })
    expect(screen.queryByText('Default profile for this host')).toBeNull()
  })
})
