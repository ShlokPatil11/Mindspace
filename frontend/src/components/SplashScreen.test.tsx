import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SplashScreen, SPLASH_DURATION_MS } from './SplashScreen'

describe('SplashScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not call onDone before the splash duration elapses', () => {
    const onDone = vi.fn()
    render(<SplashScreen onDone={onDone} />)

    act(() => {
      vi.advanceTimersByTime(SPLASH_DURATION_MS - 1)
    })
    expect(onDone).not.toHaveBeenCalled()
  })

  it('calls onDone once the splash duration plus fade-out elapses', () => {
    const onDone = vi.fn()
    render(<SplashScreen onDone={onDone} />)

    act(() => {
      vi.advanceTimersByTime(SPLASH_DURATION_MS + 300)
    })
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
