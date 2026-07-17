import { ReactNode, useEffect, useRef, useState } from 'react'
import {
  buildLiquidGlassFilterMarkup,
  generateDisplacementMapDataUrl,
  supportsLiquidGlassRefraction,
} from '../lib/liquidGlass'

let filterCounter = 0

interface LiquidGlassProps {
  children: ReactNode
  className?: string
}

export function LiquidGlass({ children, className = '' }: LiquidGlassProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [filterId] = useState(() => `liquid-glass-filter-${filterCounter++}`)
  const [filterMarkup, setFilterMarkup] = useState('')
  const refractionSupported = supportsLiquidGlassRefraction()

  useEffect(() => {
    if (!refractionSupported) return
    const el = wrapperRef.current
    if (!el) return

    function regenerate() {
      if (!el) return
      const { width, height } = el.getBoundingClientRect()
      if (width === 0 || height === 0) return
      const mapDataUrl = generateDisplacementMapDataUrl(width, height)
      setFilterMarkup(buildLiquidGlassFilterMarkup(filterId, width, height, mapDataUrl))
    }

    regenerate()
    const observer = new ResizeObserver(regenerate)
    observer.observe(el)
    return () => observer.disconnect()
  }, [filterId, refractionSupported])

  return (
    <div
      ref={wrapperRef}
      className={`liquid-glass ${refractionSupported ? 'liquid-glass--refract' : 'liquid-glass--fallback'} ${className}`}
      style={refractionSupported ? { backdropFilter: `url(#${filterId})`, WebkitBackdropFilter: `url(#${filterId})` } : undefined}
    >
      {refractionSupported && filterMarkup && <div dangerouslySetInnerHTML={{ __html: filterMarkup }} />}
      {children}
    </div>
  )
}
