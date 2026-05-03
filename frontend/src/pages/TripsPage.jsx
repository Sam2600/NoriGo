import { CalendarDaysIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import EmptyState from '../components/EmptyState.jsx'
import Field from '../components/Field.jsx'
import FormAlert from '../components/FormAlert.jsx'
import PageHeader from '../components/PageHeader.jsx'
import SectionPanel from '../components/SectionPanel.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import SubmitButton from '../components/SubmitButton.jsx'
import { api } from '../lib/api.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { formatDate, formatTime } from '../lib/dateUtils.js'

const tripBuilderSchema = z.object({
  date_from: z.string().min(1, 'Start date is required.'),
  date_to: z.string().min(1, 'End date is required.'),
  departure_time: z.string().min(1, 'Departure time is required.'),
  direction: z.enum(['pickup', 'dropoff']),
  bus_id: z.string().min(1, 'Bus is required.'),
  driver_id: z.string().min(1, 'Driver is required.'),
  route_start_location_id: z.string().min(1, 'Route start is required.'),
  route_end_location_id: z.string().min(1, 'Route end is required.'),
}).refine((values) => values.date_to >= values.date_from, {
  message: 'End date must be on or after start date.',
  path: ['date_to'],
}).refine((values) => values.route_start_location_id !== values.route_end_location_id, {
  message: 'Route end must be different from route start.',
  path: ['route_end_location_id'],
})

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toDraftPayload(draft) {
  return {
    trip_date: draft.trip_date,
    departure_time: draft.departure_time,
    direction: draft.direction,
    bus_id: Number(draft.bus_id),
    driver_id: Number(draft.driver_id),
    route_start_location_id: Number(draft.route_start_location_id),
    route_end_location_id: Number(draft.route_end_location_id),
  }
}

function TripsPage() {
  const queryClient = useQueryClient()
  const [drafts, setDrafts] = useState([])
  const [formError, setFormError] = useState('')
  const [message, setMessage] = useState('')
  const { register, handleSubmit, formState: { errors }, setValue } = useForm({
    resolver: zodResolver(tripBuilderSchema),
    defaultValues: {
      date_from: '',
      date_to: '',
      departure_time: '07:30',
      direction: 'pickup',
      bus_id: '',
      driver_id: '',
      route_start_location_id: '',
      route_end_location_id: '',
    },
  })

  const tripsQuery = useQuery({
    queryKey: ['admin', 'trips'],
    queryFn: async () => {
      const response = await api.get('/admin/trips')
      return response.data.data
    },
  })

  const busesQuery = useQuery({
    queryKey: ['admin', 'buses'],
    queryFn: async () => {
      const response = await api.get('/admin/buses')
      return response.data.data
    },
  })

  const driversQuery = useQuery({
    queryKey: ['admin', 'drivers'],
    queryFn: async () => {
      const response = await api.get('/admin/drivers')
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

  const activeBuses = (busesQuery.data ?? []).filter((bus) => bus.status === 'active')
  const activeDrivers = (driversQuery.data ?? []).filter((driver) => driver.status === 'active')
  const locations = locationsQuery.data ?? []

  const bulkMutation = useMutation({
    mutationFn: async (selectedDrafts) => {
      const response = await api.post('/admin/trips/bulk', {
        cycles: selectedDrafts.map(toDraftPayload),
      })
      return response.data
    },
    onSuccess: (data) => {
      setMessage(`${data.count} trip cycle${data.count === 1 ? '' : 's'} created.`)
      setFormError('')
      setDrafts([])
      queryClient.invalidateQueries({ queryKey: ['admin', 'trips'] })
    },
    onError: (error) => setFormError(getApiErrorMessage(error, 'Unable to create trip cycles.')),
  })

  const cancelMutation = useMutation({
    mutationFn: async (tripId) => {
      await api.post(`/admin/trips/${tripId}/cancel`, { reason: 'Cancelled by admin.' })
    },
    onSuccess: () => {
      setMessage('Trip cancelled.')
      queryClient.invalidateQueries({ queryKey: ['admin', 'trips'] })
    },
    onError: (error) => setFormError(getApiErrorMessage(error, 'Unable to cancel trip.')),
  })

  const generateDrafts = (values) => {
    const start = new Date(`${values.date_from}T00:00:00`)
    const end = new Date(`${values.date_to}T00:00:00`)
    const nextDrafts = []
    const cursor = new Date(start)

    while (cursor <= end && nextDrafts.length < 90) {
      nextDrafts.push({
        selected: true,
        trip_date: toDateKey(cursor),
        departure_time: values.departure_time,
        direction: values.direction,
        bus_id: values.bus_id,
        driver_id: values.driver_id,
        route_start_location_id: values.route_start_location_id,
        route_end_location_id: values.route_end_location_id,
      })
      cursor.setDate(cursor.getDate() + 1)
    }

    setDrafts(nextDrafts)
    setMessage(`${nextDrafts.length} draft cycle${nextDrafts.length === 1 ? '' : 's'} generated.`)
    setFormError('')
  }

  const updateDraft = (index, key, value) => {
    setDrafts((current) => current.map((draft, draftIndex) => (
      draftIndex === index ? { ...draft, [key]: value } : draft
    )))
  }

  const submitSelectedDrafts = () => {
    const selectedDrafts = drafts.filter((draft) => draft.selected)
    if (selectedDrafts.length === 0) {
      setFormError('Select at least one draft cycle.')
      return
    }
    bulkMutation.mutate(selectedDrafts)
  }

  const trips = tripsQuery.data ?? []

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Trips"
        description="Generate editable trip cycles, assign buses and drivers, and cancel scheduled trips."
      />

      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        <SectionPanel title="Cycle builder" icon={CalendarDaysIcon}>
          <form className="space-y-4" onSubmit={handleSubmit(generateDrafts)}>
            <FormAlert type="success">{message}</FormAlert>
            <FormAlert>{formError}</FormAlert>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From" error={errors.date_from?.message}>
                <input className="form-input" type="date" {...register('date_from')} />
              </Field>
              <Field label="To" error={errors.date_to?.message}>
                <input className="form-input" type="date" {...register('date_to')} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Time" error={errors.departure_time?.message}>
                <input className="form-input" type="time" {...register('departure_time')} />
              </Field>
              <Field label="Direction" error={errors.direction?.message}>
                <select className="form-input" {...register('direction')}>
                  <option value="pickup">Pickup</option>
                  <option value="dropoff">Dropoff</option>
                </select>
              </Field>
            </div>
            <Field label="Bus" error={errors.bus_id?.message}>
              <select className="form-input" {...register('bus_id')}>
                <option value="">Select bus</option>
                {activeBuses.map((bus) => (
                  <option key={bus.id} value={bus.id}>{bus.bus_code} ({bus.seat_count} seats)</option>
                ))}
              </select>
            </Field>
            <Field label="Driver" error={errors.driver_id?.message}>
              <select className="form-input" {...register('driver_id')}>
                <option value="">Select driver</option>
                {activeDrivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.name}</option>
                ))}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Route start" error={errors.route_start_location_id?.message}>
                <select className="form-input" {...register('route_start_location_id')}>
                  <option value="">Start</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>{location.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Route end" error={errors.route_end_location_id?.message}>
                <select className="form-input" {...register('route_end_location_id')}>
                  <option value="">End</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>{location.name}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <SubmitButton icon={PlusIcon} isLoading={false}>
                Generate drafts
              </SubmitButton>
              <button
                type="button"
                className="secondary-button"
                disabled={activeBuses.length === 0 || activeDrivers.length === 0 || locations.length < 2}
                onClick={() => {
                  setValue('bus_id', String(activeBuses[0]?.id ?? ''))
                  setValue('driver_id', String(activeDrivers[0]?.id ?? ''))
                  setValue('route_start_location_id', String(locations[0]?.id ?? ''))
                  setValue('route_end_location_id', String(locations[1]?.id ?? ''))
                }}
              >
                Use first available
              </button>
            </div>
          </form>
        </SectionPanel>

        <SectionPanel
          title="Draft cycles"
          icon={CalendarDaysIcon}
          actions={
            <button
              type="button"
              className="primary-button"
              disabled={drafts.length === 0 || bulkMutation.isPending}
              onClick={submitSelectedDrafts}
            >
              <PlusIcon className="h-4 w-4" aria-hidden="true" />
              Create selected
            </button>
          }
        >
          {drafts.length === 0 ? (
            <EmptyState title="No draft cycles" description="Generate cycles, adjust rows, then create the selected trips." />
          ) : (
            <div className="table-container">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th>Select</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Direction</th>
                    <th>Bus</th>
                    <th>Driver</th>
                    <th>Start</th>
                    <th>End</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {drafts.map((draft, index) => (
                    <tr key={`${draft.trip_date}-${index}`}>
                      <td>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          checked={draft.selected}
                          onChange={(event) => updateDraft(index, 'selected', event.target.checked)}
                        />
                      </td>
                      <td><input className="form-input min-w-36" type="date" value={draft.trip_date} onChange={(event) => updateDraft(index, 'trip_date', event.target.value)} /></td>
                      <td><input className="form-input min-w-28" type="time" value={draft.departure_time} onChange={(event) => updateDraft(index, 'departure_time', event.target.value)} /></td>
                      <td>
                        <select className="form-input min-w-32" value={draft.direction} onChange={(event) => updateDraft(index, 'direction', event.target.value)}>
                          <option value="pickup">Pickup</option>
                          <option value="dropoff">Dropoff</option>
                        </select>
                      </td>
                      <td>
                        <select className="form-input min-w-40" value={draft.bus_id} onChange={(event) => updateDraft(index, 'bus_id', event.target.value)}>
                          {activeBuses.map((bus) => (
                            <option key={bus.id} value={bus.id}>{bus.bus_code}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select className="form-input min-w-40" value={draft.driver_id} onChange={(event) => updateDraft(index, 'driver_id', event.target.value)}>
                          {activeDrivers.map((driver) => (
                            <option key={driver.id} value={driver.id}>{driver.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select className="form-input min-w-40" value={draft.route_start_location_id} onChange={(event) => updateDraft(index, 'route_start_location_id', event.target.value)}>
                          {locations.map((location) => (
                            <option key={location.id} value={location.id}>{location.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select className="form-input min-w-40" value={draft.route_end_location_id} onChange={(event) => updateDraft(index, 'route_end_location_id', event.target.value)}>
                          {locations.map((location) => (
                            <option key={location.id} value={location.id}>{location.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionPanel>
      </div>

      <SectionPanel title="Scheduled trips" icon={CalendarDaysIcon}>
        {trips.length === 0 ? (
          <EmptyState title="No trips yet" description="Create trip cycles to make passenger booking slots available." />
        ) : (
          <div className="table-container">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Direction</th>
                  <th>Bus</th>
                  <th>Driver</th>
                  <th>Route</th>
                  <th>Bookings</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trips.map((trip) => (
                  <tr key={trip.id}>
                    <td>{formatDate(trip.trip_date)}</td>
                    <td>{formatTime(trip.departure_time)}</td>
                    <td className="capitalize">{trip.direction}</td>
                    <td>{trip.bus?.bus_code ?? '-'}</td>
                    <td>{trip.driver?.name ?? '-'}</td>
                    <td>{trip.route_start_location?.name ?? '-'} to {trip.route_end_location?.name ?? '-'}</td>
                    <td>{trip.confirmed_bookings_count ?? 0} confirmed, {trip.pending_bookings_count ?? 0} pending</td>
                    <td><StatusBadge value={trip.status} /></td>
                    <td>
                      <button
                        type="button"
                        className="danger-button px-3 py-2"
                        disabled={trip.status === 'cancelled' || cancelMutation.isPending}
                        onClick={() => cancelMutation.mutate(trip.id)}
                      >
                        <TrashIcon className="h-4 w-4" aria-hidden="true" />
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
    </>
  )
}

export default TripsPage
