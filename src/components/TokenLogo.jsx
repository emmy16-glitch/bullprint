import { useState } from 'react'

export function TokenLogo({ src, size = 'normal' }) {
  const [failed, setFailed] = useState(false)

  return (
    <span className={`tokenLogo tokenLogo--${size}`} aria-hidden="true">
      {failed ? <span className="tokenLogoFallback">$A</span> : <img src={src} alt="" onError={() => setFailed(true)} />}
    </span>
  )
}
