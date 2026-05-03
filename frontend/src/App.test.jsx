import { render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { QueryClient } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import App from './App.jsx'

function renderApp() {
  const queryClient = new QueryClient()

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

test('renders the login screen when unauthenticated', () => {
  renderApp()

  expect(screen.getAllByText('FerryBus').length).toBeGreaterThan(0)
  expect(screen.getByText('Welcome Back')).toBeInTheDocument()
  expect(screen.getByText('Sign in to manage your transit ecosystem.')).toBeInTheDocument()
})

test('renders the operations workspace when authenticated', () => {
  window.localStorage.setItem('ferry_bus_auth_token', 'test-token')
  window.localStorage.setItem(
    'ferry_bus_auth_user',
    JSON.stringify({
      id: 1,
      name: 'System Admin',
      email: 'admin@ferrybus.local',
      role: 'admin',
      status: 'active',
    }),
  )

  renderApp()

  expect(screen.getByText('Ferry Operations System')).toBeInTheDocument()
  expect(screen.getAllByText('Trips').length).toBeGreaterThan(0)
  expect(screen.getByText('Active Buses')).toBeInTheDocument()
})
