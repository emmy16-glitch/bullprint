import { useState } from 'react'

const TOKEN_LOGO_URL = 'https://i2c.seadn.io/solana/9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump/e3a24600cfff57519b009053cb0094/78e3a24600cfff57519b009053cb0094.avif?h=128&w=128'

export default function TokenLogo({ compact = false }) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <span className={`token-logo ${compact ? 'token-logo--compact' : ''}`} aria-hidden="true">
      {!imageFailed ? (
        <img
          src={TOKEN_LOGO_URL}
          alt=""
          width="128"
          height="128"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            objectFit: 'cover',
            borderRadius: '50%',
          }}
        />
      ) : (
        <svg viewBox="0 0 64 64" role="presentation" focusable="false">
          <path d="M6 11c8 2 14 7 18 16" />
          <path d="M58 11c-8 2-14 7-18 16" />
          <path className="fill" d="M18 29c2-9 9-15 14-15s12 6 14 15c2 8-2 16-14 22C20 45 16 37 18 29Z" />
          <circle cx="26" cy="31" r="2" />
          <circle cx="38" cy="31" r="2" />
          <path d="M26 41c4 3 8 3 12 0" />
        </svg>
      )}
    </span>
  )
}
