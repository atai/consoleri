import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'path'

// ── electron mock ─────────────────────────────────────────────────────────────

const mockApp = {
  isPackaged: false,
  getPath: vi.fn(),
  getAppPath: vi.fn()
}

vi.mock('electron', () => ({ app: mockApp }))

// Re-import after mock is established
const { getDataDir, getDefaultDataDir, getProductionDataDir } = await import('./paths')

const HOME = path.resolve('/', 'home', 'testuser')
const APP_PATH = path.resolve('/', 'workspace', 'apps', 'desktop')
const PROD_DIR = path.join(HOME, '.consoleri')
const DEV_DIR = path.join(APP_PATH, '.consoleri-dev')

beforeEach(() => {
  mockApp.isPackaged = false
  mockApp.getPath.mockReturnValue(HOME)
  mockApp.getAppPath.mockReturnValue(APP_PATH)
  delete process.env.CONSOLERI_DATA_DIR
})

afterEach(() => {
  delete process.env.CONSOLERI_DATA_DIR
  vi.resetAllMocks()
})

// ── getProductionDataDir ──────────────────────────────────────────────────────

describe('getProductionDataDir', () => {
  it('returns ~/.consoleri', () => {
    expect(getProductionDataDir()).toBe(path.join(HOME, '.consoleri'))
  })
})

// ── getDefaultDataDir ─────────────────────────────────────────────────────────

describe('getDefaultDataDir', () => {
  it('returns .consoleri-dev in dev mode', () => {
    mockApp.isPackaged = false
    expect(getDefaultDataDir()).toBe(path.join(APP_PATH, '.consoleri-dev'))
  })

  it('returns ~/.consoleri when packaged', () => {
    mockApp.isPackaged = true
    expect(getDefaultDataDir()).toBe(path.join(HOME, '.consoleri'))
  })
})

// ── getDataDir ────────────────────────────────────────────────────────────────

describe('getDataDir', () => {
  describe('dev mode (isPackaged = false)', () => {
    it('returns .consoleri-dev when no env var is set', () => {
      expect(getDataDir()).toBe(DEV_DIR)
    })

    it('respects CONSOLERI_DATA_DIR override', () => {
      process.env.CONSOLERI_DATA_DIR = '/custom/dev/data'
      expect(getDataDir()).toBe(path.resolve('/custom/dev/data'))
    })

    it('throws when CONSOLERI_DATA_DIR points at the production directory', () => {
      process.env.CONSOLERI_DATA_DIR = PROD_DIR
      expect(() => getDataDir()).toThrow(/production data directory/)
    })
  })

  describe('packaged mode (isPackaged = true)', () => {
    beforeEach(() => {
      mockApp.isPackaged = true
    })

    it('returns ~/.consoleri when no env var is set', () => {
      expect(getDataDir()).toBe(PROD_DIR)
    })

    it('respects CONSOLERI_DATA_DIR override in production', () => {
      process.env.CONSOLERI_DATA_DIR = '/portable/consoleri-data'
      expect(getDataDir()).toBe(path.resolve('/portable/consoleri-data'))
    })

    it('does NOT throw when CONSOLERI_DATA_DIR points at the default production dir (allowed in packaged mode)', () => {
      process.env.CONSOLERI_DATA_DIR = PROD_DIR
      expect(() => getDataDir()).not.toThrow()
    })
  })
})
