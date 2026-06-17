import { describe, expect, it } from 'vitest'
import {
  canvasPointerPosition,
  resolveRdpScancode,
  wheelRotationAmount
} from './rdpInput'

describe('resolveRdpScancode', () => {
  it('maps common keys', () => {
    expect(resolveRdpScancode('Enter')).toBe(0x1c)
    expect(resolveRdpScancode('Space')).toBe(0x39)
    expect(resolveRdpScancode('UnknownKey')).toBeNull()
  })
})

describe('canvasPointerPosition', () => {
  it('scales client coordinates to canvas pixels', () => {
    const canvas = {
      width: 1600,
      height: 900,
      getBoundingClientRect: () => ({
        left: 10,
        top: 20,
        width: 800,
        height: 450
      })
    } as HTMLCanvasElement

    expect(canvasPointerPosition(canvas, 410, 470)).toEqual({ x: 800, y: 900 })
  })
})

describe('wheelRotationAmount', () => {
  it('normalizes wheel delta direction', () => {
    expect(wheelRotationAmount(120)).toBe(-1)
    expect(wheelRotationAmount(-120)).toBe(1)
  })
})
