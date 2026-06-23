import type { IronRdpSession } from 'ironrdp-wasm'
import { canvasPointerPosition, resolveRdpScancode, wheelRotationAmount } from './rdpInput'

export interface IronRdpInputApi {
  DeviceEvent: typeof import('ironrdp-wasm').DeviceEvent
  InputTransaction: typeof import('ironrdp-wasm').InputTransaction
  RotationUnit: typeof import('ironrdp-wasm').RotationUnit
}

/**
 * Attaches keyboard, mouse, and wheel event listeners to the canvas and
 * forwards them as IronRDP DeviceEvents. Returns a cleanup function that
 * removes all registered listeners.
 */
export function attachInputHandlers(
  canvas: HTMLCanvasElement,
  getSession: () => IronRdpSession | null,
  api: IronRdpInputApi
): () => void {
  const { DeviceEvent, InputTransaction, RotationUnit } = api

  const applyEvent = (event: InstanceType<typeof DeviceEvent>): void => {
    const active = getSession()
    if (!active) return
    const tx = new InputTransaction()
    tx.addEvent(event)
    active.applyInputs(tx)
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    const scancode = resolveRdpScancode(e.code)
    if (scancode === null) return
    applyEvent(DeviceEvent.keyPressed(scancode))
  }

  const onKeyUp = (e: KeyboardEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    const scancode = resolveRdpScancode(e.code)
    if (scancode === null) return
    applyEvent(DeviceEvent.keyReleased(scancode))
  }

  const onMouseMove = (e: MouseEvent): void => {
    const { x, y } = canvasPointerPosition(canvas, e.clientX, e.clientY)
    applyEvent(DeviceEvent.mouseMove(x, y))
  }

  const onMouseDown = (e: MouseEvent): void => {
    e.preventDefault()
    canvas.focus()
    applyEvent(DeviceEvent.mouseButtonPressed(e.button))
  }

  const onMouseUp = (e: MouseEvent): void => {
    e.preventDefault()
    applyEvent(DeviceEvent.mouseButtonReleased(e.button))
  }

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    if (e.deltaY !== 0) {
      applyEvent(DeviceEvent.wheelRotations(true, wheelRotationAmount(e.deltaY), RotationUnit.Line))
    }
    if (e.deltaX !== 0) {
      applyEvent(DeviceEvent.wheelRotations(false, wheelRotationAmount(e.deltaX), RotationUnit.Line))
    }
  }

  const onContextMenu = (e: MouseEvent): void => {
    e.preventDefault()
  }

  canvas.tabIndex = 0
  canvas.addEventListener('keydown', onKeyDown)
  canvas.addEventListener('keyup', onKeyUp)
  canvas.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('mousedown', onMouseDown)
  canvas.addEventListener('mouseup', onMouseUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('contextmenu', onContextMenu)

  return () => {
    canvas.removeEventListener('keydown', onKeyDown)
    canvas.removeEventListener('keyup', onKeyUp)
    canvas.removeEventListener('mousemove', onMouseMove)
    canvas.removeEventListener('mousedown', onMouseDown)
    canvas.removeEventListener('mouseup', onMouseUp)
    canvas.removeEventListener('wheel', onWheel)
    canvas.removeEventListener('contextmenu', onContextMenu)
  }
}
