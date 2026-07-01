export function Icon({ name, className = '' }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    shield: <><path d="M12 3 19 6v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></>,
    external: <><path d="M14 4h6v6" /><path d="m20 4-9 9" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></>,
    wallet: <><path d="M4 7h14a2 2 0 0 1 2 2v10H6a2 2 0 0 1-2-2V7Z" /><path d="M4 7V5a2 2 0 0 1 2-2h10v4" /><path d="M15 13h5" /></>,
    check: <path d="m5 12.5 4.2 4L19 7" />,
    close: <><path d="m7 7 10 10" /><path d="M17 7 7 17" /></>,
    alert: <><path d="M12 4 3 20h18L12 4Z" /><path d="M12 9v5" /><path d="M12 17h.01" /></>,
    arrow: <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
    receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /></>,
  }

  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}
