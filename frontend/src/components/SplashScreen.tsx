import { useEffect, useState } from 'react'

export const SPLASH_DURATION_MS = 1800

interface SplashScreenProps {
  onDone: () => void
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [fadingOut, setFadingOut] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadingOut(true), SPLASH_DURATION_MS)
    const doneTimer = setTimeout(onDone, SPLASH_DURATION_MS + 300)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
    }
  }, [onDone])

  return (
    <div className={`splash ${fadingOut ? 'splash--fading' : ''}`}>
      <span className="splash-wordmark">MINDSPACE</span>
      <div className="splash-progress">
        <div className="splash-progress-bar" />
      </div>
    </div>
  )
}
