export function stopsFromBooking(booking) {
  return [
    stopFromLocation(booking?.pickup_location, booking, 'pickup'),
    stopFromLocation(booking?.dropoff_location, booking, 'dropoff'),
  ].filter(Boolean)
}

export function stopsFromBookings(bookings = []) {
  const pickupStops = bookings
    .map((booking) => stopFromLocation(booking?.pickup_location, booking, 'pickup'))
    .filter(Boolean)
  const dropoffStops = bookings
    .map((booking) => stopFromLocation(booking?.dropoff_location, booking, 'dropoff'))
    .filter(Boolean)

  return [...pickupStops, ...dropoffStops]
}

function stopFromLocation(location, booking, type) {
  if (!hasCoordinates(location)) {
    return null
  }

  return {
    booking_id: booking?.id,
    location_id: location.id,
    type,
    name: location.name,
    address: location.address,
    latitude: location.latitude,
    longitude: location.longitude,
    passenger_name: booking?.user?.name,
    passenger_status: booking?.status,
  }
}

function hasCoordinates(location) {
  return location?.latitude !== null && location?.latitude !== undefined
    && location?.longitude !== null && location?.longitude !== undefined
}
