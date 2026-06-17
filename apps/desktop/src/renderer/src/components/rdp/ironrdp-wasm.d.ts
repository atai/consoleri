declare module 'ironrdp-wasm' {
  export class DesktopSize {
    constructor(width: number, height: number)
    readonly width: number
    readonly height: number
  }

  export class Extension {
    constructor(name: string, value: boolean)
  }

  export class DeviceEvent {
    static keyPressed(scancode: number): DeviceEvent
    static keyReleased(scancode: number): DeviceEvent
    static mouseMove(x: number, y: number): DeviceEvent
    static mouseButtonPressed(button: number): DeviceEvent
    static mouseButtonReleased(button: number): DeviceEvent
    static wheelRotations(isVertical: boolean, amount: number, steps: number): DeviceEvent
  }

  export class InputTransaction {
    addEvent(event: DeviceEvent): void
  }

  export interface SessionEndInfo {
    reason(): string
  }

  export interface IronRdpSession {
    desktopSize(): DesktopSize
    run(): Promise<SessionEndInfo>
    shutdown(): void
    applyInputs(transaction: InputTransaction): void
  }

  export class SessionBuilder {
    username(value: string): this
    password(value: string): this
    destination(value: string): this
    proxyAddress(value: string): this
    authToken(value: string): this
    desktopSize(size: DesktopSize): this
    renderCanvas(canvas: HTMLCanvasElement): this
    extension(ext: Extension): this
    setCursorStyleCallback(callback: (style: string) => void): this
    setCursorStyleCallbackContext(context: unknown): this
    connect(): Promise<IronRdpSession>
  }

  export default function initIronRdp(): Promise<void>
}
