import {
  ClockIcon,
  MapPinIcon,
  TruckIcon,
} from '@heroicons/react/24/outline'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import EmptyState from '../components/EmptyState.jsx'
import LiveMap from '../components/LiveMap.jsx'
import PageHeader from '../components/PageHeader.jsx'
import SectionPanel from '../components/SectionPanel.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { useRealtimeChannel } from '../hooks/useRealtimeChannel.js'
import { api } from '../lib/api.js'
import { formatDate, formatDateTime, formatTime } from '../lib/dateUtils.js'
import { stopsFromBooking } from '../lib/routeStops.js'

function TrackingPage({ user }) {
  const queryClient = useQueryClient()
  const trackingQuery = useQuery({
    queryKey: ['active-tracking'],
    queryFn: async () => {
      const response = await api.get('/tracking/active')
      return response.data.data
    },
    enabled: user?.role === 'user',
    refetchInterval: 10000,
  })
  const data = trackingQuery.data
  const tripId = data?.trip?.id
  const realtimeEvents = useMemo(() => [
    {
      event: 'trip.location.updated',
      handler: () => queryClient.invalidateQueries({ queryKey: ['active-tracking'] }),
    },
    {
      event: 'trip.status.updated',
      handler: () => queryClient.invalidateQueries({ queryKey: ['active-tracking'] }),
    },
  ], [queryClient])
  const routeStops = useMemo(() => {
    if (!data) return []

    return data.route_stops?.length ? data.route_stops : stopsFromBooking(data.booking)
  }, [data])

  useRealtimeChannel(tripId ? `trips.${tripId}` : null, realtimeEvents)

  if (user?.role !== 'user') {
    return (
      <div className="py-20">
        <EmptyState 
          title="Access Restricted" 
          description="Live tracking is exclusively available for passenger accounts with confirmed bookings." 
        />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-10">
        <PageHeader
          eyebrow="Journey Monitoring"
          title="Live Transit Tracking"
          description="Track your confirmed ferry bus in real-time once the journey begins."
        />
        <SectionPanel title="Tracking Status" icon={TruckIcon}>
          <div className="py-20">
            <EmptyState 
              title={trackingQuery.isLoading ? 'Establishing satellite link...' : 'No Active Journeys'} 
              description={trackingQuery.isLoading ? 'Please wait while we connect to the fleet tracking system.' : 'You don’t have any confirmed active bookings to track at the moment.'}
            />
          </div>
        </SectionPanel>
      </div>
    )
  }

  const trip = data.trip
  const latestLocation = data.latest_location

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Real-time Telemetry"
        title="Live Transit Tracking"
        description="Monitor your vehicle’s precise location, estimated time of arrival, and route progress."
      />

      <SectionPanel
        title="Active Transit Stream"
        description="System refreshes automatically. Live GPS feed from your driver."
        icon={TruckIcon}
        actions={<StatusBadge value={trip.operational_status || trip.status} />}
      >
        <div className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryItem label="Scheduled Cycle" value={`${formatDate(trip.trip_date)} ${formatTime(trip.departure_time)}`} />
            <SummaryItem label="Transit Route" value={trip.direction} />
            <SummaryItem label="Assigned Unit" value={trip.bus?.bus_code || '-'} />
            <SummaryItem label="Assigned Pilot" value={trip.driver?.name || '-'} />
            <div className="rounded-2xl border-none bg-teal-500 p-4 shadow-lg shadow-teal-500/20 text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-teal-100">Estimated Arrival</p>
              <p className="mt-1.5 truncate text-sm font-black uppercase tracking-tight">
                {formatDateTime(trip.eta_at || latestLocation?.eta_at)}
              </p>
            </div>
          </div>

          <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
              <LiveMap
                points={data.location_history || []}
                latestLocation={latestLocation}
                routeStops={routeStops}
                routeGeometry={data.route_geometry}
                height={500}
              />
            </div>

            <div className="flex flex-col gap-4">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Journey Logistics</h4>
              <InfoBlock
                icon={MapPinIcon}
                label="Pickup Terminal"
                value={data.booking?.pickup_location?.name || '-'}
                detail={data.booking?.pickup_location?.address}
                tone="teal"
              />
              <InfoBlock
                icon={MapPinIcon}
                label="Destination"
                value={data.booking?.dropoff_location?.name || '-'}
                detail={data.booking?.dropoff_location?.address}
                tone="blue"
              />
              <RouteSequence stops={routeStops} booking={data.booking} />
              {trip.delay_minutes ? (
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-5 text-rose-700 shadow-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white">
                    <ClockIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">Delay Warning</p>
                    <p className="text-sm font-bold mt-0.5">Vehicle running {trip.delay_minutes} minutes behind schedule.</p>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-emerald-700 shadow-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                    <TruckIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Transit Status</p>
                    <p className="text-sm font-bold mt-0.5">Vehicle is currently proceeding on schedule.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionPanel>
    </div>
  )
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 transition-colors">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p>
      <p className="mt-1.5 truncate text-sm font-bold text-slate-900">{value || '-'}</p>
    </div>
  )
}

