import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  TruckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'
import EmptyState from '../components/EmptyState.jsx'
import MetricCard from '../components/MetricCard.jsx'
import PageHeader from '../components/PageHeader.jsx'
import SectionPanel from '../components/SectionPanel.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { api } from '../lib/api.js'
import { formatDate, formatTime } from '../lib/dateUtils.js'

function DashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const response = await api.get('/admin/dashboard')
      return response.data.data
    },
  })

  const tripsQuery = useQuery({
    queryKey: ['admin', 'trips', 'dashboard'],
    queryFn: async () => {
      const response = await api.get('/admin/trips')
      return response.data.data
    },
  })

  const metrics = dashboardQuery.data ?? {}
  const scheduledTrips = (tripsQuery.data ?? []).filter((trip) => trip.status === 'scheduled').slice(0, 6)

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Operations Dashboard"
        description="Current operating totals for buses, drivers, trips, and bookings."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Active buses" value={metrics.active_buses} icon={TruckIcon} />
        <MetricCard label="Active drivers" value={metrics.active_drivers} icon={UserGroupIcon} />
        <MetricCard label="Scheduled trips" value={metrics.scheduled_trips} icon={CalendarDaysIcon} />
        <MetricCard label="Pending bookings" value={metrics.pending_bookings} icon={ClockIcon} />
        <MetricCard label="Confirmed bookings" value={metrics.confirmed_bookings} icon={CheckCircleIcon} />
      </div>

      <SectionPanel title="Upcoming scheduled trips" icon={CalendarDaysIcon}>
        {scheduledTrips.length === 0 ? (
          <EmptyState title="No scheduled trips" description="Create trip cycles from the Trips page." />
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
                  <th>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scheduledTrips.map((trip) => (
                  <tr key={trip.id}>
                    <td>{formatDate(trip.trip_date)}</td>
                    <td>{formatTime(trip.departure_time)}</td>
                    <td className="capitalize">{trip.direction}</td>
                    <td>{trip.bus?.bus_code ?? '-'}</td>
                    <td>{trip.driver?.name ?? '-'}</td>
                    <td><StatusBadge value={trip.status} /></td>
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

export default DashboardPage
