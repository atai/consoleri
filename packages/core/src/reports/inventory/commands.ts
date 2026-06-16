export const INVENTORY_SECTION_OS = '===OS==='
export const INVENTORY_SECTION_RAM = '===RAM==='
export const INVENTORY_SECTION_CPU = '===CPU==='
export const INVENTORY_SECTION_HOSTNAMES = '===HOSTNAMES==='
export const INVENTORY_SECTION_IPV4 = '===IPV4==='
export const INVENTORY_SECTION_IPV6 = '===IPV6==='

/** Single compound shell script to collect inventory data in one SSH exec. */
export function buildInventoryCollectScript(): string {
  return `#!/bin/sh
echo '${INVENTORY_SECTION_OS}'
if [ -f /etc/os-release ]; then
  . /etc/os-release
  if [ -n "$PRETTY_NAME" ]; then
    echo "$PRETTY_NAME"
  elif [ -n "$NAME" ] && [ -n "$VERSION" ]; then
    echo "$NAME - $VERSION"
  elif [ -n "$NAME" ]; then
    echo "$NAME"
  else
    uname -srm 2>/dev/null || uname -a 2>/dev/null
  fi
else
  uname -srm 2>/dev/null || uname -a 2>/dev/null
fi
echo '${INVENTORY_SECTION_RAM}'
if [ -r /proc/meminfo ]; then
  awk '/MemTotal/{print $2*1024}' /proc/meminfo
elif command -v free >/dev/null 2>&1; then
  free -b 2>/dev/null | awk '/^Mem:/{print $2}'
fi
echo '${INVENTORY_SECTION_CPU}'
if [ -r /proc/cpuinfo ]; then
  model=$(awk -F: '/model name/{print $2; exit}' /proc/cpuinfo | sed 's/^ *//')
  cores=$(nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo 2>/dev/null || echo 1)
  if [ -n "$model" ]; then
    echo "$model ($cores cores)"
  else
    echo "$(uname -m) ($cores cores)"
  fi
elif command -v lscpu >/dev/null 2>&1; then
  lscpu 2>/dev/null | awk -F: '/Model name/{gsub(/^ +/,"",$2); model=$2} END{if(model) print model; else print "unknown"}'
else
  uname -m 2>/dev/null
fi
echo '${INVENTORY_SECTION_HOSTNAMES}'
hostname -A 2>/dev/null || hostname -a 2>/dev/null || hostname -f 2>/dev/null || hostname 2>/dev/null
echo '${INVENTORY_SECTION_IPV4}'
if command -v ip >/dev/null 2>&1; then
  ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1
elif command -v ifconfig >/dev/null 2>&1; then
  ifconfig 2>/dev/null | awk '/inet /{print $2}' | grep -v '^127\\.'
elif command -v hostname >/dev/null 2>&1; then
  hostname -I 2>/dev/null | tr ' ' '\\n' | grep -v '^$'
fi
echo '${INVENTORY_SECTION_IPV6}'
if command -v ip >/dev/null 2>&1; then
  ip -6 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1
elif command -v ifconfig >/dev/null 2>&1; then
  ifconfig 2>/dev/null | awk '/inet6 /{print $2}' | grep -v '^::1' | grep -v '^fe80'
fi
`
}
