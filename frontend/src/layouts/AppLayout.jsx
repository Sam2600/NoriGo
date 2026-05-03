import {
  ArrowRightStartOnRectangleIcon,
  BellIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  Bars3Icon,
  HomeIcon,
  MapIcon,
  MapPinIcon,
  TruckIcon,
  UserCircleIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { api } from '../lib/api.js'

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon, roles: ['admin'] },
  { name: 'Tracking', href: '/tracking', icon: MapIcon, roles: ['user'] },
  { name: 'Trips', href: '/trips', icon: CalendarDaysIcon, roles: ['admin'] },
  { name: 'Bookings', href: '/bookings', icon: CheckCircleIcon, roles: ['admin', 'user'] },
  { name: 'Driver Trips', href: '/driver-trips', icon: ClipboardDocumentCheckIcon, roles: ['driver'] },
  { name: 'Buses', href: '/buses', icon: TruckIcon, roles: ['admin'] },
  { name: 'Drivers', href: '/drivers', icon: UsersIcon, roles: ['admin'] },
  { name: 'Locations', href: '/locations', icon: MapPinIcon, roles: ['admin'] },
  { name: 'Notifications', href: '/notifications', icon: BellIcon },
  { name: 'Profile', href: '/profile', icon: UserCircleIcon },
]

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

function AppLayout({ user, onLogout }) {
  const location = useLocation()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => (
    window.localStorage.getItem('ferry_bus_sidebar_collapsed') === 'true'
  ))
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await api.get('/notifications')
      return response.data
    },
  })
  const unreadCount = notificationsQuery.data?.meta?.unread_count || 0
  const visibleNavigation = navigation.filter((item) => !item.roles || item.roles.includes(user.role))
  const activePage = visibleNavigation
    .filter((item) => item.href === location.pathname)
    .at(-1) || visibleNavigation[0]
  const ActiveIcon = activePage?.icon || HomeIcon
  const userInitials = user.name
    .split(' ')
    .map((part) => part.at(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()

  useEffect(() => {
    window.localStorage.setItem('ferry_bus_sidebar_collapsed', String(isSidebarCollapsed))
  }, [isSidebarCollapsed])

  const sidebar = (
    <Sidebar
      collapsed={isSidebarCollapsed}
      navigation={visibleNavigation}
      user={user}
      userInitials={userInitials}
      onCollapseToggle={() => setIsSidebarCollapsed((current) => !current)}
      onCloseMobile={() => setIsMobileSidebarOpen(false)}
    />
  )

  return (
    <div className="min-h-screen">
      <div
        className={classNames(
          'fixed inset-y-0 left-0 z-40 hidden bg-slate-900 border-r border-slate-800 transition-[width] duration-300 ease-in-out lg:block',
          isSidebarCollapsed ? 'w-20' : 'w-72',
        )}
      >
        {sidebar}
      </div>

      {isMobileSidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" aria-modal="true" role="dialog">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-label="Close sidebar"
          />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[calc(100vw-2rem)] bg-slate-900 shadow-2xl">
            <Sidebar
              collapsed={false}
              isMobile
              navigation={visibleNavigation}
              user={user}
              userInitials={userInitials}
              onCollapseToggle={() => setIsMobileSidebarOpen(false)}
              onCloseMobile={() => setIsMobileSidebarOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div
        className={classNames(
          'transition-[padding] duration-300 ease-in-out',
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72',
        )}
      >
        <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
          <div className="app-page-shell flex min-h-20 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
            <div className="min-w-0">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg hover:bg-slate-800 lg:hidden"
                  aria-label="Open sidebar"
                >
                  <Bars3Icon className="h-5 w-5" aria-hidden="true" />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="hidden h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-200 sm:flex">
                      <ActiveIcon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h1 className="truncate text-lg font-bold tracking-tight text-slate-900">{activePage?.name || 'Workspace'}</h1>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Ferry Operations System</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/notifications"
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-teal-600 active:scale-95"
                aria-label="Notifications"
              >
                <BellIcon className="h-5 w-5" aria-hidden="true" />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                    {unreadCount}
                  </span>
                ) : null}
              </Link>
              <div className="hidden items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm sm:flex">
                <div className="h-8 w-8 rounded-lg bg-teal-500 flex items-center justify-center text-white text-xs font-bold">
                  {userInitials}
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-900">{user.name}</span>
                  <span className="block truncate text-[10px] font-bold uppercase tracking-wider text-teal-600">{user.role}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 active:scale-95"
                aria-label="Log out"
              >
                <ArrowRightStartOnRectangleIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        <main className="app-page-shell px-4 py-8 sm:px-6 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Sidebar({
  collapsed,
  isMobile = false,
  navigation,
  user,
  userInitials,
  onCollapseToggle,
  onCloseMobile,
}) {
  return (
    <aside className="flex h-full flex-col overflow-hidden bg-slate-900">
      <div
        className={classNames(
          'flex h-20 items-center px-6',
          collapsed ? 'justify-center' : 'justify-between',
        )}
      >
        <div className={classNames('flex min-w-0 items-center', collapsed ? 'justify-center' : 'gap-4')}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-lg shadow-teal-900/20">
            <TruckIcon className="h-6 w-6" aria-hidden="true" />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-black uppercase tracking-widest text-white">FerryBus</p>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">System Active</p>
              </div>
            </div>
          ) : null}
        </div>

        {!collapsed ? (
          <button
            type="button"
            onClick={isMobile ? onCloseMobile : onCollapseToggle}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            aria-label={isMobile ? 'Close sidebar' : 'Collapse sidebar'}
          >
            {isMobile ? (
              <XMarkIcon className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex-1 space-y-1 px-3">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            onClick={isMobile ? onCloseMobile : undefined}
            title={collapsed ? item.name : undefined}
            className={({ isActive }) =>
              classNames(
                'group relative flex items-center rounded-xl text-sm transition-all duration-200',
                collapsed ? 'h-12 justify-center px-0' : 'gap-3 px-4 py-3',
                isActive
                  ? 'bg-teal-500 font-bold text-white shadow-lg shadow-teal-900/20'
                  : 'font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100',
              )
            }
          >
            <item.icon className={classNames('h-5 w-5 shrink-0', collapsed ? '' : '')} aria-hidden="true" />
            {!collapsed ? <span className="truncate tracking-tight">{item.name}</span> : null}
            {collapsed ? (
              <span className="pointer-events-none absolute left-full ml-4 hidden rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white shadow-xl ring-1 ring-slate-700 group-hover:block z-50 whitespace-nowrap">
                {item.name}
              </span>
            ) : null}
          </NavLink>
        ))}
      </div>

      <div className="mt-auto border-t border-slate-800 p-4">
        {collapsed ? (
          <button
            type="button"
            onClick={onCollapseToggle}
            className="flex h-10 w-full items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : (
          <div className="rounded-xl bg-slate-800/50 p-4 border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">
                {userInitials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">{user.name}</p>
                <p className="truncate text-[9px] font-bold uppercase tracking-wider text-teal-500">{user.role}</p>
              </div>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed font-medium text-slate-500">
              Operations Control Panel v2.1
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}

export default AppLayout
