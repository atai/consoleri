import type { Terminal } from '@xterm/xterm'

async function copySelection(term: Terminal): Promise<void> {
  const selection = term.getSelection()
  if (selection) {
    await window.consoleri.clipboard.writeText(selection)
  }
}

async function pasteFromClipboard(term: Terminal): Promise<void> {
  const text = await window.consoleri.clipboard.readText()
  if (text) {
    term.paste(text)
  }
}

function isExplicitCopy(e: KeyboardEvent): boolean {
  return (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c'
}

function isExplicitPaste(e: KeyboardEvent): boolean {
  return (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'v'
}

function isCtrlC(e: KeyboardEvent): boolean {
  return (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !e.shiftKey && !e.altKey
}

function isCtrlV(e: KeyboardEvent): boolean {
  return (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && !e.shiftKey && !e.altKey
}

function isCtrlInsert(e: KeyboardEvent): boolean {
  return e.ctrlKey && e.key === 'Insert'
}

function isShiftInsert(e: KeyboardEvent): boolean {
  return e.shiftKey && e.key === 'Insert'
}

export interface ClipboardHandlers {
  dispose: () => void
}

export function attachClipboardHandlers(
  term: Terminal,
  container: HTMLElement
): ClipboardHandlers {
  term.attachCustomKeyEventHandler((event) => {
    if (event.type !== 'keydown') return true

    if (isExplicitCopy(event) || isCtrlInsert(event)) {
      void copySelection(term)
      return false
    }

    if (isExplicitPaste(event) || isShiftInsert(event)) {
      void pasteFromClipboard(term)
      return false
    }

    if (isCtrlC(event) && term.hasSelection()) {
      void copySelection(term)
      return false
    }

    if (isCtrlV(event)) {
      void pasteFromClipboard(term)
      return false
    }

    return true
  })

  let menuEl: HTMLDivElement | null = null

  const removeMenu = (): void => {
    if (menuEl) {
      menuEl.remove()
      menuEl = null
    }
  }

  const showContextMenu = (x: number, y: number): void => {
    removeMenu()
    menuEl = document.createElement('div')
    menuEl.className =
      'fixed z-50 min-w-[120px] rounded border border-[#30363d] bg-[#161b22] py-1 text-sm shadow-lg'
    menuEl.style.left = `${x}px`
    menuEl.style.top = `${y}px`

    const addItem = (label: string, action: () => void): void => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.textContent = label
      btn.className = 'block w-full px-3 py-1.5 text-left text-gray-200 hover:bg-[#21262d]'
      btn.addEventListener('click', () => {
        action()
        removeMenu()
      })
      menuEl!.appendChild(btn)
    }

    addItem('Copy', () => void copySelection(term))
    addItem('Paste', () => void pasteFromClipboard(term))

    document.body.appendChild(menuEl)
  }

  const onContextMenu = (e: MouseEvent): void => {
    e.preventDefault()
    showContextMenu(e.clientX, e.clientY)
  }

  const onDocumentClick = (): void => removeMenu()

  container.addEventListener('contextmenu', onContextMenu)
  document.addEventListener('click', onDocumentClick)

  return {
    dispose: () => {
      term.attachCustomKeyEventHandler(() => true)
      container.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('click', onDocumentClick)
      removeMenu()
    }
  }
}
