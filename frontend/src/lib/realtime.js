import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

let echoInstance = null

export function getEcho() {
  const key = import.meta.env.VITE_REVERB_APP_KEY

  if (!key) {
    return null
  }

  if (echoInstance) {
    return echoInstance
  }

  window.Pusher = Pusher

  const scheme = import.meta.env.VITE_REVERB_SCHEME || 'http'
  const port = Number(import.meta.env.VITE_REVERB_PORT || 8080)

  echoInstance = new Echo({
    broadcaster: 'reverb',
    key,
    wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
    wsPort: port,
    wssPort: port,
    forceTLS: scheme === 'https',
    enabledTransports: ['ws', 'wss'],
  })

  return echoInstance
}
