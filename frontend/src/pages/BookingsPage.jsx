import {
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  BellAlertIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState.jsx'
import PageHeader from '../components/PageHeader.jsx'
import SectionPanel from '../components/SectionPanel.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import ConfirmationModal from '../components/ConfirmationModal.jsx'
import { api } from '../lib/api.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { addSecondsToTime, formatDate, formatTime } from '../lib/dateUtils.js'

function BookingsPage({ user }) {
  if (user?.role === 'admin') {
    return <AdminBookingsPage />
  }

  return <PassengerBookingsPage />
}

function AdminBookingsPage() {
  const queryClient = useQueryClient()
  const [selectedTripId, setSelectedTripId] = useState('')
  const [selectedFleetTripIds, setSelectedFleetTripIds] = useState([])
  const [rebalanceResult, setRebalanceResult] = useState(null)
  const [message, setMessage] = useState('')
  const [serverError, setServerError] = useState('')
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: '', id: null, title: '', description: '' })

  const tripsQuery = useQuery({
    queryKey: ['admin-trips'],
    queryFn: async () => {
      const response = await api.get('/admin/trips')
      return response.data.data
    },
  })
  const trips = useMemo(() => tripsQuery.data || [], [tripsQuery.data])
  const activeTripId = selectedTripId || (trips.length ? String(trips[0].id) : '')
  const selectedTrip = useMemo(
    () => trips.find((trip) => String(trip.id) === String(activeTripId)),
    [trips, activeTripId],
  )
  const tripBookingsQuery = useQuery({
    queryKey: ['admin-trip-bookings', activeTripId],
    queryFn: async () => {
      const response = await api.get(`/admin/trips/${activeTripId}/bookings`)
      return response.data.data
    },
    enabled: Boolean(activeTripId),
  })
  const cancelBooking = useMutation({
    mutationFn: async (bookingId) => api.post(`/admin/bookings/${bookingId}/cancel`),
    onSuccess: async () => {
      await invalidateAdminBookingData(queryClient, activeTripId)
      setMessage('Booking cancelled successfully.')
      setServerError('')
    },
    onError: (error) => {
      setMessage('')
      setServerError(getApiErrorMessage(error, 'Unable to cancel booking.'))
    },
  })
  const bookings = tripBookingsQuery.data || []
  const confirmedCount = bookings.filter((booking) => booking.status === 'confirmed').length
  const activeBookingCount = bookings.filter((booking) => ['pending', 'confirmed'].includes(booking.status)).length
  const compatibleTrips = useMemo(() => {
    if (!selectedTrip) {
      return []
    }

    return trips.filter((trip) => (
      trip.status === 'scheduled'
      && trip.trip_date === selectedTrip.trip_date
      && trip.departure_time === selectedTrip.departure_time
      && trip.direction === selectedTrip.direction
    ))
  }, [selectedTrip, trips])
  const compatibleTripIds = useMemo(
    () => compatibleTrips.map((trip) => String(trip.id)),
    [compatibleTrips],
  )
  const activeFleetTripIds = useMemo(() => {
    const filteredSelection = selectedFleetTripIds.filter((tripId) => compatibleTripIds.includes(String(tripId)))

    return filteredSelection.length ? filteredSelection : compatibleTripIds
  }, [compatibleTripIds, selectedFleetTripIds])
  const rebalanceFleet = useMutation({
    mutationFn: async ({ apply }) => {
      const response = await api.post('/admin/trips/rebalance-assignments', {
        trip_ids: activeFleetTripIds.map((tripId) => Number(tripId)),
        apply,
      })

      return response.data.data
    },
    onSuccess: async (data) => {
      setRebalanceResult(data)
      setMessage(data.applied ? 'Fleet assignments rebalanced successfully.' : 'Fleet assignment preview ready.')
      setServerError('')

      if (data.applied) {
        await queryClient.invalidateQueries({ queryKey: ['admin-trips'] })
        await queryClient.invalidateQueries({ queryKey: ['admin-trip-bookings'] })
        await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      }
    },
    onError: (error) => {
      setMessage('')
      setServerError(getApiErrorMessage(error, 'Unable to rebalance fleet assignments.'))
    },
  })
  const notifyBusAssignments = useMutation({
    mutationFn: async (tripIds) => {
      const response = await api.post('/admin/trips/bus-assignments/notify', {
        trip_ids: tripIds.map((tripId) => Number(tripId)),
      })

      return response.data
    },
    onSuccess: async (payload) => {
      setMessage(payload.message || 'Bus assignment notifications sent.')
      setServerError('')
      await invalidateAdminBookingData(queryClient, activeTripId)
    },
    onError: (error) => {
      setMessage('')
      setServerError(getApiErrorMessage(error, 'Unable to notify bus assignments.'))
    },
  })

  function toggleFleetTrip(tripId) {
    const normalizedTripId = String(tripId)
    const baseSelection = activeFleetTripIds.length ? activeFleetTripIds : compatibleTripIds

    setSelectedFleetTripIds(
      baseSelection.includes(normalizedTripId)
        ? baseSelection.filter((selectedId) => selectedId !== normalizedTripId)
        : [...baseSelection, normalizedTripId],
    )
    setRebalanceResult(null)
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Demand Management"
        title="Booking Control"
        description="View confirmed bookings and manage seat assignments for each scheduled transit cycle."
      />

      <SectionPanel
        title="Cycle Review & Verification"
        description="Select a transit cycle to view the confirmed passenger manifest."
        icon={ClipboardDocumentListIcon}
        actions={(
          <div className="relative">
            <select
              className="form-input md:min-w-[450px] font-bold text-slate-900 pr-10 appearance-none bg-slate-50 border-slate-200"
              value={activeTripId}
              onChange={(event) => {
                setSelectedTripId(event.target.value)
                setSelectedFleetTripIds([])
                setRebalanceResult(null)
                setMessage('')
                setServerError('')
              }}
            >
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {formatDate(trip.trip_date)} {formatTime(trip.departure_time)} — {trip.direction.toUpperCase()} — {trip.bus?.bus_code || 'UNASSIGNED'}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <CalendarDaysIcon className="h-5 w-5" />
            </div>
          </div>
        )}
      >

        {selectedTrip ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <SummaryItem label="Scheduled Cycle" value={`${formatDate(selectedTrip.trip_date)} ${formatTime(selectedTrip.departure_time)}`} />
            <SummaryItem label="Direction" value={selectedTrip.direction} />
            <SummaryItem label="Assigned Unit" value={selectedTrip.bus?.bus_code || '-'} />
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Confirmed Bookings</p>
              <p className="mt-1 text-xl font-black text-emerald-700">{confirmedCount}</p>
            </div>
          </div>
        ) : null}

        {serverError ? (
          <div className="mb-6 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600 ring-1 ring-rose-100">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
            {serverError}
          </div>
        ) : null}
        
        {message ? (
          <div className="mb-6 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-600 ring-1 ring-emerald-100">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            {message}
          </div>
        ) : null}

        {bookings.length ? (
          <div className="table-container">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th>Passenger Identity</th>
                  <th>Logistics (Pickup / Drop-off)</th>
                  <th>Status</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {bookings.map((booking) => (
                  <tr key={booking.id} className="group">
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 font-bold text-xs">
                          {booking.user?.name?.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 leading-none">{booking.user?.name || '-'}</p>
                          <p className="text-xs text-slate-400 mt-1 font-medium">{booking.user?.email || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1 text-xs font-bold text-slate-600 uppercase">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-300">P:</span>
                          <span className="truncate max-w-[180px]">{booking.pickup_location?.name || '-'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-300">D:</span>
                          <span className="truncate max-w-[180px]">{booking.dropoff_location?.name || '-'}</span>
                        </div>
                      </div>
                    </td>
                    <td><StatusBadge value={booking.status} /></td>
                    <td>
                      <div className="flex justify-end pr-2">
                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 transition-all hover:bg-rose-600 hover:text-white active:scale-90 disabled:opacity-30"
                          type="button"
                          title="Remove from trip"
                          disabled={cancelBooking.isPending || !['pending', 'confirmed'].includes(booking.status)}
                          onClick={() => {
                            setConfirmModal({
                              isOpen: true,
                              type: 'cancel-booking',
                              id: booking.id,
                              title: 'Remove Passenger',
                              description: `Remove ${booking.user?.name} from this trip? Their seat will be freed up.`,
                            })
                          }}
                        >
                          <XCircleIcon className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-20">
            <EmptyState title={bookingEmptyTitle(tripsQuery, tripBookingsQuery, activeTripId)} description="No passenger requests have been recorded for this transit cycle." />
          </div>
        )}
      </SectionPanel>

      {selectedTrip ? (
        <SectionPanel
          title="Fleet Rebalancing"
          description="Group employees across same-time buses by nearby target locations before drivers calculate routes. Counts can be uneven when geography is cleaner."
          icon={ArrowsRightLeftIcon}
        >
          {compatibleTrips.length < 2 ? (
            <div className="flex flex-col gap-4 rounded-2xl border border-teal-100 bg-teal-50 p-5 text-teal-800 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-wider">Single-bus cycle</p>
                <p className="mt-2 text-sm font-bold leading-relaxed">
                  Fleet rebalancing is not needed because this departure only has one bus. Confirmed passengers are already assigned to {selectedTrip.bus?.bus_code || 'the selected bus'}.
                </p>
              </div>
              <button
                className="secondary-button w-full shrink-0 px-4 md:w-auto"
                type="button"
                disabled={!activeBookingCount || notifyBusAssignments.isPending}
                onClick={() => notifyBusAssignments.mutate([selectedTrip.id])}
              >
                <BellAlertIcon className="h-5 w-5" aria-hidden="true" />
                {notifyBusAssignments.isPending ? 'Sending...' : 'Notify Bus Assignment'}
              </button>
            </div>
          ) : (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {compatibleTrips.map((trip) => {
                const isSelected = activeFleetTripIds.includes(String(trip.id))

                return (
                  <button
                    key={trip.id}
                    type="button"
                    onClick={() => toggleFleetTrip(trip.id)}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      isSelected
                        ? 'border-teal-300 bg-teal-50 shadow-sm ring-2 ring-teal-100'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-900">{trip.bus?.bus_code || 'Unassigned bus'}</p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                          {formatDate(trip.trip_date)} {formatTime(trip.departure_time)}
                        </p>
                      </div>
                      <span className={`h-5 w-5 rounded-full border ${isSelected ? 'border-teal-500 bg-teal-500' : 'border-slate-300 bg-white'}`}>
                        {isSelected ? <CheckCircleIcon className="h-5 w-5 text-white" aria-hidden="true" /> : null}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-white/75 p-3 ring-1 ring-slate-200/70">
                        <p className="font-black uppercase tracking-wider text-slate-400">Booked</p>
                        <p className="mt-1 text-lg font-black text-slate-900">{trip.confirmed_bookings_count || 0}</p>
                      </div>
                      <div className="rounded-xl bg-white/75 p-3 ring-1 ring-slate-200/70">
                        <p className="font-black uppercase tracking-wider text-slate-400">Capacity</p>
                        <p className="mt-1 text-lg font-black text-slate-900">{trip.bus?.seat_count || '—'}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-black text-slate-900">Selected buses: {activeFleetTripIds.length}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Preview first, then apply. The split follows location clusters and bus capacity, not equal headcount.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="secondary-button w-auto px-4"
                  type="button"
                  disabled={activeFleetTripIds.length < 2 || rebalanceFleet.isPending}
                  onClick={() => rebalanceFleet.mutate({ apply: false })}
                >
                  <ArrowPathIcon className="h-5 w-5" aria-hidden="true" />
                  Preview Grouping
                </button>
                <button
                  className="primary-button w-auto px-4"
                  type="button"
                  disabled={activeFleetTripIds.length < 2 || rebalanceFleet.isPending}
                  onClick={() => {
                    setConfirmModal({
                      isOpen: true,
                      type: 'rebalance',
                      title: 'Apply Fleet Rebalance',
                      description: 'Are you sure you want to redistribute passengers across the selected trips? This will update multiple schedules at once.',
                    })
                  }}
                >
                  <ArrowsRightLeftIcon className="h-5 w-5" aria-hidden="true" />
                  Apply Rebalance
                </button>
              </div>
            </div>

            {rebalanceResult ? (
              <div className="grid gap-3 xl:grid-cols-2">
                {rebalanceResult.groups.map((group) => (
                  <div key={group.trip_id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-900">{group.bus?.bus_code || 'Unassigned bus'}</p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                          {group.booking_count} employees - {group.limit} seats - est. {group.estimated_distance_km} km
                        </p>
                      </div>
                      {group.moved_count ? <StatusBadge value={`${group.moved_count} moves`} /> : <StatusBadge value="unchanged" />}
                    </div>
                    <div className="mt-4 space-y-2">
                      {group.assignments.map((assignment) => (
                        <div
                          key={assignment.booking_id}
                          className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ${
                            assignment.will_move ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-100' : 'bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-bold">{assignment.passenger_name}</p>
                            <p className="truncate text-xs font-medium opacity-75">
                              {assignment.target_location?.name || 'Unknown target'}
                            </p>
                          </div>
                          {assignment.will_move ? <span className="text-xs font-black uppercase tracking-wider">Move</span> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          )}
        </SectionPanel>
      ) : null}

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={() => {
          if (confirmModal.type === 'cancel-booking') cancelBooking.mutate(confirmModal.id)
          if (confirmModal.type === 'rebalance') rebalanceFleet.mutate({ apply: true })
        }}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmText={confirmModal.type === 'rebalance' ? 'Apply Rebalance' : 'Cancel Request'}
      />
    </div>
  )
}

function PassengerBookingsPage() {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')
  const [serverError, setServerError] = useState('')
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null })

  const bookingsQuery = useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      const response = await api.get('/bookings')
      return response.data.data
    },
  })
  const upcomingTripsQuery = useQuery({
    queryKey: ['upcoming-trips'],
    queryFn: async () => {
      const response = await api.get('/trips/upcoming')
      return response.data.data
    },
  })
  const createBooking = useMutation({
    mutationFn: async (slot) => {
      const response = await api.post('/bookings', {
        trip_date: slot.trip_date,
        departure_time: slot.departure_time,
        direction: slot.direction,
      })

      return response.data
    },
    onSuccess: async (payload, slot) => {
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      await queryClient.invalidateQueries({ queryKey: ['upcoming-trips'] })
      setMessage(payload.message || bookingConfirmationMessage(payload.data, slot))
      setServerError('')
    },
    onError: (error) => {
      setMessage('')
      setServerError(getApiErrorMessage(error, 'Unable to book trip.'))
    },
  })
  const cancelBooking = useMutation({
    mutationFn: async (bookingId) => api.post(`/bookings/${bookingId}/cancel`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setMessage('Your booking has been cancelled.')
      setServerError('')
    },
    onError: (error) => {
      setMessage('')
      setServerError(getApiErrorMessage(error, 'Unable to cancel booking.'))
    },
  })
  const bookings = bookingsQuery.data || []
  const upcomingTrips = upcomingTripsQuery.data || []
  const activeSlotKeys = new Set(
    bookings
      .filter((booking) => ['pending', 'confirmed'].includes(booking.status))
      .map((booking) => slotKey(booking.trip)),
  )

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Trip Reservations"
        title="Secure Your Seat"
        description="Book upcoming ferry bus cycles and manage your confirmed travel schedule."
      />

      <SectionPanel
        title="Available Cycles"
        description="Upcoming transit cycles open for seat reservations."
        icon={CalendarDaysIcon}
      >
        {serverError ? (
          <div className="mb-6 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600 ring-1 ring-rose-100">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
            {serverError}
          </div>
        ) : null}
        
        {message ? (
          <div className="mb-6 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-600 ring-1 ring-emerald-100">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            {message}
          </div>
        ) : null}

        {upcomingTrips.length ? (
          <div className="table-container">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Departure</th>
                  <th>Direction</th>
                  <th>Unit</th>
                  <th>Availability</th>
                  <th className="w-32"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {upcomingTrips.map((slot) => {
                  const key = slotKey(slot)
                  const alreadyJoined = activeSlotKeys.has(key)
                  const isFull = slot.available_seats === 0
                  return (
                  <tr key={key} className="group">
                    <td className="font-bold text-slate-900">{formatDate(slot.trip_date)}</td>
                    <td>
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700 uppercase tracking-wider">
                        {formatTime(slot.departure_time)}
                      </span>
                    </td>
                    <td>
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ring-inset ${slot.direction === 'pickup' ? 'bg-indigo-50 text-indigo-700 ring-indigo-600/20' : 'bg-teal-50 text-teal-700 ring-teal-600/20'}`}>
                        {slot.direction}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                        {slot.requires_rebalance ? 'After rebalancing' : slot.assigned_bus_code || '-'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${isFull ? 'bg-rose-500' : slot.available_seats <= 10 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        <span className="font-bold text-slate-700 text-xs">
                          {isFull ? 'Full' : `${slot.available_seats} of ${slot.total_seats} seats left`}
                        </span>
                      </div>
                    </td>
                    <td>
                      <button
                        className="primary-button w-full py-2.5 text-[10px] font-black uppercase tracking-widest disabled:opacity-40 disabled:from-slate-400 disabled:to-slate-500"
                        type="button"
                        disabled={createBooking.isPending || alreadyJoined || isFull}
                        onClick={() => createBooking.mutate(slot)}
                      >
                        {alreadyJoined ? 'Joined ✓' : isFull ? 'Full' : 'Join'}
                      </button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-20">
            <EmptyState 
              title={upcomingTripsQuery.isLoading ? 'Establishing fleet sync...' : 'No Available Cycles'} 
              description="There are currently no upcoming ferry bus cycles scheduled for reservation."
            />
          </div>
        )}
      </SectionPanel>

      <SectionPanel
        title="Personal Manifesto"
        description="A complete history of your transit reservations and current travel status."
        icon={ClipboardDocumentListIcon}
      >
        {bookings.length ? (
          <div className="table-container">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th>Cycle Journey</th>
                  <th>Direction</th>
                  <th>Unit</th>
                  <th>Logistics</th>
                  <th>Est. Pickup</th>
                  <th>Duration</th>
                  <th>Booking Status</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {bookings.map((booking) => {
                  const estimatedPickup = getEstimatedPickupTime(booking)
                  return (
                  <tr key={booking.id} className="group">
                    <td>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{formatDate(booking.trip?.trip_date)}</span>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-0.5">{formatTime(booking.trip?.departure_time)}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ring-inset ${booking.trip?.direction === 'pickup' ? 'bg-indigo-50 text-indigo-700 ring-indigo-600/20' : 'bg-teal-50 text-teal-700 ring-teal-600/20'}`}>
                        {booking.trip?.direction || '-'}
                      </span>
                    </td>
                    <td className="font-bold text-slate-700 text-xs uppercase">{booking.trip?.bus?.bus_code || '-'}</td>
                    <td>
                      <div className="flex flex-col gap-1 text-[10px] font-bold text-slate-600 uppercase">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-300">P:</span>
                          <span className="truncate max-w-[140px]">{booking.pickup_location?.name || '-'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-300">D:</span>
                          <span className="truncate max-w-[140px]">{booking.dropoff_location?.name || '-'}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      {estimatedPickup ? (
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-indigo-700">{estimatedPickup}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">at your stop</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td>
                      <span className="text-xs font-bold text-slate-500 uppercase">{formatDuration(booking.trip?.duration_minutes)}</span>
                    </td>
                    <td><StatusBadge value={booking.status} /></td>
                    <td className="px-4 py-3">
                      <button
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all active:scale-90 disabled:opacity-30"
                        type="button"
                        title="Withdraw Request"
                        disabled={cancelBooking.isPending || !['pending', 'confirmed'].includes(booking.status)}
                        onClick={() => {
                          setConfirmModal({
                            isOpen: true,
                            id: booking.id,
                          })
                        }}
                      >
                        <XCircleIcon className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-20">
            <EmptyState
              title={bookingsQuery.isLoading ? 'Fetching travel history...' : 'No Reservations Found'}
              description="Your personal travel manifesto is currently empty."
            />
          </div>
        )}
      </SectionPanel>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={() => cancelBooking.mutate(confirmModal.id)}
        title="Withdraw Request"
        description="Are you sure you want to withdraw your seat reservation? This action cannot be undone."
        confirmText="Withdraw"
      />
    </div>
  )
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p>
      <p className="mt-1.5 truncate text-sm font-bold text-slate-900">{value}</p>
    </div>
  )
}

async function invalidateAdminBookingData(queryClient, selectedTripId) {
  await queryClient.invalidateQueries({ queryKey: ['admin-trips'] })
  await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
  await queryClient.invalidateQueries({ queryKey: ['admin-trip-bookings', selectedTripId] })
}

function bookingEmptyTitle(tripsQuery, tripBookingsQuery, selectedTripId) {
  if (tripsQuery.isLoading) {
    return 'Synchronizing cycles...'
  }

  if (!selectedTripId) {
    return 'Fleet calendar empty'
  }

  if (tripBookingsQuery.isLoading) {
    return 'Manifest loading...'
  }

  return 'No passengers listed'
}

function slotKey(trip) {
  return `${trip?.trip_date}|${trip?.departure_time}|${trip?.direction}`
}

function bookingConfirmationMessage(booking, slot) {
  const busCode = booking?.trip?.bus?.bus_code || slot?.assigned_bus_code

  if (busCode) {
    return `Your seat is confirmed. Your bus is confirmed: ${busCode}.`
  }

  return slot?.requires_rebalance === false
    ? 'Your seat is confirmed for this single-bus cycle.'
    : 'Your seat is confirmed. Your bus will be assigned after fleet rebalancing.'
}

function getEstimatedPickupTime(booking) {
  if (booking.trip?.direction !== 'pickup') return null
  const stops = booking.trip?.route_plan?.ordered_stops
  if (!stops?.length) return null
  const stop = stops.find((s) => s.location_id === booking.pickup_location_id)
  if (!stop || stop.estimated_arrival_offset_seconds == null) return null
  return addSecondsToTime(booking.trip.departure_time, stop.estimated_arrival_offset_seconds)
}

function formatDuration(minutes) {
  if (!minutes) {
    return '-'
  }

  if (minutes < 60) {
    return `${minutes} MIN`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return remainingMinutes ? `${hours} HR ${remainingMinutes} MIN` : `${hours} HR`
}

export default BookingsPage
