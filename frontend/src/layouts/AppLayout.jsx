import {
  ArrowLeftOnRectangleIcon,
  BellIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  HomeIcon,
  IdentificationIcon,
  MapPinIcon,
  TruckIcon,
  UserCircleIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { clearAuthSession } from '../features/auth/authStorage.js'
import { api } from '../lib/api.js'

const navItems = {
  admin: [
    { to: '/', label: 'Dashboard', icon: HomeIcon, end: true },
    { to: '/trips', label: 'Trips', icon: CalendarDaysIcon },
    { to: '/bookings', label: 'Bookings', icon: ClipboardDocumentListIcon },
    { to: '/buses', label: 'Buses', icon: TruckIcon },
    { to: '/drivers', label: 'Drivers', icon: IdentificationIcon },
    { to: '/locations', label: 'Locations', icon: MapPinIcon },
  ],
  driver: [
    { to: '/driver-trips', label: 'My Trips', icon: CalendarDaysIcon },
  ],
  user: [
    { to: '/bookings', label: 'Bookings', icon: ClipboardDocumentListIcon },
  ],
}

function AppLayout({ currentUser, onLogout }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const items = navItems[currentUser?.role] ?? navItems.user

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await api.get('/notifications')
      return response.data
    },
    enabled: Boolean(currentUser),
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout')
    },
    onSettled: () => {
      clearAuthSession()
      queryClient.clear()
      onLogout()
      navigate('/login', { replace: true })
    },
  })

  const unreadCount = notificationsQuery.data?.meta?.unread_count ?? 0

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-slate-800 bg-slate-950 px-4 py-5 text-white lg:block">
        <div className="px-2">
          <p className="text-xl font-bold tracking-normal">FerryBus</p>
          <p className="mt-1 text-sm text-slate-400">{currentUser?.name}</p>
        </div>

        <nav className="mt-8 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  isActive ? 'bg-teal-500 text-white' : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                }`
              }
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to="/notifications"
            className={({ isActive }) =>
              `flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                isActive ? 'bg-teal-500 text-white' : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`
            }
          >
            <span className="flex items-center gap-3">
              <BellIcon className="h-5 w-5" aria-hidden="true" />
              Notifications
            </span>
            {unreadCount > 0 ? (
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-950">{unreadCount}</span>
            ) : null}
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                isActive ? 'bg-teal-500 text-white' : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`
            }
          >
            <UserCircleIcon className="h-5 w-5" aria-hidden="true" />
            Profile
          </NavLink>
        </nav>

        <button
          type="button"
          className="absolute bottom-5 left-4 right-4 flex items-center justify-center gap-2 rounded-lg border border-slate-800 px-3 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-900 hover:text-white"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          <ArrowLeftOnRectangleIcon className="h-5 w-5" aria-hidden="true" />
          Sign out
        </button>
      </aside>

      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-base font-bold text-slate-950">FerryBus</p>
            <p className="text-xs text-slate-500">{currentUser?.role}</p>
          </div>
          <button
            type="button"
            className="secondary-button px-3 py-2"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            aria-label="Sign out"
          >
            <ArrowLeftOnRectangleIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {[...items, { to: '/notifications', label: 'Alerts', icon: BellIcon }, { to: '/profile', label: 'Profile', icon: UsersIcon }].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                  isActive ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'
                }`
              }
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="lg:pl-72">
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default AppLayout
