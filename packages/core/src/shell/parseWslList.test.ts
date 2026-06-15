import { describe, expect, it } from 'vitest'
import { parseWslListOutput } from './parseWslList'

describe('parseWslListOutput', () => {
  it('parses wsl -l -v style output', () => {
    const stdout = `  NAME      STATE           VERSION\n* Ubuntu    Running         2\n  Debian    Stopped         2\n`
    const distros = parseWslListOutput(stdout)
    expect(distros).toEqual([
      { name: 'Ubuntu', state: 'Running', version: 2 },
      { name: 'Debian', state: 'Stopped', version: 2 }
    ])
  })

  it('returns empty for header only', () => {
    expect(parseWslListOutput('  NAME      STATE           VERSION\n')).toEqual([])
  })
})
