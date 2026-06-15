import type { LogEntry } from '../../shared/types'

declare global {
  interface Window {
    logApi: {
      getSessionId: () => string
      getEntries: (sessionId: string) => Promise<LogEntry[]>
      onLog: (cb: (entry: LogEntry) => void) => () => void
    }
  }
}

const logEl = document.getElementById('log')!
const titleEl = document.getElementById('title')!
const sessionId = window.logApi.getSessionId()
titleEl.textContent = `Connection log — ${sessionId.slice(0, 8)}`

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString()
}

function appendEntry(entry: LogEntry): void {
  const div = document.createElement('div')
  div.className = `entry ${entry.level}`
  div.innerHTML = `<span class="ts">${formatTime(entry.timestamp)}</span><span class="lvl">[${entry.level.toUpperCase()}]</span> ${escapeHtml(entry.message)}`
  logEl.appendChild(div)
  logEl.scrollTop = logEl.scrollHeight
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

window.logApi.getEntries(sessionId).then((entries) => {
  logEl.innerHTML = ''
  entries.forEach(appendEntry)
})

window.logApi.onLog((entry) => {
  if (entry.sessionId === sessionId) appendEntry(entry)
})

document.getElementById('clear')!.addEventListener('click', () => {
  logEl.innerHTML = ''
})
