import { Terminal } from '@xterm/xterm'
import { CanvasAddon } from '@xterm/addon-canvas'
import { WebglAddon } from '@xterm/addon-webgl'

type LogLevel = 'warn' | 'error'

function logRendererEvent(
  sessionId: string,
  level: LogLevel,
  message: string,
  err?: unknown
): void {
  if (level === 'warn') {
    console.warn(message, err ?? '')
  } else {
    console.error(message, err ?? '')
  }
  void window.consoleri.sessions.appendLog(sessionId, level, message)
}

function loadCanvasRenderer(term: Terminal, sessionId: string): void {
  try {
    term.loadAddon(new CanvasAddon())
  } catch (err) {
    logRendererEvent(
      sessionId,
      'error',
      'Terminal renderer: canvas unavailable, using DOM renderer',
      err
    )
  }
}

export function attachTerminalRenderer(term: Terminal, sessionId: string): void {
  try {
    const webgl = new WebglAddon()
    webgl.onContextLoss(() => {
      logRendererEvent(
        sessionId,
        'warn',
        'Terminal renderer: WebGL context lost, falling back to canvas'
      )
      webgl.dispose()
      loadCanvasRenderer(term, sessionId)
    })
    term.loadAddon(webgl)
  } catch (err) {
    logRendererEvent(
      sessionId,
      'warn',
      'Terminal renderer: WebGL unavailable, falling back to canvas',
      err
    )
    loadCanvasRenderer(term, sessionId)
  }
}
