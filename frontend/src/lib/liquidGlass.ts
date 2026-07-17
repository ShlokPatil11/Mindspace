let cachedSupport: boolean | null = null

export function supportsLiquidGlassRefraction(): boolean {
  if (cachedSupport !== null) return cachedSupport
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') {
    cachedSupport = false
    return false
  }
  cachedSupport = CSS.supports('backdrop-filter', 'url(#a)')
  return cachedSupport
}

export function buildLiquidGlassFilterMarkup(
  filterId: string,
  width: number,
  height: number,
  mapDataUrl: string,
): string {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  return `<svg width="0" height="0" style="position:absolute;overflow:hidden">
    <filter id="${filterId}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feImage href="${mapDataUrl}" x="0" y="0" width="${w}" height="${h}" result="map" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale="18" xChannelSelector="R" yChannelSelector="B" result="disp1" />
      <feColorMatrix in="disp1" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispR" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale="12" xChannelSelector="R" yChannelSelector="B" result="disp2" />
      <feColorMatrix in="disp2" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispG" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale="6" xChannelSelector="R" yChannelSelector="B" result="disp3" />
      <feColorMatrix in="disp3" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="dispB" />
      <feBlend in="dispR" in2="dispG" mode="screen" result="blend1" />
      <feBlend in="blend1" in2="dispB" mode="screen" />
    </filter>
  </svg>`
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function generateDisplacementMapDataUrl(width: number, height: number): string {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  ctx.fillStyle = 'rgb(128, 128, 128)'
  ctx.fillRect(0, 0, w, h)

  const inset = Math.min(w, h) * 0.12
  const radius = Math.min(w, h) * 0.18
  ctx.filter = 'blur(6px)'
  roundRect(ctx, inset, inset, w - inset * 2, h - inset * 2, radius)
  ctx.fill()
  ctx.filter = 'none'

  return canvas.toDataURL('image/png')
}
