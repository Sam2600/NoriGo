import { CheckCircleIcon, PlayIcon, UserIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import EmptyState from '../components/EmptyState.jsx'
import FormAlert from '../components/FormAlert.jsx'
import PageHeader from '../components/PageHeader.jsx'
import SectionPanel from '../components/SectionPanel.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { api } from '../lib/api.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { formatDate, formatTime } from '../lib/dateUtils.js'

const passengerStatuses = [
  { value: 'waiting', label: 'Waiting' },
  { value: 'picked_up', label: 'Picked up' },
  { value: 'absent', label: 'Absent' },
  { value: 'dropped_off', label: 'Dropped off' },
]

function DriverTripsPage() {
  const queryClient = useQueryClient()
  const [selectedTripId, setSelectedTripId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const tripsQuery = useQuery({
    queryKey: ['driver', 'trips'],
    queryFn: async () => {
      const response = await api.get('/driver/trips')
      return response.data.data
    },
  })

  const trips = tripsQuery.data ?? []

  const activeTripId = selectedTripId || (trips[0]?.id ? String(trips[0].id) : '')

  const detailQuery = useQuery({
    queryKey: ['driver', 'trips', activeTripId],
    queryFn: async () => {
      const response = await api.get(`/driver/trips/${activeTripId}`)
      return response.data.data
    },
    enabled: Boolean(activeTripId),
  })

  const startMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/driver/trips/${activeTripId}/start`)
    },
    onSuccess: () => {
      setMessage('Trip started.')
      setError('')
      queryClient.invalidateQueries({ queryKey: ['driver', 'trips'] })
      queryClient.invalidateQueries({ queryKey: ['driver', 'trips', activeTripId] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (mutationError) => setError(getApiErrorMessage(mutationError, 'Unable to start trip.')),
  })

  const completeMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/driver/trips/${activeTripId}/complete`)
    },
    onSuccess: () => {
      setMessage('Trip completed.')
      setError('')
      queryClient.invalidateQueries({ queryKey: ['driver', 'trips'] })
      queryClient.invalidateQueries({ queryKey: ['driver', 'trips', activeTripId] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (mutationError) => setError(getApiErrorMessage(mutationError, 'Unable to complete trip.')),
  })

  const passengerStatusMutation = useMutation({
    mutationFn: async ({ bookingId, passengerStatus }) => {
      await api.post(`/driver/trips/${activeTripId}/passengers/${bookingId}/status`, {
        passenger_status: passengerStatus,
      })
    },
    onSuccess: () => {
      setMessage('Passenger status updated.')
      setError('')
      queryClient.invalidateQueries({ queryKey: ['driver', 'trips', activeTripId] })
    },
    onError: (mutationError) => setError(getApiErrorMessage(mutationError, 'Unable to update passenger.')),
  })

  const selectedTrip = detailQuery.data

  return (
    <>
      <PageHeader
        eyebrow="Driver"
        title="My Trips"
        description="Start assigned trips, update passengers, and complete the workflow."
      />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <SectionPanel title="Assigned trips" icon={PlayIcon}>
          {trips.length === 0 ? (
            <EmptyState title="No active trips" description="Assigned scheduled trips appear here." />
          ) : (
            <div className="space-y-3">
              {trips.map((trip) => (
                <button
                  key={trip.id}
                  type="button"
                  className={`w-full rounded-lg border p-4 text-left transition ${
                    String(trip.id) === activeTripId
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                  onClick={() => setSelectedTripId(String(trip.id))}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{formatDate(trip.trip_date)}</p>
                      <p className="mt-1 text-sm text-slate-500">{formatTime(trip.departure_time)} - {trip.direction}</p>
                    </div>
                    <StatusBadge value={trip.status} />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{trip.bus?.bus_code ?? '-'} - {trip.route_start_location?.name ?? '-'} to {trip.route_end_location?.name ?? '-'}</p>
                </button>
              ))}
            </div>
          )}
        </SectionPanel>

        <SectionPanel
          title="Trip workflow"
          icon={CheckCircleIcon}
          actions={
            selectedTrip ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="primary-button"
                  disabled={selectedTrip.status !== 'scheduled' || startMutation.isPending}
                  onClick={() => startMutation.mutate()}
                >
                  <PlayIcon className="h-4 w-4" aria-hidden="true" />
                  Start
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={selectedTrip.status !== 'started' || completeMutation.isPending}
                  onClick={() => completeMutation.mutate()}
                >
                  <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
                  Complete
                </button>
              </div>
            ) : null
          }
        >
          <div className="space-y-4">
            <FormAlert type="success">{message}</FormAlert>
            <FormAlert>{error}</FormAlert>

            {!selectedTrip ? (
              <EmptyState title="Select a trip" description="Choose an assigned trip to manage passengers." />
            ) : (
              <>
                <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
                  <p><span className="font-semibold text-slate-950">Date:</span> {formatDate(selectedTrip.trip_date)}</p>
                  <p><span className="font-semibold text-slate-950">Time:</span> {formatTime(selectedTrip.departure_time)}</p>
                  <p><span className="font-semibold text-slate-950">Bus:</span> {selectedTrip.bus?.bus_code ?? '-'}</p>
                  <p><span className="font-semibold text-slate-950">Status:</span> <StatusBadge value={selectedTrip.status} /></p>
                  <p className="sm:col-span-2"><span className="font-semibold text-slate-950">Route:</span> {selectedTrip.route_start_location?.name ?? '-'} to {selectedTrip.route_end_location?.name ?? '-'}</p>
                </div>

                {(selectedTrip.bookings ?? []).length === 0 ? (
                  <EmptyState title="No passengers" description="Confirmed passengers appear here." />
                ) : (
                  <div className="table-container">
                    <table className="min-w-full divide-y divide-slate-100">
                      <thead className="bg-slate-50">
                        <tr>
                          <th>Passenger</th>
                          <th>Pickup</th>
                          <th>Dropoff</th>
                          <th>Booking</th>
                          <th>Passenger status</th>
                          <th>Update</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedTrip.bookings.map((booking) => (
                          <tr key={booking.id}>
                            <td className="font-semibold text-slate-950">
                              <span className="inline-flex items-center gap-2">
                                <UserIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
                                {booking.user?.name ?? '-'}
                              </span>
                            </td>
                            <td>{booking.pickup_location?.name ?? '-'}</td>
                            <td>{booking.dropoff_location?.name ?? '-'}</td>
                            <td><StatusBadge value={booking.status} /></td>
                            <td><StatusBadge value={booking.passenger_status?.passenger_status ?? 'waiting'} /></td>
                            <td>
                              <select
                                className="form-input min-w-36"
                                value={booking.passenger_status?.passenger_status ?? 'waiting'}
                                disabled={passengerStatusMutation.isPending}
                                onChange={(event) => passengerStatusMutation.mutate({
                                  bookingId: booking.id,
                                  passengerStatus: event.target.value,
                                })}
                              >
                                {passengerStatuses.map((status) => (
                                  <option key={status.value} value={status.value}>{status.label}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </SectionPanel>
      </div>
    </>
  )
}

export default DriverTripsPage
