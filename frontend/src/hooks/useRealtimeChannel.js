import { useEffect } from 'react'
import { getEcho } from '../lib/realtime.js'

export function useRealtimeChannel(channelName, events) {
  useEffect(() => {
    const echo = getEcho()

    if (!echo || !channelName) {
      return undefined
    }

    const channel = echo.channel(channelName)

    events.forEach(({ event, handler }) => {
      channel.listen(`.${event}`, handler)
    })

    return () => {
      events.forEach(({ event, handler }) => {
        channel.stopListening(`.${event}`, handler)
      })
      echo.leaveChannel(channelName)
    }
  }, [channelName, events])
}
