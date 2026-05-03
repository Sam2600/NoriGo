import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useEffect, useRef } from 'react'
import { formatDateTime } from '../lib/dateUtils.js'
import { MAPBOX_ACCESS_TOKEN, YANGON_CENTER } from '../hooks/useMapboxGeocoding.js'

const mapStyle = import.meta.env.VITE_MAPBOX_STYLE || 'mapbox://styles/mapbox/streets-v12'
const ROUTE_SOURCE = 'live-route'
const ROUTE_LAYER = 'live-route-line'

function LiveMap({
  points = [],
  latestLocation = null,
  routeStops = [],
  routeGeometry = null,
  height = 360,
  stopMarkerMode = 'sequence',
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !MAPBOX_ACCESS_TOKEN) {
      return undefined
    }

    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: [YANGON_CENTER.lng, YANGON_CENTER.lat],
      zoom: 12,
      scrollZoom: false,
    })

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => applyMapData(map, markersRef, points, latestLocation, routeStops, routeGeometry, stopMarkerMode)

    if (map.isStyleLoaded()) {
      apply()
    } else {
      map.once('load', apply)
      return () => map.off('load', apply)
    }
  }, [points, latestLocation, routeStops, routeGeometry, stopMarkerMode])

  return (
    <div className="interactive-map" style={{ position: 'relative', height }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
      {!MAPBOX_ACCESS_TOKEN ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-amber-50 text-sm font-bold text-amber-700">
          Set VITE_MAPBOX_TOKEN to enable the map.
        </div>
      ) : null}
    </div>
  )
}

function applyMapData(map, markersRef, points, latestLocation, routeStops, routeGeometry, stopMarkerMode) {
  markersRef.current.forEach((m) => m.remove())
  markersRef.current = []

  const normalizedStops = normalizePoints(routeStops)
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    .map((stop, index) => ({ ...stop, marker_index: index + 1 }))
  const markerStops = mergeOverlappingStopMarkers(normalizedStops, stopMarkerMode)
  const normalizedPoints = normalizePoints(points)
  const latest = normalizePoint(latestLocation) || normalizedPoints.at(-1)

  const routeCoords = buildRouteCoords(normalizedStops, routeGeometry, normalizedPoints)

  if (map.getSource(ROUTE_SOURCE)) {
    map.getSource(ROUTE_SOURCE).setData(lineFeature(routeCoords))
  } else {
    map.addSource(ROUTE_SOURCE, { type: 'geojson', data: lineFeature(routeCoords) })
    map.addLayer({
      id: ROUTE_LAYER,
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#0d9488', 'line-width': 4, 'line-opacity': 0.85 },
    })
  }

  markerStops.forEach((stop, index) => {
    const popup = new mapboxgl.Popup({ offset: 14, closeButton: false })
      .setHTML(stopPopupHtml(stop))
    const marker = new mapboxgl.Marker({
      element: stopMarkerEl(stopMarkerLabel(stop, index, stopMarkerMode), stop.type),
      anchor: 'center',
    })
      .setLngLat([stop.longitude, stop.latitude])
      .setPopup(popup)
      .addTo(map)
    markersRef.current.push(marker)
  })

  if (latest) {
    const popup = new mapboxgl.Popup({ offset: 16, closeButton: false })
      .setHTML(busPopupHtml(latest))
    const marker = new mapboxgl.Marker({ element: busMarkerEl(), anchor: 'center' })
      .setLngLat([latest.longitude, latest.latitude])
      .setPopup(popup)
      .addTo(map)
    markersRef.current.push(marker)
  }

  const boundsCoords = [
    ...normalizedStops.map((s) => [s.longitude, s.latitude]),
    ...normalizedPoints.map((p) => [p.longitude, p.latitude]),
    ...(latest ? [[latest.longitude, latest.latitude]] : []),
  ]

  if (boundsCoords.length > 1) {
    const bounds = boundsCoords.reduce(
      (b, c) => b.extend(c),
      new mapboxgl.LngLatBounds(boundsCoords[0], boundsCoords[0]),
    )
    map.fitBounds(bounds, { padding: 64, maxZoom: 15, duration: 800 })
  } else if (boundsCoords.length === 1) {
    map.flyTo({ center: boundsCoords[0], zoom: 14, duration: 800 })
  }
}

