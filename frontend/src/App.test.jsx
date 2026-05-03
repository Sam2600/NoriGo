import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { clearAuthSession, saveAuthSession } from './features/auth/authStorage.js'

vi.mock('./lib/api.js', () => ({
  api: {
    get: vi.fn((url) => {
      if (url === '/notifications') {
        return Promise.resolve({ data: { data: [], meta: { unread_count: 0 } } })
      }
      if (url === '/admin/dashboard') {
        return Promise.resolve({
          data: {
            data: {
              active_buses: 1,
              active_drivers: 1,
              scheduled_trips: 0,
              pending_bookings: 0,
              confirmed_bookings: 0,
            },
          },
        })
      }
      if (url === '/admin/trips') {
        return Promise.resolve({ data: { data: [] } })
      }
      return Promise.resolve({ data: { data: [] } })
    }),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
}))

function renderApp(route = '/login') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('App', () => {
  beforeEach(() => {
    clearAuthSession()
  })

  afterEach(() => {
    clearAuthSession()
  })

  it('renders the login page for guests', () => {
    renderApp('/login')

    expect(screen.getByRole('heading', { name: /sign in to ferrybus/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /register/i })).toBeInTheDocument()
  })

  it('routes an authenticated admin to the dashboard', async () => {
    saveAuthSession({
      token: 'test-token',
      user: {
        id: 1,
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
        status: 'active',
      },
    })

    renderApp('/')

    expect(screen.getByRole('heading', { name: /operations dashboard/i })).toBeInTheDocument()
    expect(await screen.findByText(/active buses/i)).toBeInTheDocument()
  })
})
