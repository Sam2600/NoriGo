import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout.jsx'
import BookingsPage from './pages/BookingsPage.jsx'
import BusesPage from './pages/BusesPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import DriverTripsPage from './pages/DriverTripsPage.jsx'
import DriversPage from './pages/DriversPage.jsx'
import LocationsPage from './pages/LocationsPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import NotificationsPage from './pages/NotificationsPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import TripsPage from './pages/TripsPage.jsx'
import { getStoredUser } from './features/auth/authStorage.js'
import { defaultRouteForRole } from './lib/roleRoutes.js'

function RequireAuth({ currentUser, children }) {
  if (!currentUser) return <Navigate to="/login" replace />
  return children
}

function RequireRole({ currentUser, roles, children }) {
  if (!roles.includes(currentUser?.role)) {
    return <Navigate to={defaultRouteForRole(currentUser?.role)} replace />
  }

  return children
}

function App() {
  const [currentUser, setCurrentUser] = useState(() => getStoredUser())

  return (
    <Routes>
      <Route
        path="/login"
        element={
          currentUser ? (
            <Navigate to={defaultRouteForRole(currentUser.role)} replace />
          ) : (
            <LoginPage onAuthenticated={setCurrentUser} />
          )
        }
      />
      <Route
        path="/register"
        element={
          currentUser ? (
            <Navigate to={defaultRouteForRole(currentUser.role)} replace />
          ) : (
            <RegisterPage onAuthenticated={setCurrentUser} />
          )
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth currentUser={currentUser}>
            <AppLayout currentUser={currentUser} onLogout={() => setCurrentUser(null)} />
          </RequireAuth>
        }
      >
        <Route
          index
          element={
            <RequireRole currentUser={currentUser} roles={['admin']}>
              <DashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="trips"
          element={
            <RequireRole currentUser={currentUser} roles={['admin']}>
              <TripsPage />
            </RequireRole>
          }
        />
        <Route
          path="bookings"
          element={
            <RequireRole currentUser={currentUser} roles={['admin', 'user']}>
              <BookingsPage currentUser={currentUser} />
            </RequireRole>
          }
        />
        <Route
          path="driver-trips"
          element={
            <RequireRole currentUser={currentUser} roles={['driver']}>
              <DriverTripsPage />
            </RequireRole>
          }
        />
        <Route
          path="buses"
          element={
            <RequireRole currentUser={currentUser} roles={['admin']}>
              <BusesPage />
            </RequireRole>
          }
        />
        <Route
          path="drivers"
          element={
            <RequireRole currentUser={currentUser} roles={['admin']}>
              <DriversPage />
            </RequireRole>
          }
        />
        <Route
          path="locations"
          element={
            <RequireRole currentUser={currentUser} roles={['admin']}>
              <LocationsPage />
            </RequireRole>
          }
        />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage currentUser={currentUser} />} />
      </Route>
      <Route
        path="*"
        element={<Navigate to={currentUser ? defaultRouteForRole(currentUser.role) : '/login'} replace />}
      />
    </Routes>
  )
}

export default App
