import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildLiquidGlassFilterMarkup, supportsLiquidGlassRefraction } from './liquidGlass'

describe('supportsLiquidGlassRefraction', () => {
  const originalCSS = (globalThis as { CSS?: unknown }).CSS

  afterEach(() => {
    ;(globalThis as { CSS?: unknown }).CSS = originalCSS
  })

  it('returns true when the browser supports backdrop-filter: url()', () => {
    ;(globalThis as { CSS?: unknown }).CSS = { supports: vi.fn().mockReturnValue(true) }
    expect(supportsLiquidGlassRefraction()).toBe(true)
  })
})

describe('buildLiquidGlassFilterMarkup', () => {
  it('embeds the given filter id, width, and height', () => {
    const markup = buildLiquidGlassFilterMarkup('my-filter', 200, 80, 'data:image/png;base64,AAA')
    expect(markup).toContain('id="my-filter"')
    expect(markup).toContain('width="200"')
    expect(markup).toContain('height="80"')
    expect(markup).toContain('data:image/png;base64,AAA')
  })

  it('includes three feDisplacementMap passes at staggered scales', () => {
    const markup = buildLiquidGlassFilterMarkup('f2', 100, 100, 'data:x')
    const matches = markup.match(/feDisplacementMap/g)
    expect(matches?.length).toBe(3)
    expect(markup).toContain('scale="18"')
    expect(markup).toContain('scale="12"')
    expect(markup).toContain('scale="6"')
  })

  it('recombines channels with feBlend mode="screen"', () => {
    const markup = buildLiquidGlassFilterMarkup('f3', 100, 100, 'data:x')
    const matches = markup.match(/feBlend[^>]*mode="screen"/g)
    expect(matches?.length).toBe(2)
  })
})
