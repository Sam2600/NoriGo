import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useEffect, useRef } from 'react'
import { MAPBOX_ACCESS_TOKEN, YANGON_BBOX, YANGON_CENTER } from '../hooks/useMapboxGeocoding.js'

const defaultZoom = 12
const selectedZoom = 15
const mapboxStyle = import.meta.env.VITE_MAPBOX_STYLE || 'mapbox://styles/mapbox/streets-v12'
const yangonBounds = [
  [YANGON_BBOX[0], YANGON_BBOX[1]],
  [YANGON_BBOX[2], YANGON_BBOX[3]],
]

export default function LocationMapPicker({
  lat,
  lng,
  onCoordinatesChange,
  onMapReady,
  showManualMarker = false,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const onCoordinatesChangeRef = useRef(onCoordinatesChange)
  const onMapReadyRef = useRef(onMapReady)
  const initialCoordinatesRef = useRef(getCoordinates(lng, lat) || [YANGON_CENTER.lng, YANGON_CENTER.lat])

  useEffect(() => {
    onCoordinatesChangeRef.current = onCoordinatesChange
    onMapReadyRef.current = onMapReady
  }, [onCoordinatesChange, onMapReady])

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !MAPBOX_ACCESS_TOKEN) {
      return undefined
    }

    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: resolveMapboxStyle(mapboxStyle),
      center: initialCoordinatesRef.current,
      zoom: defaultZoom,
      maxBounds: yangonBounds,
    })

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('click', (event) => {
      setManualMarker(map, markerRef, event.lngLat, onCoordinatesChangeRef.current)
      onCoordinatesChangeRef.current(event.lngLat.lat, event.lngLat.lng)
    })

    map.once('load', () => {
      onMapReadyRef.current?.(map)
      map.resize()
    })

    mapRef.current = map

    return () => {
      onMapReadyRef.current?.(null)
      markerRef.current?.remove()
      markerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current

    if (!map) {
      return
    }

    const coordinates = getCoordinates(lng, lat)

    if (!showManualMarker || !coordinates) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }

    setManualMarker(map, markerRef, { lng: coordinates[0], lat: coordinates[1] }, onCoordinatesChangeRef.current)
    map.easeTo({
      center: coordinates,
      duration: 500,
      zoom: Math.max(map.getZoom(), selectedZoom),
    })
  }, [lat, lng, onCoordinatesChange, showManualMarker])

  return (
    <div className="relative overflow-hidden rounded-xl ring-1 ring-slate-200">
      <div ref={containerRef} style={{ height: '260px', width: '100%' }} />
      {!MAPBOX_ACCESS_TOKEN ? (
        <div className="absolute inset-0 flex items-center justify-center bg-amber-50 px-4 text-center text-sm font-bold text-amber-800">
          Set VITE_MAPBOX_TOKEN to enable the Mapbox map picker.
        </div>
      ) : null}
    </div>
  )
}

function getCoordinates(longitude, latitude) {
  const parsedLongitude = Number(longitude)
  const parsedLatitude = Number(latitude)

  if (!Number.isFinite(parsedLongitude) || !Number.isFinite(parsedLatitude)) {
    return null
  }

  return [parsedLongitude, parsedLatitude]
}

function setManualMarker(map, markerRef, lngLat, onCoordinatesChange) {
  const coordinates = [lngLat.lng, lngLat.lat]

  if (!markerRef.current) {
    markerRef.current = new mapboxgl.Marker({
      color: '#0d9488',
      draggable: true,
    })
      .setLngLat(coordinates)
      .addTo(map)

    markerRef.current.on('dragend', () => {
      const nextLngLat = markerRef.current.getLngLat()
      onCoordinatesChange(nextLngLat.lat, nextLngLat.lng)
    })
  } else {
    markerRef.current.setLngLat(coordinates)
  }
}

function resolveMapboxStyle(style) {
  if (style.startsWith('mapbox://') || style.startsWith('http')) {
    return style
  }

  return `mapbox://styles/${style}`
}
