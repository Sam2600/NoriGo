import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  MapIcon,
  MapPinIcon,
  PlayIcon,
  BoltIcon,
} from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { z } from 'zod'
import EmptyState from '../components/EmptyState.jsx'
import LiveMap from '../components/LiveMap.jsx'
import Field from '../components/Field.jsx'
import FormAlert from '../components/FormAlert.jsx'
import PageHeader from '../components/PageHeader.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import SectionPanel from '../components/SectionPanel.jsx'
import SubmitButton from '../components/SubmitButton.jsx'
import { api } from '../lib/api.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { formatDate, formatTime } from '../lib/dateUtils.js'
import { stopsFromBookings } from '../lib/routeStops.js'

const issueSchema = z.object({
  issue_type: z.enum(['delay', 'vehicle', 'passenger', 'route', 'emergency', 'other']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string().trim().min(3, 'Incident headline must be at least 3 characters.').max(120, 'Incident headline must be 120 characters or less.'),
  message: z.string().trim().min(5, 'Detailed narrative must be at least 5 characters.').max(1000, 'Detailed narrative must be 1000 characters or less.'),
})

const OPERATIONS_TIMEZONE = import.meta.env.VITE_OPERATIONS_TIMEZONE || 'Asia/Yangon'

function DriverTripsPage({ user }) {
  const isDriver = user?.role === 'driver'
  const queryClient = useQueryClient()
  const [selectedTripId, setSelectedTripId] = useState('')
  const [message, setMessage] = useState('')
  const [serverError, setServerError] = useState('')
  const [issueErrors, setIssueErrors] = useState({})
  const [issueFormError, setIssueFormError] = useState('')
  const [issueForm, setIssueForm] = useState({
    issue_type: 'delay',
    severity: 'medium',
    title: '',
    message: '',
  })
  const tripsQuery = useQuery({
    queryKey: ['driver-trips'],
    queryFn: async () => {
      const response = await api.get('/driver/trips')
      return response.data.data
    },
    enabled: isDriver,
  })
  const trips = useMemo(() => tripsQuery.data || [], [tripsQuery.data])
  const activeTripId = selectedTripId || (trips.length ? String(trips[0].id) : '')
  const tripQuery = useQuery({
    queryKey: ['driver-trip', activeTripId],
    queryFn: async () => {
      const response = await api.get(`/driver/trips/${activeTripId}`)
      return response.data.data
    },
    enabled: isDriver && Boolean(activeTripId),
    refetchInterval: 10000,
  })
  const routePlanQuery = useQuery({
    queryKey: ['driver-route-plan', activeTripId],
    queryFn: async () => {
      const response = await api.get(`/driver/trips/${activeTripId}/route-plan`)
      return response.data.data
    },
    enabled: isDriver && Boolean(activeTripId),
  })
  const startTrip = useMutation({
    mutationFn: async (tripId) => api.post(`/driver/trips/${tripId}/start`),
    onSuccess: async () => {
      await invalidateDriverTripData(queryClient, activeTripId)
      setMessage('Operational mission started.')
      setServerError('')
    },
    onError: (error) => {
      setMessage('')
      setServerError(getApiErrorMessage(error, 'Unable to start trip.'))
    },
  })
  const completeTrip = useMutation({
    mutationFn: async (tripId) => api.post(`/driver/trips/${tripId}/complete`),
    onSuccess: async () => {
      await invalidateDriverTripData(queryClient, activeTripId)
      setMessage('Operational mission completed.')
      setServerError('')
    },
    onError: (error) => {
      setMessage('')
      setServerError(getApiErrorMessage(error, 'Unable to complete trip.'))
    },
  })
  const reportIssue = useMutation({
    mutationFn: async ({ tripId, payload }) => api.post(`/driver/trips/${tripId}/issues`, payload),
    onSuccess: async () => {
      await invalidateDriverTripData(queryClient, activeTripId)
      setIssueForm((current) => ({ ...current, title: '', message: '' }))
      setMessage('Incident report filed successfully.')
      setServerError('')
      setIssueErrors({})
      setIssueFormError('')
    },
    onError: (error) => {
      const errorMessage = getApiErrorMessage(error, 'Unable to report issue.')
      setMessage('')
      setServerError(errorMessage)
      setIssueFormError(errorMessage)
    },
  })
  const optimizeRoutePlan = useMutation({
    mutationFn: async ({ tripId, force = false }) =>
      api.post(`/driver/trips/${tripId}/route-plan/optimize`, { force }),
    onSuccess: async () => {
      await invalidateDriverTripData(queryClient, activeTripId)
      await queryClient.invalidateQueries({ queryKey: ['driver-route-plan', activeTripId] })
      setMessage('Optimal logistics path calculated.')
      setServerError('')
    },
    onError: (error) => {
      setMessage('')
      setServerError(getApiErrorMessage(error, 'Unable to calculate best route plan.'))
    },
  })

  if (!isDriver) {
    return (
      <div className="py-20">
        <EmptyState title="Access Restricted" description="Operator workspace is reserved for transit pilots." />
      </div>
    )
  }

  const trip = tripQuery.data
  const bookings = trip?.bookings || []
  const routePlan = routePlanQuery.data?.route_plan || trip?.route_plan
  const routePlanIsStale = Boolean(routePlanQuery.data?.is_stale)
  const suggestedStops = routePlanQuery.data?.suggested_stops || []
  const routeStops = routePlan?.ordered_stops?.length && !routePlanIsStale
    ? routePlan.ordered_stops
    : suggestedStops.length
      ? suggestedStops
        : trip?.route_stops?.length
          ? trip.route_stops
          : stopsFromBookings(bookings)
  const tripIsFutureDated = isFutureCycleDate(trip?.trip_date)

  function updateIssueField(field, value) {
    setServerError('')
    setIssueForm((current) => ({ ...current, [field]: value }))
    setIssueErrors((current) => {
      const next = { ...current }
      delete next[field]
      return next
    })
    setIssueFormError('')
  }

  function submitIssueReport(event) {
    event.preventDefault()

    const result = issueSchema.safeParse(issueForm)

    if (!result.success) {
      setIssueErrors(toFieldErrors(result.error))
      setIssueFormError('Please fix the highlighted incident fields.')
      return
    }

    setIssueErrors({})
    setIssueFormError('')
    reportIssue.mutate({
      tripId: trip.id,
      payload: result.data,
    })
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Operational Console"
        title="Active Transit Mission"
        description="Calculate optimal logistics, review the stop order, and complete assigned transit missions."
        actions={(
          <div className="relative">
            <select
              className="form-input md:min-w-[400px] font-bold text-slate-900 pr-10 appearance-none bg-slate-50 border-slate-200"
              value={activeTripId}
              disabled={trips.length === 0}
              onChange={(event) => {
                setSelectedTripId(event.target.value)
                setMessage('')
                setServerError('')
              }}
            >
              {trips.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatDate(item.trip_date)} {formatTime(item.departure_time)} — {item.direction.toUpperCase()} — {item.bus?.bus_code || 'UNASSIGNED UNIT'}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <BoltIcon className="h-5 w-5" />
            </div>
          </div>
        )}
      />

      <section className="app-panel overflow-hidden shadow-3xl">
        <div className={`p-6 ${trip ? 'border-b border-slate-800' : ''}`}>
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500 text-white shadow-lg shadow-teal-500/20">
                <ClipboardDocumentCheckIcon className="h-7 w-7" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase tracking-widest text-white">Mission Control</h2>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-400">Active Cycle Command</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <button
                className="primary-button from-teal-500 to-teal-600 w-auto py-3 px-8 text-xs font-black uppercase tracking-widest disabled:opacity-30"
                type="button"
                disabled={!trip || trip.status !== 'scheduled' || tripIsFutureDated || startTrip.isPending}
                title={tripIsFutureDated ? 'Trip can only be initialized on its cycle date.' : 'Initialize Trip'}
                onClick={() => startTrip.mutate(trip.id)}
              >
                <PlayIcon className="h-4 w-4" aria-hidden="true" />
                Initialize Trip
              </button>
              <button
                className="primary-button from-slate-700 to-slate-800 border-slate-600 w-auto py-3 px-8 text-xs font-black uppercase tracking-widest disabled:opacity-30"
                type="button"
                disabled={!trip || trip.status !== 'started' || completeTrip.isPending}
                onClick={() => completeTrip.mutate(trip.id)}
              >
                <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
                Complete Mission
              </button>
            </div>
          </div>
        </div>

        {trip ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <DarkSummaryItem label="Cycle Date" value={formatDate(trip.trip_date)} />
            <DarkSummaryItem label="Departure" value={formatTime(trip.departure_time)} />
            <DarkSummaryItem label="Direction" value={trip.direction.toUpperCase()} />
            <DarkSummaryItem label="Assigned Unit" value={trip.bus?.bus_code || '-'} />
            <DarkSummaryItem label="Logistics Start" value={trip.route_start_location?.name || 'DYNAMIC'} />
            <DarkSummaryItem label="Logistics End" value={trip.route_end_location?.name || 'AUTO'} />
            <div className=" p-6 flex flex-col justify-center border-l border-slate-800">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Mission Status</p>
              <div className="mt-2.5"><StatusBadge value={trip.status} /></div>
            </div>
          </div>
        ) : null}
      </section>

      <FormAlert>{serverError}</FormAlert>

      {tripIsFutureDated ? (
        <FormAlert type="warning">
          This cycle opens on {formatDate(trip.trip_date)}. Drivers can initialize it on the cycle date.
        </FormAlert>
      ) : null}
      
      <FormAlert type="success">{message}</FormAlert>

      {trip ? (
        <div className="grid gap-10 xl:grid-cols-[1fr_420px]">
          <div className="space-y-8">
            <SectionPanel 
              title="Optimized Logistics Plan" 
              icon={MapIcon}
              description="Calculated best-path for the current assigned stops."
              actions={(
                <button
                  className="primary-button w-auto py-2 px-5 text-[10px] font-black uppercase tracking-widest"
                  type="button"
                  disabled={optimizeRoutePlan.isPending || routeStops.length < 2}
                  onClick={() => optimizeRoutePlan.mutate({ tripId: trip.id, force: true })}
                >
                  <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
                  {routePlan ? 'Recalculate Path' : 'Calculate Logistics'}
                </button>
              )}
            >
              <div className="space-y-6">
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <LiveMap
                    points={[]}
                    latestLocation={null}
                    routeStops={routeStops}
                    routeGeometry={routePlan?.route_geometry}
                    height={400}
                  />
                </div>
                
                {routePlan ? (
                  <div className="grid gap-6 sm:grid-cols-3">
                    <SummaryItem label="Stop Count" value={routePlan.ordered_stops?.length || 0} />
                    <SummaryItem label="Total Distance" value={formatDistance(routePlan.distance_meters)} />
                    <SummaryItem label="Est. Duration" value={formatDuration(routePlan.duration_seconds)} />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-5 text-amber-800">
                    <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
                    <p className="text-sm font-bold">Logistics path not yet calculated. Execute calculation to synchronize with fleet dispatch.</p>
                  </div>
                )}
                
                {routePlanIsStale ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-5 text-indigo-800">
                    <ArrowPathIcon className="h-5 w-5 shrink-0 animate-spin" />
                    <p className="text-sm font-bold">Manifest update detected. Recalculate logistics path for optimal routing.</p>
                  </div>
                ) : null}
              </div>
            </SectionPanel>

          </div>

          <aside className="space-y-8">
            <SectionPanel title="Path Sequence" icon={MapPinIcon} description="Optimized stop order for this mission.">
              {routeStops.length ? (
                <div className="relative space-y-2 pt-2">
                  {/* Connector line */}
                  <div className="absolute left-[21px] top-6 bottom-6 w-0.5 bg-slate-100" />
                  
                  {routeStops.map((stop, index) => (
                    <article key={`${stop.location_id}-${stop.type}-${index}`} className="relative flex gap-4 p-3 rounded-xl transition-colors hover:bg-slate-50">
                      <span className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xs font-black shadow-sm ring-4 ring-white ${stop.type?.includes('origin') ? 'bg-indigo-600 text-white' : stop.type?.includes('final') ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {stop.sequence || index + 1}
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="truncate text-sm font-black text-slate-900 uppercase tracking-tight">{stop.name || 'Unnamed Point'}</p>
                        <p className={`mt-1 text-[10px] font-bold uppercase tracking-widest ${stop.type?.includes('origin') ? 'text-indigo-600' : stop.type?.includes('final') ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {stopLabel(stop.type)}
                        </p>
                        {stop.passenger_names?.length ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {stop.passenger_names.map(name => (
                              <span key={name} className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">{name}</span>
                            ))}
                          </div>
                        ) : stop.passenger_name ? (
                          <p className="mt-2 inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">{stop.passenger_name}</p>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="py-12">
                  <EmptyState title="No Path Sequence" description="Calculate logistics to generate the optimized stop order." />
                </div>
              )}
            </SectionPanel>

            <SectionPanel title="Incident Reporting" icon={ExclamationTriangleIcon} description="File official reports for operational hazards.">
              <form
                className="space-y-4"
                onSubmit={submitIssueReport}
              >
                <FormAlert>{issueFormError}</FormAlert>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Issue Category" error={issueErrors.issue_type}>
                    <select className="form-input" value={issueForm.issue_type} onChange={(event) => updateIssueField('issue_type', event.target.value)}>
                      <option value="delay">LOGISTICS DELAY</option>
                      <option value="vehicle">VEHICLE FAILURE</option>
                      <option value="passenger">PASSENGER INCIDENT</option>
                      <option value="route">ROUTE OBSTRUCTION</option>
                      <option value="emergency">CRITICAL EMERGENCY</option>
                      <option value="other">OTHER INCIDENT</option>
                    </select>
                  </Field>
                  <Field label="Severity Tier" error={issueErrors.severity}>
                    <select className="form-input" value={issueForm.severity} onChange={(event) => updateIssueField('severity', event.target.value)}>
                      <option value="low">LOW</option>
                      <option value="medium">MEDIUM</option>
                      <option value="high">HIGH</option>
                      <option value="critical">CRITICAL</option>
                    </select>
                  </Field>
                </div>
                <Field label="Incident Headline" error={issueErrors.title}>
                  <input className="form-input" value={issueForm.title} onChange={(event) => updateIssueField('title', event.target.value)} placeholder="Brief summary of the issue..." />
                </Field>
                <Field label="Detailed Narrative" error={issueErrors.message}>
                  <textarea className="form-input min-h-[100px] resize-none" value={issueForm.message} onChange={(event) => updateIssueField('message', event.target.value)} placeholder="Provide full context and resolution steps taken..." />
                </Field>
                <SubmitButton
                  className="primary-button from-rose-600 to-rose-700 shadow-rose-500/20 w-full py-3 text-[10px] font-black uppercase tracking-widest"
                  disabled={reportIssue.isPending}
                  icon={ExclamationTriangleIcon}
                  isLoading={reportIssue.isPending}
                  loadingText="Filing Report..."
                >
                  File Incident Report
                </SubmitButton>
              </form>
            </SectionPanel>
          </aside>
        </div>
      ) : null}
    </div>
  )
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p>
      <p className="mt-1.5 truncate text-base font-black text-slate-900">{value || '-'}</p>
    </div>
  )
}

function DarkSummaryItem({ label, value }) {
  return (
    <div className="p-6 border-r border-slate-800 last:border-r-0">
      <p className="text-[10px] font-black uppercase tracking-widest">{label}</p>
      <p className="mt-2.5 truncate text-sm font-bold tracking-tight">{value || '-'}</p>
    </div>
  )
}

async function invalidateDriverTripData(queryClient, activeTripId) {
  await queryClient.invalidateQueries({ queryKey: ['driver-trips'] })
  await queryClient.invalidateQueries({ queryKey: ['driver-trip', activeTripId] })
}

function formatDistance(meters) {
  if (!meters) {
    return '-'
  }

  if (meters < 1000) {
    return `${meters} M`
  }

  return `${(meters / 1000).toFixed(1)} KM`
}

function formatDuration(seconds) {
  if (!seconds) {
    return '-'
  }

  const minutes = Math.round(seconds / 60)

  if (minutes < 60) {
    return `${minutes} MIN`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return remainingMinutes ? `${hours} HR ${remainingMinutes} MIN` : `${hours} HR`
}

function stopLabel(type) {
  const labels = {
    origin: 'MISSION INCEPTION',
    origin_pickup: 'INITIAL PICKUP',
    pickup: 'PASSENGER PICKUP',
    dropoff: 'PASSENGER DROPOFF',
    final_dropoff: 'FINAL TERMINATION',
    final_destination: 'MISSION COMPLETE',
  }

  return labels[type] || type?.toUpperCase().replaceAll('_', ' ') || 'LOGISTICS POINT'
}

function isFutureCycleDate(value) {
  const cycleDate = normalizeDateString(value)

  return Boolean(cycleDate && cycleDate > todayInOperationsTimezone())
}

function normalizeDateString(value) {
  if (!value) {
    return ''
  }

  return String(value).split('T')[0].split(' ')[0]
}

function todayInOperationsTimezone() {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      month: '2-digit',
      timeZone: OPERATIONS_TIMEZONE,
      year: 'numeric',
    }).formatToParts(new Date())

    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

    return `${values.year}-${values.month}-${values.day}`
  } catch {
    const today = new Date()

    return [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-')
  }
}

function toFieldErrors(zodError) {
  return Object.fromEntries(
    Object.entries(zodError.flatten().fieldErrors)
      .map(([field, messages]) => [field, messages?.[0]])
      .filter(([, message]) => Boolean(message)),
  )
}

export default DriverTripsPage
