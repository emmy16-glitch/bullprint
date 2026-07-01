export function Icon({ name, className = '' }) {
  const paths = {
    wallet: <><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z"/></>,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a1 1 0 0 1 1-1h9"/></>,
    shield: <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z"/>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    alert: <><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10 3h4l8 16H2L10 3Z"/></>,
    external: <><path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></>,
    arrow: <path d="M15 18 9 12l6-6"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>,
    moon: <path d="M21 14.5A8 8 0 0 1 9.5 3 9 9 0 1 0 21 14.5Z"/>,
    close: <path d="M18 6 6 18M6 6l12 12"/>,
  }
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name]}</svg>
}