function InfoBlock({ icon: Icon, label, value, detail, tone = 'slate' }) {
  const tones = {
    teal: 'bg-teal-50 text-teal-600 border-teal-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
  }
  
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${tones[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
          <p className="mt-0.5 text-sm font-bold text-slate-900">{value}</p>
        </div>
      </div>
      {detail ? (
        <p className="mt-3 border-t border-slate-50 pt-3 text-xs font-medium leading-relaxed text-slate-500 italic">
          {detail}
        </p>
      ) : null}
    </div>
  )
}

function RouteSequence({ stops, booking }) {
  const pickupLocationId = booking?.pickup_location_id || booking?.pickup_location?.id
  const dropoffLocationId = booking?.dropoff_location_id || booking?.dropoff_location?.id

  if (!stops?.length) {
    return null
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Pickup / Drop-off Sequence</h4>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
          {stops.length} stops
        </span>
      </div>
      <div className="mt-4 max-h-[220px] space-y-2 overflow-y-auto pr-1">
        {stops.map((stop, index) => {
          const isPickup = stop.location_id === pickupLocationId && ['pickup', 'origin_pickup', 'origin'].includes(stop.type)
          const isDropoff = stop.location_id === dropoffLocationId && ['dropoff', 'final_dropoff', 'final_destination'].includes(stop.type)

          return (
            <article
              key={`${stop.location_id}-${stop.type}-${index}`}
              className={`flex gap-3 rounded-xl border p-3 ${
                isPickup || isDropoff
                  ? 'border-teal-100 bg-teal-50/70'
                  : 'border-slate-100 bg-slate-50/60'
              }`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black text-white ${
                isRouteDropoff(stop.type) ? 'bg-violet-600' : 'bg-teal-600'
              }`}>
                {stop.sequence || index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-black text-slate-900">{stop.name || 'Unnamed Stop'}</p>
                  {isPickup ? <RouteBadge label="Your Pickup" /> : null}
                  {isDropoff ? <RouteBadge label="Your Destination" /> : null}
                </div>
                <p className={`mt-1 text-[10px] font-black uppercase tracking-widest ${
                  isRouteDropoff(stop.type) ? 'text-violet-500' : 'text-teal-600'
                }`}>
                  {routeStopLabel(stop.type)}
                </p>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function RouteBadge({ label }) {
  return (
    <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-teal-700 ring-1 ring-teal-100">
      {label}
    </span>
  )
}

function isRouteDropoff(type) {
  return ['dropoff', 'final_dropoff', 'final_destination'].includes(type)
}

function routeStopLabel(type) {
  const labels = {
    origin: 'Route Start',
    origin_pickup: 'Initial Pickup',
    pickup: 'Passenger Pickup',
    dropoff: 'Passenger Drop-off',
    final_dropoff: 'Final Drop-off',
    final_destination: 'Route End',
  }

  return labels[type] || type?.replaceAll('_', ' ') || 'Route Stop'
}

export default TrackingPage
