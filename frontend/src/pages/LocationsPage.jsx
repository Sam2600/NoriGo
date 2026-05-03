import { zodResolver } from '@hookform/resolvers/zod'
import { GlobeAltIcon, MapPinIcon, PlusIcon, TrashIcon, MapIcon, DocumentTextIcon, GlobeAmericasIcon } from '@heroicons/react/24/outline'
import { Geocoder } from '@mapbox/search-js-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import mapboxgl from 'mapbox-gl'
import { useCallback, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import EmptyState from '../components/EmptyState.jsx'
import Field from '../components/Field.jsx'
import FormAlert from '../components/FormAlert.jsx'
import LocationMapPicker from '../components/LocationMapPicker.jsx'
import PageHeader from '../components/PageHeader.jsx'
import SectionPanel from '../components/SectionPanel.jsx'
import ConfirmationModal from '../components/ConfirmationModal.jsx'
import SubmitButton from '../components/SubmitButton.jsx'
import { normalizeGeocodingFeature, useMapboxGeocoding } from '../hooks/useMapboxGeocoding.js'
import { api } from '../lib/api.js'
import { getApiErrorMessage } from '../lib/apiError.js'

const schema = z.object({
  name: z.string().min(1, 'Location name is required.'),
  address: z.string().optional(),
  latitude: z.string()
    .trim()
    .min(1, 'Latitude is required for routing.')
    .refine((value) => isCoordinateInRange(value, -90, 90), 'Latitude must be between -90 and 90.'),
  longitude: z.string()
    .trim()
    .min(1, 'Longitude is required for routing.')
    .refine((value) => isCoordinateInRange(value, -180, 180), 'Longitude must be between -180 and 180.'),
})

function LocationsPage({ user }) {
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('registry')
  const [message, setMessage] = useState('')
  const [serverError, setServerError] = useState('')
  const [geocoderValue, setGeocoderValue] = useState('')
  const [geocoderKey, setGeocoderKey] = useState(0)
  const [mapInstance, setMapInstance] = useState(null)
  const [manualMarkerEnabled, setManualMarkerEnabled] = useState(false)
  const [mapStatus, setMapStatus] = useState('')
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, locationId: null, locationName: '' })
  const {
    accessToken,
    geocodingOptions,
    hasMapboxToken,
    reverseGeocode,
  } = useMapboxGeocoding()

  const locationsQuery = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const response = await api.get('/locations')
      return response.data.data
    },
    enabled: isAdmin,
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', address: '', latitude: '', longitude: '' },
  })

  const watchedName = useWatch({ control, name: 'name' })
  const watchedLat = useWatch({ control, name: 'latitude' })
  const watchedLng = useWatch({ control, name: 'longitude' })

  const createLocation = useMutation({
    mutationFn: async (values) => api.post('/admin/locations', normalizeLocationPayload(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['locations'] })
      setMessage('Geographic anchor created successfully.')
      setServerError('')
      setGeocoderValue('')
      setManualMarkerEnabled(false)
      setMapStatus('')
      setGeocoderKey((currentKey) => currentKey + 1)
      reset()
      setActiveTab('registry')
    },
    onError: (error) => {
      setMessage('')
      setServerError(getApiErrorMessage(error, 'Unable to create location.'))
    },
  })

  const deleteLocation = useMutation({
    mutationFn: async (locationId) => api.delete(`/admin/locations/${locationId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['locations'] })
      setMessage('Location anchor removed.')
      setServerError('')
    },
    onError: (error) => {
      setMessage('')
      setServerError(getApiErrorMessage(error, 'Unable to delete location.'))
    },
  })

  const applyGeocodedLocation = useCallback((location, status) => {
    if (!location) {
      return
    }

    setValue('name', location.name || '', { shouldValidate: true })
    setValue('address', location.address || '', { shouldValidate: true })
    setValue('latitude', formatCoordinate(location.latitude), { shouldValidate: true })
    setValue('longitude', formatCoordinate(location.longitude), { shouldValidate: true })
    setGeocoderValue(location.address || location.name || '')
    setMapStatus(status)
    setServerError('')
  }, [setValue])

  const handleGeocoderRetrieve = useCallback((feature) => {
    setManualMarkerEnabled(false)
    applyGeocodedLocation(normalizeGeocodingFeature(feature), 'Location selected from Mapbox Geocoder.')
  }, [applyGeocodedLocation])

  const handleMarkerMove = useCallback(async (lat, lng) => {
    if (!manualMarkerEnabled) {
      setGeocoderKey((currentKey) => currentKey + 1)
    }

    setManualMarkerEnabled(true)
    setValue('latitude', formatCoordinate(lat), { shouldValidate: true })
    setValue('longitude', formatCoordinate(lng), { shouldValidate: true })
    setMapStatus(hasMapboxToken ? 'Looking up selected map point...' : 'Point selected. Add the address manually.')

    if (!hasMapboxToken) {
      return
    }

    try {
      const result = await reverseGeocode(lng, lat)

      if (!result) {
        setMapStatus('Point selected. No address returned by Mapbox.')
        return
      }

      setValue('address', result.address, { shouldValidate: true })
      setGeocoderValue(result.address || result.name || '')

      if (!watchedName) {
        setValue('name', result.name, { shouldValidate: true })
      }

      setMapStatus('Point selected from map.')
    } catch {
      setMapStatus('Point selected. Address lookup failed, but coordinates are ready.')
    }
  }, [hasMapboxToken, manualMarkerEnabled, reverseGeocode, setValue, watchedName])

  if (!isAdmin) {
    return (
      <div className="py-20">
        <EmptyState title="Access Restricted" description="Only administrators can manage logistics anchors." />
      </div>
    )
  }

  const locations = locationsQuery.data || []

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          eyebrow="Logistics Infrastructure"
          title="Terminal & Stop Registry"
          description="Define the geographic anchors for pickup and drop-off logistics across the transit network."
        />

        <div className="flex shrink-0 items-center gap-2 rounded-2xl bg-slate-100 p-1.5 ring-1 ring-inset ring-slate-200 shadow-sm">
          <button
            onClick={() => setActiveTab('registry')}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'registry' 
                ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/20' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <MapIcon className="h-4 w-4" />
            Locations
          </button>
          <button
            onClick={() => setActiveTab('registration')}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'registration' 
                ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/20' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <PlusIcon className="h-4 w-4" />
            Register
          </button>
        </div>
      </div>

      {activeTab === 'registry' ? (
        <main className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <SectionPanel title="Geographic Network" icon={MapPinIcon} description="Directory of all registered logistics locations and their coordinates.">
            {locations.length ? (
              <div className="table-container border-none shadow-none ring-1 ring-slate-200">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="py-4 pl-6 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">Anchor Identity</th>
                      <th className="py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">Physical Logistics</th>
                      <th className="py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">Telemetry (GPS)</th>
                      <th className="w-10 pr-6 border-b border-slate-200"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {locations.map((location) => (
                      <tr key={location.id} className="group hover:bg-slate-50/30 transition-colors">
                        <td className="py-5 pl-6">
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-slate-200 group-hover:bg-white group-hover:text-teal-600 group-hover:ring-teal-100 transition-all">
                              <MapPinIcon className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-black text-slate-900 tracking-tight">{location.name}</span>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Anchor Point</span>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[300px]">
                          <div className="flex flex-col gap-1">
                            <p className="truncate text-sm font-bold text-slate-600 uppercase tracking-tight">{location.address || 'NO ADDRESS FILED'}</p>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Physical Address</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2 font-mono text-[10px] font-bold text-slate-500 tracking-widest uppercase">
                            <GlobeAmericasIcon className="h-3.5 w-3.5 text-slate-300" />
                            {location.latitude && location.longitude
                              ? `${location.latitude}, ${location.longitude}`
                              : 'NO COORDINATES'}
                          </div>
                        </td>
                        <td className="pr-6 text-right">
                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 hover:shadow-sm transition-all active:scale-90"
                            type="button"
                            title="Remove Anchor"
                            onClick={() => {
                              setConfirmModal({
                                isOpen: true,
                                locationId: location.id,
                                locationName: location.name,
                              })
                            }}
                            disabled={deleteLocation.isPending}
                          >
                            <TrashIcon className="h-5 w-5" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-24">
                <EmptyState
                  title={locationsQuery.isLoading ? 'Syncing network anchors...' : 'Network Empty'}
                  description="Register the first logistics terminal to define your transit routes."
                  action={
                    <button onClick={() => setActiveTab('registration')} className="primary-button mt-6">
                      <PlusIcon className="h-4 w-4" />
                      Create First Anchor
                    </button>
                  }
                />
              </div>
            )}
          </SectionPanel>

          <ConfirmationModal
            isOpen={confirmModal.isOpen}
            onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
            onConfirm={() => deleteLocation.mutate(confirmModal.locationId)}
            title="Remove Anchor"
            description={`Are you sure you want to remove ${confirmModal.locationName}? This may affect existing routes and bookings associated with this terminal.`}
            confirmText="Remove Anchor"
          />
        </main>
      ) : (
        <div className="mx-auto max-w-4xl animate-in fade-in slide-in-from-bottom-2 duration-500">
          <SectionPanel title="Location Configuration" icon={PlusIcon} description="Define the geographic coordinates and identity for a new logistics point.">
            <form className="space-y-6" onSubmit={handleSubmit((values) => createLocation.mutate(values))}>
              <Field label="Geographic Search" error={null}>
                {hasMapboxToken ? (
                  <div className="group relative">
                    <div className="mapbox-geocoder-shell bg-slate-50/40 border border-slate-200/80 rounded-xl focus-within:bg-white focus-within:ring-4 focus-within:ring-teal-600/10 transition-all">
                      <Geocoder
                        key={geocoderKey}
                        accessToken={accessToken}
                        componentOptions={{
                          flyTo: {
                            duration: 700,
                            zoom: 15,
                          },
                        }}
                        map={mapInstance || undefined}
                        mapboxgl={mapboxgl}
                        marker={{ color: '#0d9488' }}
                        onChange={setGeocoderValue}
                        onClear={() => {
                          setGeocoderValue('')
                          setMapStatus('')
                        }}
                        onRetrieve={handleGeocoderRetrieve}
                        options={geocodingOptions}
                        placeholder="Search for a street, building, or city landmark..."
                        value={geocoderValue}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                    Mapbox Geocoding disabled. Set VITE_MAPBOX_TOKEN in your environment.
                  </div>
                )}
              </Field>

              <div className="grid gap-6 sm:grid-cols-2 border-t border-slate-100 pt-6">
                <Field label="Location Identity Name" error={errors.name?.message}>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <MapPinIcon className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-teal-600" />
                    </div>
                    <input 
                      className="form-input !pl-12 bg-slate-50/40 border-slate-200/80 focus:bg-white" 
                      placeholder="e.g. Pearl Condo Terminal" 
                      {...register('name')} 
                    />
                  </div>
                </Field>
                <Field label="GPS Telemetry (Latitude / Longitude)" error={errors.latitude?.message || errors.longitude?.message}>
                  <div className="flex gap-2">
                    <div className="group relative flex-1">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <GlobeAltIcon className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-teal-600" />
                      </div>
                      <input className="form-input !pl-11 font-mono text-xs bg-slate-50/40 border-slate-200/80 focus:bg-white" inputMode="decimal" placeholder="Lat" {...register('latitude')} />
                    </div>
                    <div className="group relative flex-1">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <GlobeAltIcon className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-teal-600" />
                      </div>
                      <input className="form-input !pl-11 font-mono text-xs bg-slate-50/40 border-slate-200/80 focus:bg-white" inputMode="decimal" placeholder="Lng" {...register('longitude')} />
                    </div>
                  </div>
                </Field>
              </div>

              <Field label="Physical Address Details" error={errors.address?.message}>
                <div className="group relative">
                  <div className="pointer-events-none absolute left-3 top-3">
                    <DocumentTextIcon className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-teal-600" />
                  </div>
                  <textarea 
                    className="form-input !pl-12 min-h-[100px] resize-none bg-slate-50/40 border-slate-200/80 focus:bg-white" 
                    placeholder="Enter complete physical address details..." 
                    {...register('address')} 
                  />
                </div>
              </Field>

              <Field label="Manual Map Positioning" error={null}>
                <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm ring-1 ring-slate-200/50 interactive-map">
                  <LocationMapPicker
                    lat={watchedLat}
                    lng={watchedLng}
                    onCoordinatesChange={handleMarkerMove}
                    onMapReady={setMapInstance}
                    showManualMarker={manualMarkerEnabled}
                  />
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 ring-1 ring-slate-200/60">
                  <GlobeAmericasIcon className="h-4 w-4 text-teal-500" />
                  {mapStatus || 'Interaction Tip: Search or drag the map pin to define the exact anchor point.'}
                </div>
              </Field>

              <div className="pt-4">
                <FormAlert className="mb-4">{serverError}</FormAlert>
                <FormAlert className="mb-4" type="success">{message}</FormAlert>

                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setActiveTab('registry')}
                    className="secondary-button w-1/3 py-4 text-xs font-black uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                  <SubmitButton
                    className="primary-button flex-1 py-4 text-xs font-black uppercase tracking-widest shadow-teal-500/20" 
                    disabled={isSubmitting || createLocation.isPending}
                    icon={PlusIcon}
                    isLoading={isSubmitting || createLocation.isPending}
                    loadingText="Saving Anchor..."
                  >
                    Commit Anchor Point
                  </SubmitButton>
                </div>
              </div>
            </form>
          </SectionPanel>
        </div>
      )}
    </div>
  )
}

function normalizeLocationPayload(values) {
  return {
    name: values.name,
    address: values.address || null,
    latitude: values.latitude ? Number(values.latitude) : null,
    longitude: values.longitude ? Number(values.longitude) : null,
  }
}

function formatCoordinate(value) {
  const coordinate = Number(value)

  return Number.isNaN(coordinate) ? '' : coordinate.toFixed(7)
}

function isCoordinateInRange(value, min, max) {
  const coordinate = Number(value)

  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max
}

export default LocationsPage
