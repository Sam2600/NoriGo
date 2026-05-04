import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarDaysIcon, ClockIcon, PlusIcon, XMarkIcon, ArrowLongRightIcon, TruckIcon, UserCircleIcon, MapPinIcon, UserIcon } from '@heroicons/react/24/outline'
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
import ConfirmationModal from '../components/ConfirmationModal.jsx'
import SubmitButton from '../components/SubmitButton.jsx'
import { api } from '../lib/api.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { formatDate, formatTime } from '../lib/dateUtils.js'

const schema = z.object({
  date_from: z.string().min(1, 'Start date is required.'),
  date_to: z.string().min(1, 'End date is required.'),
  departure_time: z.string().min(1, 'Departure time is required.'),
  direction: z.enum(['pickup', 'dropoff']),
  bus_id: z.string().min(1, 'Select an active vehicle for this trip.'),
  driver_id: z.string().min(1, 'Select an active operator for this trip.'),
  route_start_location_id: z.string().min(1, 'Select the trip start location.'),
  route_end_location_id: z.string().min(1, 'Select the trip end location.'),
}).refine((d) => !d.date_from || !d.date_to || d.date_to >= d.date_from, {
  message: 'End date must be on or after start date.',
  path: ['date_to'],
})

const draftRowSchema = z.object({
  trip_date: z.string().min(1, 'Date is required.'),
  departure_time: z.string().min(1, 'Time is required.'),
  direction: z.enum(['pickup', 'dropoff']),
  bus_id: z.string().min(1, 'Bus is required.'),
  driver_id: z.string().min(1, 'Driver is required.'),
  route_start_location_id: z.string().min(1, 'Start is required.'),
  route_end_location_id: z.string().min(1, 'End is required.'),
})

