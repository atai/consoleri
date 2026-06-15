/** Escape a value for safe use inside single-quoted POSIX shell arguments. */
export function shellEscapeSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/** Remote shell script to append a public key to authorized_keys idempotently. */
export function buildAuthorizedKeysInstallCommand(pubkeyLine: string): string {
  const escaped = shellEscapeSingleQuoted(pubkeyLine)
  return [
    'mkdir -p ~/.ssh',
    'chmod 700 ~/.ssh',
    `grep -qxF ${escaped} ~/.ssh/authorized_keys 2>/dev/null || echo ${escaped} >> ~/.ssh/authorized_keys`,
    'chmod 600 ~/.ssh/authorized_keys'
  ].join(' && ')
}
