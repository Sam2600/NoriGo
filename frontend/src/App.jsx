import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout.jsx'
import { clearAuthSession, getStoredUser, saveAuthSession } from './features/auth/authStorage.js'
import BookingsPage from './pages/BookingsPage.jsx'
import BusesPage from './pages/BusesPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import DriverTripsPage from './pages/DriverTripsPage.jsx'
import DriversPage from './pages/DriversPage.jsx'
import LocationsPage from './pages/LocationsPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import NotificationsPage from './pages/NotificationsPage.jsx'
import OperationsPage from './pages/OperationsPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import TrackingPage from './pages/TrackingPage.jsx'
import TripsPage from './pages/TripsPage.jsx'
import { defaultRouteForRole } from './lib/roleRoutes.js'

function HomeRoute({ user }) {
  if (user?.role === 'admin') {
    return <DashboardPage user={user} />
  }

  return <Navigate to={defaultRouteForRole(user?.role)} replace />
}

function App() {
  const [currentUser, setCurrentUser] = useState(() => getStoredUser())

  function handleAuthenticated(session) {
    saveAuthSession(session)
    setCurrentUser(session.user)
  }

  function handleLogout() {
    clearAuthSession()
    setCurrentUser(null)
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          currentUser ? (
            <Navigate to={defaultRouteForRole(currentUser.role)} replace />
          ) : (
            <LoginPage onAuthenticated={handleAuthenticated} />
          )
        }
      />
      <Route
        path="/register"
        element={
          currentUser ? (
            <Navigate to={defaultRouteForRole(currentUser.role)} replace />
          ) : (
            <RegisterPage onAuthenticated={handleAuthenticated} />
          )
        }
      />
      <Route
        path="/"
        element={
          currentUser ? (
            <AppLayout user={currentUser} onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route index element={<HomeRoute user={currentUser} />} />
        <Route path="operations" element={<OperationsPage user={currentUser} />} />
        <Route path="tracking" element={<TrackingPage user={currentUser} />} />
        <Route path="trips" element={<TripsPage user={currentUser} />} />
        <Route path="bookings" element={<BookingsPage user={currentUser} />} />
        <Route path="driver-trips" element={<DriverTripsPage user={currentUser} />} />
        <Route path="buses" element={<BusesPage user={currentUser} />} />
        <Route path="drivers" element={<DriversPage user={currentUser} />} />
        <Route path="locations" element={<LocationsPage user={currentUser} />} />
        <Route path="notifications" element={<NotificationsPage user={currentUser} />} />
        <Route path="profile" element={<ProfilePage user={currentUser} />} />
      </Route>
      <Route
        path="*"
        element={<Navigate to={currentUser ? defaultRouteForRole(currentUser.role) : '/login'} replace />}
      />
    </Routes>
  )
}

export default App
