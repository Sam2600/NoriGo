export function formatDate(value) {
  if (!value) return '-'
  const [year, month, day] = String(value).split('T')[0].split(' ')[0].split('-').map(Number)
  if (!year || !month || !day) return String(value)
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(year, month - 1, day))
}

export function formatTime(value) {
  if (!value) return '-'
  const [hours, minutes] = String(value).split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return String(value)
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(2000, 0, 1, hours, minutes))
}

export function formatDateTime(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