function stopMarkerEl(label, type) {
  const text = String(label)
  const isCombined = type === 'pickup_dropoff'
  const isDropoff = ['dropoff', 'final_dropoff', 'final_destination'].includes(type)
  const markerWidth = text.length > 1 ? Math.min(78, Math.max(46, text.length * 10 + 22)) : 34
  const el = document.createElement('div')
  Object.assign(el.style, {
    width: `${markerWidth}px`,
    height: '34px',
    borderRadius: text.length > 1 ? '999px' : '50%',
    background: isCombined
      ? 'linear-gradient(135deg, #0d9488 0%, #0d9488 48%, #7c3aed 52%, #6d28d9 100%)'
      : isDropoff
      ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
      : 'linear-gradient(135deg, #0d9488, #0f766e)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: text.length > 1 ? '11px' : '13px',
    fontWeight: '800',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    border: '3px solid #fff',
    boxShadow: '0 4px 14px rgba(0,0,0,0.22), 0 1px 4px rgba(0,0,0,0.12)',
    cursor: 'pointer',
    userSelect: 'none',
  })
  el.textContent = text
  return el
}

function stopMarkerLabel(stop, index, mode) {
  if (stop.marker_label) {
    return stop.marker_label
  }

  if (mode === 'journey') {
    if (['dropoff', 'final_dropoff', 'final_destination'].includes(stop.type)) {
      return 'D'
    }

    if (['pickup', 'origin_pickup'].includes(stop.type)) {
      return 'P'
    }

    return 'S'
  }

  return stop.sequence || stop.marker_index || index + 1
}

function mergeOverlappingStopMarkers(stops, mode) {
  const groups = new Map()

  stops.forEach((stop) => {
    const key = `${Number(stop.latitude).toFixed(6)}|${Number(stop.longitude).toFixed(6)}`
    const group = groups.get(key)

    if (!group) {
      groups.set(key, { ...stop, grouped_stops: [stop] })
      return
    }

    group.grouped_stops.push(stop)
  })

  return Array.from(groups.values()).map((stop) => {
    const groupedStops = stop.grouped_stops || [stop]
    const hasPickup = groupedStops.some((item) => ['pickup', 'origin_pickup', 'origin'].includes(item.type))
    const hasDropoff = groupedStops.some((item) => ['dropoff', 'final_dropoff', 'final_destination'].includes(item.type))

    if (groupedStops.length === 1 || (!hasPickup && !hasDropoff)) {
      return stop
    }

    const markerLabel = mode === 'journey' && hasPickup && hasDropoff
      ? 'P/D'
      : uniqueValues(groupedStops.map((item) => item.sequence || item.marker_index)).join('/')

    return {
      ...stop,
      type: hasPickup && hasDropoff ? 'pickup_dropoff' : stop.type,
      marker_label: markerLabel,
      name: uniqueValues(groupedStops.map((item) => item.name)).join(' / ') || stop.name,
      address: uniqueValues(groupedStops.map((item) => item.address)).join(' / ') || stop.address,
      passenger_names: uniqueValues(groupedStops.flatMap((item) => item.passenger_names || item.passenger_name || [])),
      grouped_stops: groupedStops,
    }
  })
}

function busMarkerEl() {
  const wrapper = document.createElement('div')
  Object.assign(wrapper.style, {
    position: 'relative',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  })

  const pulse = document.createElement('div')
  Object.assign(pulse.style, {
    position: 'absolute',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(14, 165, 233, 0.18)',
    animation: 'lm-pulse 2s ease-out infinite',
  })

  const dot = document.createElement('div')
  Object.assign(dot.style, {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
    border: '3px solid #fff',
    boxShadow: '0 4px 12px rgba(14, 165, 233, 0.5)',
    position: 'relative',
    zIndex: '1',
  })

  if (!document.getElementById('lm-pulse-style')) {
    const style = document.createElement('style')
    style.id = 'lm-pulse-style'
    style.textContent = `
      @keyframes lm-pulse {
        0%   { transform: scale(0.6); opacity: 0.7; }
        70%  { transform: scale(1.6); opacity: 0; }
        100% { transform: scale(0.6); opacity: 0; }
      }
    `
    document.head.appendChild(style)
  }

  wrapper.appendChild(pulse)
  wrapper.appendChild(dot)
  return wrapper
}

