import { BellIcon, CheckCircleIcon, PaperAirplaneIcon, MegaphoneIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { z } from 'zod'
import EmptyState from '../components/EmptyState.jsx'
import PageHeader from '../components/PageHeader.jsx'
import SectionPanel from '../components/SectionPanel.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Field from '../components/Field.jsx'
import FormAlert from '../components/FormAlert.jsx'
import SubmitButton from '../components/SubmitButton.jsx'
import { api } from '../lib/api.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { formatDate, formatDateTime, formatTime } from '../lib/dateUtils.js'

const notificationSchema = z.object({
  audience: z.enum(['all', 'admin', 'driver', 'user', 'trip']),
  trip_id: z.string().optional(),
  type: z.enum(['system', 'trip_reminder', 'delay', 'schedule_change', 'cancellation', 'emergency']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  title: z.string().trim().min(3, 'Headline must be at least 3 characters.').max(120, 'Headline must be 120 characters or less.'),
  message: z.string().trim().min(5, 'Broadcast message must be at least 5 characters.').max(1000, 'Broadcast message must be 1000 characters or less.'),
}).superRefine((values, ctx) => {
  if (values.audience === 'trip' && !values.trip_id) {
    ctx.addIssue({
      code: 'custom',
      message: 'Select the transit cycle for this broadcast.',
      path: ['trip_id'],
    })
  }
})

function NotificationsPage({ user }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    audience: 'all',
    trip_id: '',
    type: 'system',
    priority: 'normal',
    title: '',
    message: '',
  })
  const [serverError, setServerError] = useState('')
  const [formErrors, setFormErrors] = useState({})
  const isAdmin = user?.role === 'admin'
  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await api.get('/notifications')
      return response.data
    },
  })
  const adminNotificationsQuery = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const response = await api.get('/admin/notifications')
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
  const markAsRead = useMutation({
    mutationFn: async (notificationId) => api.post(`/notifications/${notificationId}/read`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
  const markAllAsRead = useMutation({
    mutationFn: async () => api.post('/notifications/read-all'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
  const createNotification = useMutation({
    mutationFn: async (payload) => api.post('/admin/notifications', payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-notifications'] })
      setForm((current) => ({ ...current, title: '', message: '' }))
      setFormErrors({})
      setServerError('')
    },
    onError: (error) => {
      setServerError(getApiErrorMessage(error, 'Unable to create notifications.'))
    },
  })

  const notifications = notificationsQuery.data?.data || []
  const unreadCount = notificationsQuery.data?.meta?.unread_count || 0
  const adminNotifications = adminNotificationsQuery.data || []
  const trips = tripsQuery.data || []

  function updateFormField(field, value) {
    setServerError('')
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'audience' && value !== 'trip' ? { trip_id: '' } : {}),
    }))
    setFormErrors((current) => {
      const next = { ...current }
      delete next[field]

      if (field === 'audience') {
        delete next.trip_id
      }

      return next
    })
  }

  function submitBroadcast(event) {
    event.preventDefault()

    const result = notificationSchema.safeParse(form)

    if (!result.success) {
      setFormErrors(toFieldErrors(result.error))
      setServerError('Please fix the highlighted broadcast fields.')
      return
    }

    const values = result.data
    setFormErrors({})
    setServerError('')
    createNotification.mutate({
      audience: values.audience,
      trip_id: values.audience === 'trip' ? Number(values.trip_id) : null,
      title: values.title,
      message: values.message,
      type: values.type,
      priority: values.priority,
    })
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Communications"
        title="Dispatch Center"
        description={isAdmin
          ? 'Broadcast operational alerts, system updates, and trip-specific notifications to the fleet and passengers.'
          : 'Stay synchronized with real-time updates regarding your transit cycles and system announcements.'}
      />

      {isAdmin ? (
        <SectionPanel
          title="Compose Broadcast"
          description="Targeted communications across the transit network."
          icon={MegaphoneIcon}
        >
          <form
            className="grid gap-6 p-2 lg:grid-cols-2"
            onSubmit={submitBroadcast}
          >
            <FormAlert className="lg:col-span-2">{serverError}</FormAlert>
            
            <Field label="Target Audience" error={formErrors.audience}>
              <select
                className="form-input"
                value={form.audience}
                onChange={(event) => updateFormField('audience', event.target.value)}
              >
                <option value="all">EVERYONE (All active users)</option>
                <option value="admin">ADMINISTRATORS ONLY</option>
                <option value="driver">TRANSIT OPERATORS ONLY</option>
                <option value="user">PASSENGERS ONLY</option>
                <option value="trip">SPECIFIC TRANSIT CYCLE</option>
              </select>
            </Field>

            {form.audience === 'trip' ? (
              <Field label="Target Transit Cycle" error={formErrors.trip_id}>
                <select
                  className="form-input"
                  value={form.trip_id}
                  onChange={(event) => updateFormField('trip_id', event.target.value)}
                >
                  <option value="">Select an active cycle</option>
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {formatDate(trip.trip_date)} {formatTime(trip.departure_time)} — {trip.direction.toUpperCase()} — {trip.bus?.bus_code || 'UNASSIGNED'}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Notification Category" error={formErrors.type}>
                <select
                  className="form-input"
                  value={form.type}
                  onChange={(event) => updateFormField('type', event.target.value)}
                >
                  <option value="system">SYSTEM ANNOUNCEMENT</option>
                  <option value="trip_reminder">TRANSIT REMINDER</option>
                  <option value="delay">OPERATIONAL DELAY</option>
                  <option value="schedule_change">SCHEDULE MODIFICATION</option>
                  <option value="cancellation">CANCELLATION ALERT</option>
                  <option value="emergency">EMERGENCY BROADCAST</option>
                </select>
              </Field>
              <Field label="Priority Level" error={formErrors.priority}>
                <select
                  className="form-input"
                  value={form.priority}
                  onChange={(event) => updateFormField('priority', event.target.value)}
                >
                  <option value="low">LOW PRIORITY</option>
                  <option value="normal">NORMAL PRIORITY</option>
                  <option value="high">HIGH PRIORITY</option>
                  <option value="urgent">URGENT PRIORITY</option>
                </select>
              </Field>
            </div>

            <div className="lg:col-span-2">
              <Field label="Headline" error={formErrors.title}>
                <input
                  className="form-input"
                  placeholder="e.g. Scheduled Maintenance for BUS-001"
                  value={form.title}
                  onChange={(event) => updateFormField('title', event.target.value)}
                />
              </Field>
            </div>

            <div className="lg:col-span-2">
              <Field label="Broadcast Message Content" error={formErrors.message}>
                <textarea
                  className="form-input min-h-[120px] resize-none"
                  placeholder="Provide detailed information regarding this broadcast..."
                  value={form.message}
                  onChange={(event) => updateFormField('message', event.target.value)}
                />
              </Field>
            </div>

            <div className="lg:col-span-2 pt-2">
              <SubmitButton
                className="primary-button w-full sm:w-auto py-3 px-8 text-xs font-black uppercase tracking-widest"
                disabled={createNotification.isPending}
                icon={PaperAirplaneIcon}
                isLoading={createNotification.isPending}
                loadingText="Transmitting..."
              >
                Transmit Broadcast
              </SubmitButton>
            </div>
          </form>
        </SectionPanel>
      ) : null}

      <div className="grid gap-10">
        <SectionPanel
          title="Personal Stream"
          description="Real-time log of communications delivered to your profile."
          icon={BellIcon}
          actions={(
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                {unreadCount} NEW MESSAGES
              </span>
              <button
                className="secondary-button py-2 px-4 text-xs font-bold uppercase tracking-wider"
                type="button"
                disabled={!unreadCount || markAllAsRead.isPending}
                onClick={() => markAllAsRead.mutate()}
              >
                Mark All Read
              </button>
            </div>
          )}
        >
          {notifications.length ? (
            <div className="grid gap-4">
              {notifications.map((notification) => (
                <article key={notification.id} className={`group relative overflow-hidden rounded-2xl border transition-all p-5 flex flex-col md:flex-row md:items-center gap-6 ${notification.read_at ? 'bg-white border-slate-100 opacity-70' : 'bg-white border-slate-200 shadow-md ring-1 ring-slate-200'}`}>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className={`text-base font-bold tracking-tight ${notification.read_at ? 'text-slate-600' : 'text-slate-900'}`}>{notification.title}</h3>
                      <StatusBadge value={notification.type} />
                      <StatusBadge value={notification.priority || 'normal'} />
                    </div>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">{notification.message}</p>
                    <p className="mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDateTime(notification.created_at)}</p>
                  </div>
                  
                  <div className="flex items-center gap-4 border-t border-slate-50 pt-4 md:border-t-0 md:pt-0">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${notification.read_at ? 'text-slate-400' : 'text-teal-600'}`}>
                      {notification.read_at ? 'PROCESSED' : 'ACTIVE'}
                    </span>
                    <button
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-90 ${notification.read_at ? 'bg-slate-50 text-slate-300' : 'bg-teal-50 text-teal-600 hover:bg-teal-600 hover:text-white shadow-sm'}`}
                      type="button"
                      disabled={markAsRead.isPending || Boolean(notification.read_at)}
                      onClick={() => markAsRead.mutate(notification.id)}
                      title="Mark as Processed"
                    >
                      <CheckCircleIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="py-20">
              <EmptyState title={notificationsQuery.isLoading ? 'Syncing stream...' : 'Stream Empty'} description="You have no notifications at this time." />
            </div>
          )}
        </SectionPanel>

        {isAdmin ? (
          <SectionPanel
            title="Operational Broadcast Log"
            description="Archive of all transmitted communications across the system."
            icon={CheckCircleIcon}
          >
            {adminNotifications.length ? (
              <div className="table-container">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead>
                    <tr>
                      <th>Recipient Profile</th>
                      <th>Headline</th>
                      <th>Category</th>
                      <th>Priority</th>
                      <th>Transmission Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {adminNotifications.slice(0, 25).map((notification) => (
                      <tr key={notification.id} className="group">
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 font-bold text-[10px]">
                              {notification.user?.name?.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-bold text-slate-900 text-xs">{notification.user?.name || '-'}</span>
                          </div>
                        </td>
                        <td className="max-w-[300px]">
                          <p className="truncate text-xs font-medium text-slate-600">{notification.title}</p>
                        </td>
                        <td><StatusBadge value={notification.type} /></td>
                        <td><StatusBadge value={notification.priority || 'normal'} /></td>
                        <td>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDateTime(notification.created_at)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-20">
                <EmptyState title={adminNotificationsQuery.isLoading ? 'Retrieving logs...' : 'Log Empty'} description="No system-wide broadcasts have been recorded." />
              </div>
            )}
          </SectionPanel>
        ) : null}
      </div>
    </div>
  )
}

function toFieldErrors(zodError) {
  return Object.fromEntries(
    Object.entries(zodError.flatten().fieldErrors)
      .map(([field, messages]) => [field, messages?.[0]])
      .filter(([, message]) => Boolean(message)),
  )
}


export default NotificationsPage
