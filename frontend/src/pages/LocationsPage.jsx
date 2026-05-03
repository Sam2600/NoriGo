import { MapPinIcon, PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import EmptyState from '../components/EmptyState.jsx'
import Field from '../components/Field.jsx'
import FormAlert from '../components/FormAlert.jsx'
import PageHeader from '../components/PageHeader.jsx'
import SectionPanel from '../components/SectionPanel.jsx'
import SubmitButton from '../components/SubmitButton.jsx'
import { api } from '../lib/api.js'
import { getApiErrorMessage } from '../lib/apiError.js'

const locationSchema = z.object({
  name: z.string().min(1, 'Location name is required.'),
  address: z.string().optional(),
  latitude: z.union([z.literal(''), z.coerce.number().min(-90).max(90)]).optional(),
  longitude: z.union([z.literal(''), z.coerce.number().min(-180).max(180)]).optional(),
})

const emptyLocation = {
  name: '',
  address: '',
  latitude: '',
  longitude: '',
}

function toPayload(values) {
  return {
    name: values.name,
    address: values.address || null,
    latitude: values.latitude === '' ? null : values.latitude,
    longitude: values.longitude === '' ? null : values.longitude,
  }
}

function LocationsPage() {
  const queryClient = useQueryClient()
  const [editingLocation, setEditingLocation] = useState(null)
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(locationSchema),
    defaultValues: emptyLocation,
  })

  const locationsQuery = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const response = await api.get('/locations')
      return response.data.data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      if (editingLocation) {
        const response = await api.put(`/admin/locations/${editingLocation.id}`, toPayload(values))
        return response.data.data
      }
      const response = await api.post('/admin/locations', toPayload(values))
      return response.data.data
    },
    onSuccess: () => {
      setMessage(editingLocation ? 'Location updated.' : 'Location created.')
      setFormError('')
      setEditingLocation(null)
      reset(emptyLocation)
      queryClient.invalidateQueries({ queryKey: ['locations'] })
    },
    onError: (error) => setFormError(getApiErrorMessage(error, 'Unable to save location.')),
  })

  const deleteMutation = useMutation({
    mutationFn: async (locationId) => {
      await api.delete(`/admin/locations/${locationId}`)
    },
    onSuccess: () => {
      setMessage('Location deleted.')
      queryClient.invalidateQueries({ queryKey: ['locations'] })
    },
    onError: (error) => setFormError(getApiErrorMessage(error, 'Unable to delete location.')),
  })

  const startEdit = (location) => {
    setEditingLocation(location)
    setMessage('')
    reset({
      name: location.name ?? '',
      address: location.address ?? '',
      latitude: location.latitude ?? '',
      longitude: location.longitude ?? '',
    })
  }

  const clearEdit = () => {
    setEditingLocation(null)
    setFormError('')
    reset(emptyLocation)
  }

  const locations = locationsQuery.data ?? []

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Locations"
        description="Maintain pickup, dropoff, and route anchor locations."
      />

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <SectionPanel title={editingLocation ? 'Edit location' : 'Add location'} icon={MapPinIcon}>
          <form className="space-y-4" onSubmit={handleSubmit((values) => saveMutation.mutate(values))}>
            <FormAlert type="success">{message}</FormAlert>
            <FormAlert>{formError}</FormAlert>
            <Field label="Name" error={errors.name?.message}>
              <input className="form-input" {...register('name')} />
            </Field>
            <Field label="Address" error={errors.address?.message}>
              <textarea className="form-input min-h-24" {...register('address')} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Latitude" error={errors.latitude?.message}>
                <input className="form-input" inputMode="decimal" {...register('latitude')} />
              </Field>
              <Field label="Longitude" error={errors.longitude?.message}>
                <input className="form-input" inputMode="decimal" {...register('longitude')} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <SubmitButton icon={PlusIcon} isLoading={saveMutation.isPending}>
                {editingLocation ? 'Update location' : 'Create location'}
              </SubmitButton>
              {editingLocation ? (
                <button type="button" className="secondary-button" onClick={clearEdit}>
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
        </SectionPanel>

        <SectionPanel title="Saved locations" icon={MapPinIcon}>
          {locations.length === 0 ? (
            <EmptyState title="No locations yet" description="Create locations before adding trips or bookings." />
          ) : (
            <div className="table-container">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th>Name</th>
                    <th>Address</th>
                    <th>Coordinates</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {locations.map((location) => (
                    <tr key={location.id}>
                      <td className="font-semibold text-slate-950">{location.name}</td>
                      <td>{location.address ?? '-'}</td>
                      <td>{location.latitude && location.longitude ? `${location.latitude}, ${location.longitude}` : '-'}</td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="secondary-button px-3 py-2" onClick={() => startEdit(location)}>
                            <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="danger-button px-3 py-2"
                            disabled={deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate(location.id)}
                          >
                            <TrashIcon className="h-4 w-4" aria-hidden="true" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionPanel>
      </div>
    </>
  )
}

export default LocationsPage
