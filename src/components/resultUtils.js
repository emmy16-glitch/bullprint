export const short = (value = '') => (value ? `${value.slice(0, 7)}...${value.slice(-7)}` : '—')

export function formatDate(blockTime) {
  return blockTime
    ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(blockTime * 1000))
    : 'Unavailable'
}
