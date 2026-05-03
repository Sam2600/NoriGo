const TOKEN_KEY = 'ferry_bus_auth_token'
const USER_KEY = 'ferry_bus_auth_user'

export function saveAuthSession(session) {
  window.localStorage.setItem(TOKEN_KEY, session.token)
  window.localStorage.setItem(USER_KEY, JSON.stringify(session.user))
}

export function clearAuthSession() {
  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(USER_KEY)
}

export function getAuthToken() {
  return window.localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser() {
  const value = window.localStorage.getItem(USER_KEY)
  if (!value) return null

  try {
    return JSON.parse(value)
  } catch {
    clearAuthSession()
    return null
  }
}