function TripsPage({ user }) {
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('manifest')
  const [message, setMessage] = useState('')
  const [serverError, setServerError] = useState('')
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, tripId: null })
  const [draftRows, setDraftRows] = useState([])
  const [draftErrors, setDraftErrors] = useState({})
  const [draftReviewError, setDraftReviewError] = useState('')

  const tripsQuery = useQuery({
    queryKey: ['admin-trips'],
    queryFn: async () => {
      const response = await api.get('/admin/trips')
      return response.data.data
    },
    enabled: isAdmin,
  })
  const busesQuery = useQuery({
    queryKey: ['admin-buses'],
    queryFn: async () => {
      const response = await api.get('/admin/buses')
      return response.data.data
    },
    enabled: isAdmin,
  })
  const driversQuery = useQuery({
    queryKey: ['admin-drivers'],
    queryFn: async () => {
      const response = await api.get('/admin/drivers')
      return response.data.data
    },
    enabled: isAdmin,
  })
  const locationsQuery = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const response = await api.get('/locations')
      return response.data.data
    },
    enabled: isAdmin,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      date_from: '',
      date_to: '',
      departure_time: '',
      direction: 'pickup',
      bus_id: '',
      driver_id: '',
      route_start_location_id: '',
      route_end_location_id: '',
    },
  })

  const createTrips = useMutation({
    mutationFn: async (cycles) => api.post('/admin/trips/bulk', { cycles }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-trips'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      const count = response.data.count
      setMessage(`${count} trip${count !== 1 ? 's' : ''} created successfully.`)
      setServerError('')
      setDraftRows([])
      setDraftErrors({})
      setDraftReviewError('')
      reset()
      setActiveTab('manifest')
    },
    onError: (error) => {
      setMessage('')
      setServerError(getApiErrorMessage(error, 'Unable to create trip.'))
    },
  })

  const cancelTrip = useMutation({
    mutationFn: async (tripId) => api.post(`/admin/trips/${tripId}/cancel`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-trips'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      setMessage('Trip cancelled successfully.')
    },
  })

  if (!isAdmin) {
    return (
      <div className="py-20">
        <EmptyState title="Access Restricted" description="Only administrators can manage the fleet schedule." />
      </div>
    )
  }

  const trips = tripsQuery.data || []
  const buses = (busesQuery.data || []).filter((bus) => bus.status === 'active')
  const drivers = (driversQuery.data || []).filter((driver) => driver.status === 'active')
  const locations = locationsQuery.data || []
  const selectedDraftCount = draftRows.filter((row) => row.selected).length

  function generateDraftCycles(values) {
    const dates = datesBetween(values.date_from, values.date_to)

    if (!dates.length) {
      setDraftRows([])
      setDraftReviewError('Select a valid date range before generating cycles.')
      return
    }

    if (dates.length > 90) {
      setDraftRows([])
      setDraftReviewError('Date range cannot exceed 90 days.')
      return
    }

    setDraftRows(dates.map((tripDate, index) => ({
      id: `${tripDate}-${index}-${Date.now()}`,
      selected: true,
      trip_date: tripDate,
      departure_time: values.departure_time,
      direction: values.direction,
      bus_id: values.bus_id,
      driver_id: values.driver_id,
      route_start_location_id: values.route_start_location_id,
      route_end_location_id: values.route_end_location_id,
    })))
    setDraftErrors({})
    setDraftReviewError('')
    setServerError('')
    setMessage(`${dates.length} draft cycle${dates.length !== 1 ? 's' : ''} ready for review.`)
  }

  function updateDraftRow(rowId, field, value) {
    setDraftRows((rows) => rows.map((row) => (
      row.id === rowId ? { ...row, [field]: value } : row
    )))
    setDraftErrors((current) => clearDraftFieldError(current, rowId, field))
    setDraftReviewError('')
    setServerError('')
  }

  function toggleDraftRow(rowId) {
    setDraftRows((rows) => rows.map((row) => (
      row.id === rowId ? { ...row, selected: !row.selected } : row
    )))
    setDraftReviewError('')
  }

  function setAllDraftRowsSelected(selected) {
    setDraftRows((rows) => rows.map((row) => ({ ...row, selected })))
    setDraftReviewError('')
  }

  function deploySelectedDraftCycles() {
    const validation = validateDraftRows(draftRows)

    if (!validation.isValid) {
      setDraftErrors(validation.errors)
      setDraftReviewError(validation.message)
      return
    }

    setDraftErrors({})
    setDraftReviewError('')
    setServerError('')
    setMessage('')
    createTrips.mutate(validation.cycles)
  }

  function discardDraftCycles() {
    setDraftRows([])
    setDraftErrors({})
    setDraftReviewError('')
    setMessage('')
    setServerError('')
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          eyebrow="Mission Planning"
          title="Fleet Scheduling"
          description="Strategize and deploy transit cycles. Assign operational assets and define route anchors for optimal dispatch."
        />
        
        <div className="flex shrink-0 items-center gap-2 rounded-2xl bg-slate-100 p-1.5 ring-1 ring-inset ring-slate-200 shadow-sm">
          <button
            onClick={() => setActiveTab('manifest')}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'manifest' 
                ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/20' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <CalendarDaysIcon className="h-4 w-4" />
            Operational Manifest
          </button>
          <button
            onClick={() => setActiveTab('planning')}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'planning' 
                ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/20' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <PlusIcon className="h-4 w-4" />
            Create Cycle
          </button>
        </div>
      </div>

      {activeTab === 'manifest' ? (
        <main className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <SectionPanel title="Scheduled Manifest" icon={CalendarDaysIcon} description="Active and upcoming transit cycles across the fleet.">
            {trips.length ? (
              <div className="table-container border-none shadow-none ring-1 ring-slate-200">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="py-4 pl-6">Schedule Detail</th>
                      <th>Transit Route</th>
                      <th>Operational Assets</th>
                      <th>Demand Logistics</th>
                      <th>Status</th>
                      <th className="w-10 pr-6"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {trips.map((trip) => (
                      <tr key={trip.id} className="group hover:bg-slate-50/30 transition-colors">
                        <td className="py-5 pl-6">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-black tracking-tight text-slate-900">{formatDate(trip.trip_date)}</span>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-600 ring-1 ring-inset ring-slate-200">
                                <ClockIcon className="h-3 w-3" />
                                {formatTime(trip.departure_time)}
                              </span>
                              <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider ring-1 ring-inset ${trip.direction === 'pickup' ? 'bg-indigo-50 text-indigo-700 ring-indigo-600/20' : 'bg-teal-50 text-teal-700 ring-teal-600/20'}`}>
                                {trip.direction}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col text-right">
                              <span className="text-xs font-bold text-slate-600 truncate max-w-[140px]">{trip.route_start_location?.name || '—'}</span>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Origin</span>
                            </div>
                            <ArrowLongRightIcon className="h-5 w-5 text-slate-300" />
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-900 truncate max-w-[140px]">{trip.route_end_location?.name || '—'}</span>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600">Destination</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 ring-1 ring-slate-200/60">
                              <TruckIcon className="h-4 w-4 text-slate-400" />
                              <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{trip.bus?.bus_code || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-50 text-teal-600 ring-1 ring-teal-200">
                                <UserCircleIcon className="h-4 w-4" />
                              </div>
                              <span className="text-xs font-bold text-slate-600">{trip.driver?.name || 'Unassigned'}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex max-w-[160px] flex-col gap-2">
                            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                              <span>Load Factor</span>
                              <span className={trip.confirmed_bookings_count >= (trip.bus?.seat_count || 24) ? 'text-rose-600' : 'text-teal-600'}>
                                {trip.confirmed_bookings_count || 0} / {trip.bus?.seat_count || 24}
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/50">
                              <div 
                                className={`h-full transition-all duration-500 ${trip.confirmed_bookings_count >= (trip.bus?.seat_count || 24) ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.4)]'}`} 
                                style={{ width: `${Math.min(100, ((trip.confirmed_bookings_count || 0) / (trip.bus?.seat_count || 24)) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td><StatusBadge value={trip.status} /></td>
                        <td className="pr-6">
                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 hover:shadow-sm transition-all active:scale-90"
                            type="button"
                            title="Cancel Cycle"
                            onClick={() => {
                              setConfirmModal({
                                isOpen: true,
                                tripId: trip.id,
                                title: 'Cancel Transit Cycle',
                                description: `Are you sure you want to cancel the ${trip.direction.toUpperCase()} cycle on ${formatDate(trip.trip_date)}? This action will notify all affected passengers.`,
                              })
                            }}
                            disabled={cancelTrip.isPending || trip.status === 'cancelled'}
                          >
                            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-24">
                <EmptyState 
                  title={tripsQuery.isLoading ? 'Syncing operational manifest...' : 'No Scheduled Cycles'} 
                  description="Transition to the Planning Panel to initialize the first transit cycle."
                  action={
                    <button onClick={() => setActiveTab('planning')} className="primary-button mt-6">
                      <PlusIcon className="h-4 w-4" />
                      Initialize First Cycle
                    </button>
                  }
                />
              </div>
            )}
          </SectionPanel>

          <ConfirmationModal
            isOpen={confirmModal.isOpen}
            onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
            onConfirm={() => cancelTrip.mutate(confirmModal.tripId)}
            title={confirmModal.title}
            description={confirmModal.description}
            confirmText="Cancel Cycle"
          />
        </main>
      ) : (
        <div className="mx-auto max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-500">
          <SectionPanel title="Cycle Configuration" icon={PlusIcon} description="Define operational parameters for a new transit cycle.">
            <form className="space-y-6" onSubmit={handleSubmit(generateDraftCycles)}>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Date From" error={errors.date_from?.message}>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <CalendarDaysIcon className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-teal-600" />
                    </div>
                    <input
                      className="form-input pl-10 bg-slate-50/40 border-slate-200/80 focus:bg-white"
                      type="date"
                      {...register('date_from')}
                    />
                  </div>
                </Field>
                <Field label="Date To" error={errors.date_to?.message}>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <CalendarDaysIcon className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-teal-600" />
                    </div>
                    <input
                      className="form-input pl-10 bg-slate-50/40 border-slate-200/80 focus:bg-white"
                      type="date"
                      {...register('date_to')}
                    />
                  </div>
                </Field>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Departure Time" error={errors.departure_time?.message}>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <ClockIcon className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-teal-600" />
                    </div>
                    <input
                      className="form-input pl-10 bg-slate-50/40 border-slate-200/80 focus:bg-white"
                      type="time"
                      {...register('departure_time')}
                    />
                  </div>
                </Field>
                <Field label="Transit Direction" error={errors.direction?.message}>
                  <select className="form-input font-bold bg-slate-50/40 border-slate-200/80 focus:bg-white" {...register('direction')}>
                    <option value="pickup">PICKUP (To Terminal)</option>
                    <option value="dropoff">DROPOFF (From Terminal)</option>
                  </select>
                </Field>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 border-t border-slate-100 pt-6">
                <Field label="Assigned Vehicle" error={errors.bus_id?.message}>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <TruckIcon className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-teal-600" />
                    </div>
                    <select className="form-input !pl-10 bg-slate-50/40 border-slate-200/80 focus:bg-white" {...register('bus_id')}>
                      <option value="">Select an active vehicle</option>
                      {buses.map((bus) => (
                        <option key={bus.id} value={bus.id}>
                          {bus.bus_code} ({bus.seat_count} seats)
                        </option>
                      ))}
                    </select>
                  </div>
                </Field>
                <Field label="Assigned Operator" error={errors.driver_id?.message}>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <UserIcon className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-teal-600" />
                    </div>
                    <select className="form-input !pl-10 bg-slate-50/40 border-slate-200/80 focus:bg-white" {...register('driver_id')}>
                      <option value="">Select an active operator</option>
                      {drivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </Field>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 border-t border-slate-100 pt-6">
                <Field label="Start Location" error={errors.route_start_location_id?.message}>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <MapPinIcon className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-teal-600" />
                    </div>
                    <select className="form-input !pl-10 bg-slate-50/40 border-slate-200/80 focus:bg-white" {...register('route_start_location_id')}>
                      <option value="">Select a location</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </Field>
                <Field label="End Location" error={errors.route_end_location_id?.message}>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <MapPinIcon className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-teal-600" />
                    </div>
                    <select className="form-input !pl-10 bg-slate-50/40 border-slate-200/80 focus:bg-white" {...register('route_end_location_id')}>
                      <option value="">Select a location</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </Field>
              </div>

              <div className="pt-4">
                <FormAlert className="mb-4">{serverError}</FormAlert>
                <FormAlert className="mb-4" type="success">{message}</FormAlert>

                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setActiveTab('manifest')}
                    className="secondary-button w-1/3 py-4 text-xs font-black uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                  <SubmitButton
                    className="primary-button flex-1 py-4 text-xs font-black uppercase tracking-widest shadow-teal-500/20" 
                    disabled={isSubmitting}
                    icon={PlusIcon}
                    isLoading={isSubmitting}
                    loadingText="Preparing Review..."
                  >
                    Generate Review Table
                  </SubmitButton>
                </div>
              </div>
            </form>

            {draftRows.length ? (
              <div className="mt-8 space-y-4 border-t border-slate-100 pt-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600">Review Before Deployment</p>
                    <h3 className="mt-2 text-lg font-black tracking-tight text-slate-900">Editable Cycle Drafts</h3>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      {selectedDraftCount} of {draftRows.length} cycles selected for registration.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="secondary-button px-4 py-3 text-xs font-black uppercase tracking-widest"
                      type="button"
                      onClick={discardDraftCycles}
                    >
                      Clear Drafts
                    </button>
                    <SubmitButton
                      className="primary-button px-6 py-3 text-xs font-black uppercase tracking-widest"
                      disabled={!selectedDraftCount || createTrips.isPending}
                      icon={PlusIcon}
                      isLoading={createTrips.isPending}
                      loadingText="Registering Selected..."
                      type="button"
                      onClick={deploySelectedDraftCycles}
                    >
                      Register Selected Cycles
                    </SubmitButton>
                  </div>
                </div>

                <FormAlert>{draftReviewError}</FormAlert>

                <div className="table-container border-none shadow-none ring-1 ring-slate-200">
                  <div className="max-h-[520px] overflow-auto">
                    <table className="min-w-[1180px] divide-y divide-slate-200">
                    <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
                      <tr>
                        <th className="w-12 px-4">
                          <input
                            aria-label="Select all draft cycles"
                            checked={selectedDraftCount === draftRows.length}
                            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            onChange={(event) => setAllDraftRowsSelected(event.target.checked)}
                            type="checkbox"
                          />
                        </th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Direction</th>
                        <th>Bus</th>
                        <th>Driver</th>
                        <th>Start</th>
                        <th>End</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {draftRows.map((row) => (
                        <tr key={row.id} className={row.selected ? 'bg-white' : 'bg-slate-50/70 opacity-70'}>
                          <td className="px-4">
                            <input
                              aria-label={`Select draft cycle for ${row.trip_date}`}
                              checked={row.selected}
                              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                              onChange={() => toggleDraftRow(row.id)}
                              type="checkbox"
                            />
                          </td>
                          <td>
                            <input
                              className={`form-input min-w-[145px] ${draftErrors[row.id]?.trip_date ? 'border-rose-300 ring-rose-100' : ''}`}
                              onChange={(event) => updateDraftRow(row.id, 'trip_date', event.target.value)}
                              type="date"
                              value={row.trip_date}
                            />
                          </td>
                          <td>
                            <input
                              className={`form-input min-w-[115px] ${draftErrors[row.id]?.departure_time ? 'border-rose-300 ring-rose-100' : ''}`}
                              onChange={(event) => updateDraftRow(row.id, 'departure_time', event.target.value)}
                              type="time"
                              value={row.departure_time}
                            />
                          </td>
                          <td>
                            <select
                              className={`form-input min-w-[130px] font-bold ${draftErrors[row.id]?.direction ? 'border-rose-300 ring-rose-100' : ''}`}
                              onChange={(event) => updateDraftRow(row.id, 'direction', event.target.value)}
                              value={row.direction}
                            >
                              <option value="pickup">PICKUP</option>
                              <option value="dropoff">DROPOFF</option>
                            </select>
                          </td>
                          <td>
                            <select
                              className={`form-input min-w-[160px] ${draftErrors[row.id]?.bus_id ? 'border-rose-300 ring-rose-100' : ''}`}
                              onChange={(event) => updateDraftRow(row.id, 'bus_id', event.target.value)}
                              value={row.bus_id}
                            >
                              <option value="">Select bus</option>
                              {buses.map((bus) => (
                                <option key={bus.id} value={bus.id}>{bus.bus_code}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              className={`form-input min-w-[180px] ${draftErrors[row.id]?.driver_id ? 'border-rose-300 ring-rose-100' : ''}`}
                              onChange={(event) => updateDraftRow(row.id, 'driver_id', event.target.value)}
                              value={row.driver_id}
                            >
                              <option value="">Select driver</option>
                              {drivers.map((driver) => (
                                <option key={driver.id} value={driver.id}>{driver.name}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              className={`form-input min-w-[190px] ${draftErrors[row.id]?.route_start_location_id ? 'border-rose-300 ring-rose-100' : ''}`}
                              onChange={(event) => updateDraftRow(row.id, 'route_start_location_id', event.target.value)}
                              value={row.route_start_location_id}
                            >
                              <option value="">Select start</option>
                              {locations.map((location) => (
                                <option key={location.id} value={location.id}>{location.name}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              className={`form-input min-w-[190px] ${draftErrors[row.id]?.route_end_location_id ? 'border-rose-300 ring-rose-100' : ''}`}
                              onChange={(event) => updateDraftRow(row.id, 'route_end_location_id', event.target.value)}
                              value={row.route_end_location_id}
                            >
                              <option value="">Select end</option>
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
                </div>
              </div>
            ) : null}
          </SectionPanel>
        </div>
      )}
    </div>
  )
}

function validateDraftRows(rows) {
  const selectedRows = rows.filter((row) => row.selected)

  if (!selectedRows.length) {
    return {
      isValid: false,
      message: 'Select at least one cycle to register.',
      errors: {},
      cycles: [],
    }
  }

  const errors = {}
  const busSlots = new Map()
  const driverSlots = new Map()

  selectedRows.forEach((row) => {
    const result = draftRowSchema.safeParse(row)

    if (!result.success) {
      errors[row.id] = toDraftFieldErrors(result.error)
      return
    }

    const normalizedTime = row.departure_time.slice(0, 5)
    const busSlot = `${row.trip_date}|${normalizedTime}|${row.bus_id}`
    const driverSlot = `${row.trip_date}|${normalizedTime}|${row.driver_id}`

    if (busSlots.has(busSlot)) {
      errors[row.id] = {
        ...(errors[row.id] || {}),
        bus_id: 'Bus repeated for same date and time.',
      }
      errors[busSlots.get(busSlot)] = {
        ...(errors[busSlots.get(busSlot)] || {}),
        bus_id: 'Bus repeated for same date and time.',
      }
    }

    if (driverSlots.has(driverSlot)) {
      errors[row.id] = {
        ...(errors[row.id] || {}),
        driver_id: 'Driver repeated for same date and time.',
      }
      errors[driverSlots.get(driverSlot)] = {
        ...(errors[driverSlots.get(driverSlot)] || {}),
        driver_id: 'Driver repeated for same date and time.',
      }
    }

    busSlots.set(busSlot, row.id)
    driverSlots.set(driverSlot, row.id)
  })

  if (Object.keys(errors).length) {
    return {
      isValid: false,
      message: 'Please fix the highlighted draft rows before registering.',
      errors,
      cycles: [],
    }
  }

  return {
    isValid: true,
    message: '',
    errors: {},
    cycles: selectedRows.map((row) => ({
      trip_date: row.trip_date,
      departure_time: row.departure_time,
      direction: row.direction,
      bus_id: Number(row.bus_id),
      driver_id: Number(row.driver_id),
      route_start_location_id: Number(row.route_start_location_id),
      route_end_location_id: Number(row.route_end_location_id),
    })),
  }
}

function datesBetween(dateFrom, dateTo) {
  const start = parseDateInput(dateFrom)
  const end = parseDateInput(dateTo)

  if (!start || !end || start > end) {
    return []
  }

  const dates = []
  const current = new Date(start)

  while (current <= end) {
    dates.push(formatDateInput(current))
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return dates
}

function parseDateInput(value) {
  const parts = value?.split('-').map(Number)

  if (parts?.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null
  }

  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
}

function formatDateInput(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function toDraftFieldErrors(zodError) {
  return Object.fromEntries(
    Object.entries(zodError.flatten().fieldErrors)
      .map(([field, messages]) => [field, messages?.[0]])
      .filter(([, message]) => Boolean(message)),
  )
}

function clearDraftFieldError(errors, rowId, field) {
  if (!errors[rowId]) {
    return errors
  }

  const next = { ...errors, [rowId]: { ...errors[rowId] } }
  delete next[rowId][field]

  if (field === 'route_start_location_id') {
    delete next[rowId].route_end_location_id
  }

  if (!Object.keys(next[rowId]).length) {
    delete next[rowId]
  }

  return next
}

export default TripsPage
