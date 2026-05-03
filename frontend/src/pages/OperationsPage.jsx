import {
  BellAlertIcon,
  ExclamationTriangleIcon,
  MapIcon,
  ShieldExclamationIcon,
  TruckIcon,
} from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState.jsx'
import FormAlert from '../components/FormAlert.jsx'
import LiveMap from '../components/LiveMap.jsx'
import MetricCard from '../components/MetricCard.jsx'
import PageHeader from '../components/PageHeader.jsx'
import SectionPanel from '../components/SectionPanel.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import SubmitButton from '../components/SubmitButton.jsx'
import { useRealtimeChannel } from '../hooks/useRealtimeChannel.js'
import { api } from '../lib/api.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { formatDate, formatDateTime, formatTime } from '../lib/dateUtils.js'

function OperationsPage({ user }) {
  const queryClient = useQueryClient()
  const [cancelReasons, setCancelReasons] = useState({})
  const [cancelReasonErrors, setCancelReasonErrors] = useState({})
  const [resolutionNotes, setResolutionNotes] = useState({})
  const [resolutionNoteErrors, setResolutionNoteErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const operationsQuery = useQuery({
    queryKey: ['admin-operations'],
    queryFn: async () => {
      const response = await api.get('/admin/operations')
      return response.data.data
    },
    enabled: user?.role === 'admin',
    refetchInterval: 10000,
  })
  const realtimeEvents = useMemo(() => [
    {
      event: 'trip.location.updated',
      handler: () => queryClient.invalidateQueries({ queryKey: ['admin-operations'] }),
    },
    {
      event: 'trip.status.updated',
      handler: () => queryClient.invalidateQueries({ queryKey: ['admin-operations'] }),
    },
    {
      event: 'driver.issue.reported',
      handler: () => queryClient.invalidateQueries({ queryKey: ['admin-operations'] }),
    },
  ], [queryClient])

  useRealtimeChannel('admin.operations', realtimeEvents)

  const emergencyCancel = useMutation({
    mutationFn: async ({ tripId, reason }) =>
      api.post(`/admin/trips/${tripId}/cancel`, {
        is_emergency: true,
        reason,
      }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-operations'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-trips'] })
      setCancelReasons((current) => ({ ...current, [variables.tripId]: '' }))
      setCancelReasonErrors((current) => ({ ...current, [variables.tripId]: '' }))
      setServerError('')
    },
    onError: (error) => {
      setServerError(getApiErrorMessage(error, 'Unable to cancel trip.'))
    },
  })
  const resolveIssue = useMutation({
    mutationFn: async ({ issueId, resolutionNote }) =>
      api.post(`/admin/issues/${issueId}/resolve`, {
        resolution_note: resolutionNote,
      }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-operations'] })
      setResolutionNotes((current) => ({ ...current, [variables.issueId]: '' }))
      setResolutionNoteErrors((current) => ({ ...current, [variables.issueId]: '' }))
      setServerError('')
    },
    onError: (error) => {
      setServerError(getApiErrorMessage(error, 'Unable to resolve issue.'))
    },
  })

  if (user?.role !== 'admin') {
    return <EmptyState title="Only admins can access operations monitoring." />
  }

  const data = operationsQuery.data || {}
  const metrics = data.metrics || {}
  const trips = data.trips || []
  const openIssues = data.open_issues || []
  const routeStops = trips.flatMap((trip) => trip.route_stops || [])

  function submitEmergencyCancel(trip) {
    const reason = (cancelReasons[trip.id] || '').trim()

    if (reason.length < 5) {
      setCancelReasonErrors((current) => ({
        ...current,
        [trip.id]: 'Enter at least 5 characters explaining the emergency cancellation.',
      }))
      return
    }

    setCancelReasonErrors((current) => ({ ...current, [trip.id]: '' }))
    emergencyCancel.mutate({ tripId: trip.id, reason })
  }

  function submitIssueResolution(issue) {
    const resolutionNote = (resolutionNotes[issue.id] || '').trim()

    if (resolutionNote.length < 3) {
      setResolutionNoteErrors((current) => ({
        ...current,
        [issue.id]: 'Enter a short resolution note before closing this incident.',
      }))
      return
    }

    setResolutionNoteErrors((current) => ({ ...current, [issue.id]: '' }))
    resolveIssue.mutate({ issueId: issue.id, resolutionNote })
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Real-time Command"
        title="Operations Control"
        description="Active fleet monitoring, incident response, and mission-critical dispatch management."
      />

      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Active Trips" value={metrics.active_trips} icon={TruckIcon} tone="teal" />
        <MetricCard label="Tracked Units" value={metrics.tracked_trips} icon={MapIcon} tone="sky" />
        <MetricCard label="System Delays" value={metrics.delayed_trips} icon={ExclamationTriangleIcon} tone="amber" />
        <MetricCard label="Open Issues" value={metrics.open_issues} icon={BellAlertIcon} tone="rose" />
        <MetricCard label="Emergency Events" value={metrics.emergency_cancellations} icon={ShieldExclamationIcon} tone="violet" />
      </section>

      <FormAlert>{serverError}</FormAlert>

      <SectionPanel
        title="Fleet Intelligence Map"
        description="Visualizing planned logistics and live telemetry for all active transit cycles."
        icon={MapIcon}
      >
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <LiveMap
            routeStops={routeStops}
            height={500}
          />
        </div>
      </SectionPanel>

      <div className="grid gap-8">
        <SectionPanel 
          title="Active Operational Units" 
          description="High-priority trip monitoring. Emergency actions should be used with extreme caution."
          icon={TruckIcon}
        >
          {trips.length ? (
            <div className="grid gap-6">
              {trips.map((trip) => (
                <article key={trip.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:shadow-xl hover:shadow-slate-200/50 xl:flex xl:items-stretch">
                  <div className="flex-1 p-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm">
                        <TruckIcon className="h-4 w-4" />
                      </span>
                      <h3 className="text-lg font-bold tracking-tight text-slate-900">
                        {trip.direction} Cycle — {formatDate(trip.trip_date)} at {formatTime(trip.departure_time)}
                      </h3>
                      <StatusBadge value={trip.operational_status || trip.status} />
                    </div>
                    
                    <div className="mt-6 grid gap-4 sm:grid-cols-3">
                      <SummaryItem label="Vehicle" value={trip.bus?.bus_code || '-'} />
                      <SummaryItem label="Operator" value={trip.driver?.name || '-'} />
                      <SummaryItem label="Demand" value={`${trip.confirmed_bookings_count || 0} Bookings`} />
                    </div>
                    
                    {trip.status_note ? (
                      <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-medium text-slate-600 border border-slate-100 italic">
                        "{trip.status_note}"
                      </div>
                    ) : null}
                  </div>

                  <div className="w-full border-t border-slate-100 bg-slate-50/50 p-6 xl:w-[400px] xl:border-l xl:border-t-0">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dispatch Override Reason</label>
                        <textarea
                          className="form-input min-h-[100px] bg-white resize-none"
                          value={cancelReasons[trip.id] || ''}
                          aria-invalid={Boolean(cancelReasonErrors[trip.id])}
                          onChange={(event) => {
                            setCancelReasons((current) => ({ ...current, [trip.id]: event.target.value }))
                            setCancelReasonErrors((current) => ({ ...current, [trip.id]: '' }))
                            setServerError('')
                          }}
                          placeholder="Must provide detailed justification for emergency cancellation..."
                        />
                        {cancelReasonErrors[trip.id] ? (
                          <p className="flex items-center gap-1.5 text-xs font-medium text-rose-600" role="alert">
                            <span className="h-1 w-1 rounded-full bg-rose-600" />
                            {cancelReasonErrors[trip.id]}
                          </p>
                        ) : null}
                      </div>
                      <SubmitButton
                        className="primary-button w-full from-rose-600 to-rose-700 shadow-rose-500/20 hover:from-rose-500 hover:to-rose-600"
                        type="button"
                        disabled={emergencyCancel.isPending || trip.status === 'cancelled'}
                        icon={ShieldExclamationIcon}
                        isLoading={emergencyCancel.isPending && emergencyCancel.variables?.tripId === trip.id}
                        loadingText="Cancelling..."
                        onClick={() => submitEmergencyCancel(trip)}
                      >
                        Execute Emergency Cancel
                      </SubmitButton>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="py-12">
              <EmptyState 
                title={operationsQuery.isLoading ? 'Syncing fleet status...' : 'No active units'} 
                description="Currently no vehicles are on active transit cycles."
              />
            </div>
          )}
        </SectionPanel>

        <SectionPanel 
          title="Incident Reports" 
          description="Driver-reported issues requiring immediate administrative resolution." 
          icon={BellAlertIcon}
        >
          {openIssues.length ? (
            <div className="grid gap-6">
              {openIssues.map((issue) => (
                <article key={issue.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:shadow-xl hover:shadow-slate-200/50 xl:flex xl:items-stretch">
                  <div className="flex-1 p-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-bold tracking-tight text-slate-900">{issue.title}</h3>
                      <StatusBadge value={issue.issue_type} />
                      <StatusBadge value={issue.severity} />
                    </div>
                    <p className="mt-4 text-base font-medium leading-relaxed text-slate-600">{issue.message}</p>
                    <div className="mt-6 flex items-center gap-4 border-t border-slate-100 pt-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <span>Operator: {issue.driver?.name || '-'}</span>
                      <span className="h-1 w-1 rounded-full bg-slate-200" />
                      <span>Vehicle: {issue.trip?.bus?.bus_code || '-'}</span>
                      <span className="h-1 w-1 rounded-full bg-slate-200" />
                      <span>{formatDateTime(issue.reported_at)}</span>
                    </div>
                  </div>
                  <div className="w-full border-t border-slate-100 bg-slate-50/50 p-6 xl:w-[360px] xl:border-l xl:border-t-0">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resolution Log</label>
                        <textarea
                          className="form-input min-h-[100px] bg-white resize-none"
                          value={resolutionNotes[issue.id] || ''}
                          aria-invalid={Boolean(resolutionNoteErrors[issue.id])}
                          onChange={(event) => {
                            setResolutionNotes((current) => ({ ...current, [issue.id]: event.target.value }))
                            setResolutionNoteErrors((current) => ({ ...current, [issue.id]: '' }))
                            setServerError('')
                          }}
                          placeholder="Log resolution steps taken..."
                        />
                        {resolutionNoteErrors[issue.id] ? (
                          <p className="flex items-center gap-1.5 text-xs font-medium text-rose-600" role="alert">
                            <span className="h-1 w-1 rounded-full bg-rose-600" />
                            {resolutionNoteErrors[issue.id]}
                          </p>
                        ) : null}
                      </div>
                      <SubmitButton
                        className="primary-button w-full"
                        type="button"
                        disabled={resolveIssue.isPending}
                        isLoading={resolveIssue.isPending && resolveIssue.variables?.issueId === issue.id}
                        loadingText="Resolving..."
                        onClick={() => submitIssueResolution(issue)}
                      >
                        Submit Resolution
                      </SubmitButton>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="py-12">
              <EmptyState 
                title={operationsQuery.isLoading ? 'Checking for incidents...' : 'Clear skies'} 
                description="No open driver issues requiring attention at this time."
              />
            </div>
          )}
        </SectionPanel>
      </div>
    </div>
  )
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-colors group-hover:border-slate-300">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p>
      <p className="mt-1.5 truncate text-sm font-bold text-slate-900">{value || '-'}</p>
    </div>
  )
}


export default OperationsPage
