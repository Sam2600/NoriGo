import { useGeocodingCore } from '@mapbox/search-js-react'
import { useCallback } from 'react'

export const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || ''
export const YANGON_CENTER = { lng: 96.156831, lat: 16.81732 }
export const YANGON_BBOX = [95.95, 16.65, 96.35, 17.05]
export const STREET_LEVEL_TYPES = 'address,street,neighborhood,locality,district'

export const geocodingOptions = {
  autocomplete: true,
  country: 'MM',
  bbox: YANGON_BBOX,
  language: 'en',
  limit: 10,
  permanent: true,
  proximity: YANGON_CENTER,
  types: STREET_LEVEL_TYPES,
}

export function useMapboxGeocoding() {
  const geocodingCore = useGeocodingCore({
    accessToken: MAPBOX_ACCESS_TOKEN,
    ...geocodingOptions,
  })

  const reverseGeocode = useCallback(async (longitude, latitude) => {
    if (!MAPBOX_ACCESS_TOKEN) {
      return null
    }

    const response = await geocodingCore.reverse(
      { lng: Number(longitude), lat: Number(latitude) },
      {
        ...geocodingOptions,
        limit: 1,
      },
    )

    return normalizeGeocodingFeature(response.features?.[0])
  }, [geocodingCore])

  return {
    accessToken: MAPBOX_ACCESS_TOKEN,
    geocodingOptions,
    hasMapboxToken: Boolean(MAPBOX_ACCESS_TOKEN),
    reverseGeocode,
  }
}

export function normalizeGeocodingFeature(feature) {
  if (!feature) {
    return null
  }

  const properties = feature.properties || {}
  const geometryCoordinates = feature.geometry?.coordinates || feature.center || []
  const longitude = Number(properties.coordinates?.longitude ?? geometryCoordinates[0])
  const latitude = Number(properties.coordinates?.latitude ?? geometryCoordinates[1])

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }

  const name = properties.name_preferred
    || properties.name
    || feature.text
    || 'Selected location'
  const address = properties.full_address
    || [name, properties.place_formatted].filter(Boolean).join(', ')
    || feature.place_name
    || properties.address
    || name

  return {
    address,
    latitude,
    longitude,
    name,
    rawFeature: feature,
  }
}
