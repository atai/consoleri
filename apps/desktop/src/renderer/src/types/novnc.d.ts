declare module '@novnc/novnc' {
  export interface RfbCredentials {
    password?: string
    username?: string
    target?: string
  }

  export interface RfbOptions {
    credentials?: RfbCredentials
    shared?: boolean
  }

  export default class RFB {
    constructor(target: HTMLElement, urlOrChannel: string, options?: RfbOptions)
    viewOnly: boolean
    scaleViewport: boolean
    background: string
    addEventListener(type: string, listener: () => void): void
    disconnect(): void
  }
}
