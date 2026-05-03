import { useQuery } from '@tanstack/react-query'
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  TruckIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import StatusBadge from '../components/StatusBadge.jsx'
import EmptyState from '../components/EmptyState.jsx'
import MetricCard from '../components/MetricCard.jsx'
import PageHeader from '../components/PageHeader.jsx'
import SectionPanel from '../components/SectionPanel.jsx'
import { api } from '../lib/api.js'
import { formatDate, formatTime } from '../lib/dateUtils.js'

const metricConfig = [
  { key: 'active_buses', label: 'Active Buses', icon: TruckIcon, tone: 'teal' },
  { key: 'active_drivers', label: 'Active Drivers', icon: UsersIcon, tone: 'sky' },
  { key: 'scheduled_trips', label: 'Scheduled Trips', icon: CalendarDaysIcon, tone: 'violet' },
  { key: 'confirmed_bookings', label: 'Confirmed Bookings', icon: CheckCircleIcon, tone: 'teal' },
]

function DashboardPage({ user }) {
  const isAdmin = user?.role === 'admin'
  const dashboardQuery = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const response = await api.get('/admin/dashboard')
      return response.data.data
    },
    enabled: isAdmin,
  })
  const tripsQuery = useQuery({
    queryKey: ['admin-trips'],
    queryFn: async () => {
      const response = await api.get('/admin/trips')
      return response.data.data
    },
    enabled: isAdmin,
  })

  if (!isAdmin) {
    return (
      <SectionPanel title="Dashboard" description="Use bookings to view and manage your trips.">
        <div className="p-5">
          <p className="text-sm text-slate-600">Your trip tools are available from the navigation.</p>
        </div>
      </SectionPanel>
    )
  }

  const metrics = dashboardQuery.data || {}
  const trips = tripsQuery.data || []

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="System Intelligence"
        title="Fleet Command"
        description="Monitor real-time operations, passenger demand, and active transit cycles from a single unified view."
      />
      
      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {metricConfig.map((metric) => (
          <MetricCard
            key={metric.key}
            label={metric.label}
            value={dashboardQuery.isLoading ? '...' : (metrics[metric.key] ?? 0)}
            icon={metric.icon}
            tone={metric.tone}
          />
        ))}
      </section>

      <div className="grid gap-8">
        <SectionPanel 
          title="Active Transit Cycles" 
          description="Real-time status of current and upcoming ferry bus trips."
          icon={CalendarDaysIcon}
        >
          {trips.length ? (
            <div className="table-container">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Direction</th>
                    <th>Bus</th>
                    <th>Driver</th>
                    <th>Occupancy</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {trips.slice(0, 8).map((trip) => (
                    <tr key={trip.id} className="group">
                      <td className="font-medium text-slate-900">{formatDate(trip.trip_date)}</td>
                      <td>
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                          {formatTime(trip.departure_time)}
                        </span>
                      </td>
                      <td className="font-semibold text-slate-700">{trip.direction}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-teal-500" />
                          <span className="font-medium text-slate-900">{trip.bus?.bus_code || '-'}</span>
                        </div>
                      </td>
                      <td className="text-slate-500 font-medium">{trip.driver?.name || '-'}</td>
                      <td>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            <span>{trip.confirmed_bookings_count || 0} / {trip.bookings_count || 0}</span>
                            <span>{Math.round(((trip.confirmed_bookings_count || 0) / (trip.bus?.capacity || 20)) * 100)}%</span>
                          </div>
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div 
                              className="h-full bg-teal-500 transition-all duration-500" 
                              style={{ width: `${Math.min(100, ((trip.confirmed_bookings_count || 0) / (trip.bus?.capacity || 20)) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <StatusBadge value={trip.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12">
              <EmptyState 
                title={tripsQuery.isLoading ? 'Synchronizing fleet data...' : 'No active cycles found'} 
                description={tripsQuery.isLoading ? 'Please wait while we fetch the latest operational data.' : 'There are no trips scheduled for the selected period.'}
              />
            </div>
          )}
        </SectionPanel>
      </div>
    </div>
  )
}

export default DashboardPage