function stopPopupHtml(stop) {
  if (stop.type === 'pickup_dropoff') {
    return combinedStopPopupHtml(stop)
  }

  const type = stop.type === 'dropoff' ? 'Drop-off' : 'Pickup'
  const name = escapeHtml(stop.name || 'Stop')
  const passenger = stop.passenger_name ? `<div style="color:#64748b;font-size:11px;margin-top:2px">👤 ${escapeHtml(stop.passenger_name)}</div>` : ''
  const address = stop.address ? `<div style="color:#64748b;font-size:11px;margin-top:2px">📍 ${escapeHtml(stop.address)}</div>` : ''
  return `<div style="font-family:ui-sans-serif,system-ui,sans-serif;padding:2px 0">
    <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${stop.type === 'dropoff' ? '#7c3aed' : '#0d9488'};margin-bottom:4px">${type}</div>
    <div style="font-size:13px;font-weight:700;color:#0f172a">${name}</div>
    ${passenger}${address}
  </div>`
}

function combinedStopPopupHtml(stop) {
  const name = escapeHtml(stop.name || 'Stop')
  const passengerNames = stop.passenger_names?.length ? stop.passenger_names.join(', ') : stop.passenger_name
  const passenger = passengerNames
    ? `<div style="color:#64748b;font-size:11px;margin-top:2px">${escapeHtml(passengerNames)}</div>`
    : ''
  const address = stop.address
    ? `<div style="color:#64748b;font-size:11px;margin-top:2px">${escapeHtml(stop.address)}</div>`
    : ''

  return `<div style="font-family:ui-sans-serif,system-ui,sans-serif;padding:2px 0">
    <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#4f46e5;margin-bottom:4px">Pickup & Drop-off</div>
    <div style="font-size:13px;font-weight:700;color:#0f172a">${name}</div>
    ${passenger}${address}
  </div>`
}

function busPopupHtml(location) {
  const time = location.reported_at ? formatDateTime(location.reported_at) : 'Just now'
  const speed = location.speed_kmh ? `<div style="color:#64748b;font-size:11px;margin-top:2px">🚤 ${location.speed_kmh} km/h</div>` : ''
  return `<div style="font-family:ui-sans-serif,system-ui,sans-serif;padding:2px 0">
    <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#0ea5e9;margin-bottom:4px">Live Position</div>
    <div style="font-size:12px;font-weight:600;color:#0f172a">${escapeHtml(time)}</div>
    ${speed}
  </div>`
}

function buildRouteCoords(normalizedStops, routeGeometry, normalizedPoints) {
  if (routeGeometry?.coordinates?.length > 1) {
    return routeGeometry.coordinates.filter(
      (c) => Number.isFinite(Number(c?.[0])) && Number.isFinite(Number(c?.[1])),
    )
  }
  if (normalizedStops.length > 1) {
    return normalizedStops.map((s) => [s.longitude, s.latitude])
  }
  if (normalizedPoints.length > 1) {
    return normalizedPoints.map((p) => [p.longitude, p.latitude])
  }
  return []
}

function lineFeature(coordinates) {
  return { type: 'Feature', geometry: { type: 'LineString', coordinates } }
}

function normalizePoints(points) {
  return points.map(normalizePoint).filter(Boolean)
}

function normalizePoint(point) {
  if (point?.latitude == null || point?.longitude == null) return null
  const latitude = Number(point.latitude)
  const longitude = Number(point.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { ...point, latitude, longitude }
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean).map(String))]
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export default LiveMap
