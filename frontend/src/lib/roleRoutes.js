export function defaultRouteForRole(role) {
  if (role === 'driver') return '/driver-trips'
  if (role === 'user') return '/bookings'
  return '/'
}
