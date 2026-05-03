import { BellIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import EmptyState from '../components/EmptyState.jsx'
import FormAlert from '../components/FormAlert.jsx'
import PageHeader from '../components/PageHeader.jsx'
import SectionPanel from '../components/SectionPanel.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { api } from '../lib/api.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { formatDateTime } from '../lib/dateUtils.js'

function NotificationsPage() {
  const queryClient = useQueryClient()

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await api.get('/notifications')
      return response.data
    },
  })

  const markReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      await api.post(`/notifications/${notificationId}/read`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllMutation = useMutation({
    mutationFn: async () => {
      await api.post('/notifications/read-all')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const notifications = notificationsQuery.data?.data ?? []
  const unreadCount = notificationsQuery.data?.meta?.unread_count ?? 0
  const mutationError = markReadMutation.error || markAllMutation.error

  return (
    <>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Booking, schedule, cancellation, and trip workflow updates."
        actions={
          <button
            type="button"
            className="secondary-button"
            disabled={unreadCount === 0 || markAllMutation.isPending}
            onClick={() => markAllMutation.mutate()}
          >
            <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
            Mark all read
          </button>
        }
      />

      <SectionPanel title={`${unreadCount} unread`} icon={BellIcon}>
        <FormAlert>{mutationError ? getApiErrorMessage(mutationError, 'Unable to update notifications.') : ''}</FormAlert>
        {notifications.length === 0 ? (
          <EmptyState title="No notifications" description="Operational messages appear here." />
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className={`rounded-lg border p-4 ${
                  notification.read_at ? 'border-slate-200 bg-white' : 'border-teal-200 bg-teal-50'
                }`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-slate-950">{notification.title}</h2>
                      <StatusBadge value={notification.type} />
                      <StatusBadge value={notification.priority} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{notification.message}</p>
                    <p className="mt-2 text-xs text-slate-400">{formatDateTime(notification.created_at)}</p>
                  </div>
                  {!notification.read_at ? (
                    <button
                      type="button"
                      className="secondary-button shrink-0 px-3 py-2"
                      disabled={markReadMutation.isPending}
                      onClick={() => markReadMutation.mutate(notification.id)}
                    >
                      <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
                      Mark read
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionPanel>
    </>
  )
}

export default NotificationsPage
