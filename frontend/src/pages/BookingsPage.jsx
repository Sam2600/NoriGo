import { CheckCircleIcon, ClipboardDocumentListIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import EmptyState from '../components/EmptyState.jsx'
import Field from '../components/Field.jsx'
import FormAlert from '../components/FormAlert.jsx'
import PageHeader from '../components/PageHeader.jsx'
import SectionPanel from '../components/SectionPanel.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { api } from '../lib/api.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { formatDate, formatTime } from '../lib/dateUtils.js'

function AdminBookings() {
  const queryClient = useQueryClient()
  const [selectedTripId, setSelectedTripId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const tripsQuery = useQuery({
    queryKey: ['admin', 'trips', 'bookings'],
    queryFn: async () => {
      const response = await api.get('/admin/trips')
      return response.data.data
    },
  })

  const trips = tripsQuery.data ?? []

  const activeTripId = selectedTripId || (trips[0]?.id ? String(trips[0].id) : '')

  const bookingsQuery = useQuery({
    queryKey: ['admin', 'trip-bookings', activeTripId],
    queryFn: async () => {
      const response = await api.get(`/admin/trips/${activeTripId}/bookings`)
      return response.data.data
    },
    enabled: Boolean(activeTripId),
  })

  const confirmMutation = useMutation({
    mutationFn: async (bookingId) => {
      await api.post(`/admin/bookings/${bookingId}/confirm`)
    },
    onSuccess: () => {
      setMessage('Booking confirmed.')
      setError('')
      queryClient.invalidateQueries({ queryKey: ['admin', 'trip-bookings', activeTripId] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
    },
    onError: (mutationError) => setError(getApiErrorMessage(mutationError, 'Unable to confirm booking.')),
  })

  const cancelMutation = useMutation({
    mutationFn: async (bookingId) => {
      await api.post(`/admin/bookings/${bookingId}/cancel`)
    },
    onSuccess: () => {
      setMessage('Booking cancelled.')
      setError('')
      queryClient.invalidateQueries({ queryKey: ['admin', 'trip-bookings', activeTripId] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
    },
    onError: (mutationError) => setError(getApiErrorMessage(mutationError, 'Unable to cancel booking.')),
  })

  const selectedTrip = trips.find((trip) => String(trip.id) === activeTripId)
  const bookings = bookingsQuery.data ?? []

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Bookings"
        description="Review passenger bookings by trip and manage confirmation status."
      />

      <SectionPanel title="Trip bookings" icon={ClipboardDocumentListIcon}>
        <div className="space-y-4">
          <FormAlert type="success">{message}</FormAlert>
          <FormAlert>{error}</FormAlert>
          <Field label="Trip" error="">
            <select className="form-input" value={activeTripId} onChange={(event) => setSelectedTripId(event.target.value)}>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {formatDate(trip.trip_date)} {formatTime(trip.departure_time)} {trip.direction} - {trip.bus?.bus_code ?? 'No bus'}
                </option>
              ))}
            </select>
          </Field>
          {selectedTrip ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <span className="font-semibold text-slate-950">{selectedTrip.route_start_location?.name ?? '-'}</span>
              {' to '}
              <span className="font-semibold text-slate-950">{selectedTrip.route_end_location?.name ?? '-'}</span>
            </div>
          ) : null}

          {bookings.length === 0 ? (
            <EmptyState title="No bookings for this trip" description="Passenger bookings appear here after seats are reserved." />
          ) : (
            <div className="table-container">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th>Passenger</th>
                    <th>Pickup</th>
                    <th>Dropoff</th>
                    <th>Status</th>
                    <th>Passenger status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bookings.map((booking) => (
                    <tr key={booking.id}>
                      <td className="font-semibold text-slate-950">{booking.user?.name ?? '-'}</td>
                      <td>{booking.pickup_location?.name ?? '-'}</td>
                      <td>{booking.dropoff_location?.name ?? '-'}</td>
                      <td><StatusBadge value={booking.status} /></td>
                      <td><StatusBadge value={booking.passenger_status?.passenger_status ?? 'waiting'} /></td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="secondary-button px-3 py-2"
                            disabled={confirmMutation.isPending || booking.status === 'confirmed'}
                            onClick={() => confirmMutation.mutate(booking.id)}
                          >
                            <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
                            Confirm
                          </button>
                          <button
                            type="button"
                            className="danger-button px-3 py-2"
                            disabled={cancelMutation.isPending || booking.status === 'cancelled'}
                            onClick={() => cancelMutation.mutate(booking.id)}
                          >
                            <XCircleIcon className="h-4 w-4" aria-hidden="true" />
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SectionPanel>
    </>
  )
}

function PassengerBookings() {
  const queryClient = useQueryClient()
  const [selectedSlotKey, setSelectedSlotKey] = useState('')
  const [pickupLocationId, setPickupLocationId] = useState('')
  const [dropoffLocationId, setDropoffLocationId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const slotsQuery = useQuery({
    queryKey: ['trips', 'upcoming'],
    queryFn: async () => {
      const response = await api.get('/trips/upcoming')
      return response.data.data
    },
  })

  const bookingsQuery = useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      const response = await api.get('/bookings')
      return response.data.data
    },
  })

  const locationsQuery = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const response = await api.get('/locations')
      return response.data.data
    },
  })

  const slots = slotsQuery.data ?? []
  const locations = locationsQuery.data ?? []
  const bookings = bookingsQuery.data ?? []

  const activeSlotKey = selectedSlotKey || (
    slots[0] ? `${slots[0].trip_date}|${slots[0].departure_time}|${slots[0].direction}` : ''
  )
  const selectedSlot = slots.find((slot) => `${slot.trip_date}|${slot.departure_time}|${slot.direction}` === activeSlotKey)

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/bookings', {
        trip_date: selectedSlot.trip_date,
        departure_time: selectedSlot.departure_time,
        direction: selectedSlot.direction,
        pickup_location_id: pickupLocationId || null,
        dropoff_location_id: dropoffLocationId || null,
      })
      return response.data
    },
    onSuccess: (data) => {
      setMessage(data.message ?? 'Booking confirmed.')
      setError('')
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['trips', 'upcoming'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (mutationError) => setError(getApiErrorMessage(mutationError, 'Unable to create booking.')),
  })

  const cancelMutation = useMutation({
    mutationFn: async (bookingId) => {
      await api.post(`/bookings/${bookingId}/cancel`)
    },
    onSuccess: () => {
      setMessage('Booking cancelled.')
      setError('')
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['trips', 'upcoming'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (mutationError) => setError(getApiErrorMessage(mutationError, 'Unable to cancel booking.')),
  })

  return (
    <>
      <PageHeader
        eyebrow="Passenger"
        title="Bookings"
        description="Reserve seats from available scheduled ferry bus slots."
      />

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <SectionPanel title="New booking" icon={ClipboardDocumentListIcon}>
          <div className="space-y-4">
            <FormAlert type="success">{message}</FormAlert>
            <FormAlert>{error}</FormAlert>
            <Field label="Trip slot" error="">
              <select className="form-input" value={activeSlotKey} onChange={(event) => setSelectedSlotKey(event.target.value)}>
                {slots.map((slot) => (
                  <option key={`${slot.trip_date}|${slot.departure_time}|${slot.direction}`} value={`${slot.trip_date}|${slot.departure_time}|${slot.direction}`}>
                    {formatDate(slot.trip_date)} {formatTime(slot.departure_time)} {slot.direction} - {slot.available_seats} seats
                  </option>
                ))}
              </select>
            </Field>
            {selectedSlot ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p><span className="font-semibold text-slate-950">Bus:</span> {selectedSlot.assigned_bus_code ?? 'Pending assignment'}</p>
                <p className="mt-1"><span className="font-semibold text-slate-950">Capacity:</span> {selectedSlot.available_seats} of {selectedSlot.total_seats} seats available</p>
              </div>
            ) : null}
            <Field label="Pickup location" error="">
              <select className="form-input" value={pickupLocationId} onChange={(event) => setPickupLocationId(event.target.value)}>
                <option value="">Use profile default</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Dropoff location" error="">
              <select className="form-input" value={dropoffLocationId} onChange={(event) => setDropoffLocationId(event.target.value)}>
                <option value="">Use profile default</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              className="primary-button"
              disabled={!selectedSlot || selectedSlot.available_seats < 1 || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
              Reserve seat
            </button>
          </div>
        </SectionPanel>

        <SectionPanel title="My bookings" icon={ClipboardDocumentListIcon}>
          {bookings.length === 0 ? (
            <EmptyState title="No bookings yet" description="Reserve an available trip slot to see it here." />
          ) : (
            <div className="table-container">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Direction</th>
                    <th>Bus</th>
                    <th>Locations</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bookings.map((booking) => (
                    <tr key={booking.id}>
                      <td>{formatDate(booking.trip?.trip_date)}</td>
                      <td>{formatTime(booking.trip?.departure_time)}</td>
                      <td className="capitalize">{booking.trip?.direction ?? '-'}</td>
                      <td>{booking.trip?.bus?.bus_code ?? '-'}</td>
                      <td>{booking.pickup_location?.name ?? '-'} to {booking.dropoff_location?.name ?? '-'}</td>
                      <td><StatusBadge value={booking.status} /></td>
                      <td>
                        <button
                          type="button"
                          className="danger-button px-3 py-2"
                          disabled={cancelMutation.isPending || !['pending', 'confirmed'].includes(booking.status)}
                          onClick={() => cancelMutation.mutate(booking.id)}
                        >
                          <XCircleIcon className="h-4 w-4" aria-hidden="true" />
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionPanel>
      </div>
    </>
  )
}

function BookingsPage({ currentUser }) {
  if (currentUser?.role === 'admin') {
    return <AdminBookings />
  }

  return <PassengerBookings />
}

export default BookingsPage
