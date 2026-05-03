export function formatDate(value) {
  if (!value) return '-'
  const [year, month, day] = value.split('T')[0].split('-').map(Number)
  if (!year || !month || !day) return String(value)
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' }).format(
    new Date(year, month - 1, day),
  )
}

export function formatTime(value) {
  if (!value) return '-'
  const [hours, minutes] = value.split(':').map(Number)
  if (isNaN(hours) || isNaN(minutes)) return String(value)
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }).format(
    new Date(2000, 0, 1, hours, minutes),
  )
}

export function formatDateTime(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function addSecondsToTime(timeStr, seconds) {
  if (!timeStr || seconds == null) return null
  const [hours, minutes] = timeStr.split(':').map(Number)
  if (isNaN(hours) || isNaN(minutes)) return null
  const totalSeconds = hours * 3600 + minutes * 60 + seconds
  const h = Math.floor(totalSeconds / 3600) % 24
  const m = Math.floor((totalSeconds % 3600) / 60)
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }).format(
    new Date(2000, 0, 1, h, m),
  )
}
