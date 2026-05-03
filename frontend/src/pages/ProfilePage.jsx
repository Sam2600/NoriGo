import { UserCircleIcon } from '@heroicons/react/24/outline'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import Field from '../components/Field.jsx'
import FormAlert from '../components/FormAlert.jsx'
import PageHeader from '../components/PageHeader.jsx'
import SectionPanel from '../components/SectionPanel.jsx'
import SubmitButton from '../components/SubmitButton.jsx'
import { api } from '../lib/api.js'
import { getApiErrorMessage } from '../lib/apiError.js'

const profileSchema = z.object({
  phone: z.string().optional(),
  default_pickup_location_id: z.string().optional(),
  default_dropoff_location_id: z.string().optional(),
  notes: z.string().optional(),
})

function ProfilePage({ currentUser }) {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      phone: '',
      default_pickup_location_id: '',
      default_dropoff_location_id: '',
      notes: '',
    },
  })

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await api.get('/profile')
      return response.data.data
    },
  })

  const locationsQuery = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const response = await api.get('/locations')
      return response.data.data
    },
  })

  useEffect(() => {
    if (profileQuery.data) {
      reset({
        phone: profileQuery.data.phone ?? '',
        default_pickup_location_id: profileQuery.data.default_pickup_location_id ? String(profileQuery.data.default_pickup_location_id) : '',
        default_dropoff_location_id: profileQuery.data.default_dropoff_location_id ? String(profileQuery.data.default_dropoff_location_id) : '',
        notes: profileQuery.data.notes ?? '',
      })
    }
  }, [profileQuery.data, reset])

  const updateMutation = useMutation({
    mutationFn: async (values) => {
      const response = await api.put('/profile', {
        phone: values.phone || null,
        default_pickup_location_id: values.default_pickup_location_id ? Number(values.default_pickup_location_id) : null,
        default_dropoff_location_id: values.default_dropoff_location_id ? Number(values.default_dropoff_location_id) : null,
        notes: values.notes || null,
      })
      return response.data.data
    },
    onSuccess: () => {
      setMessage('Profile updated.')
      setFormError('')
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (error) => setFormError(getApiErrorMessage(error, 'Unable to update profile.')),
  })

  const locations = locationsQuery.data ?? []

  return (
    <>
      <PageHeader
        eyebrow={currentUser?.role}
        title="Profile"
        description="Manage contact information and default booking locations."
      />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <SectionPanel title="Account" icon={UserCircleIcon}>
          <div className="space-y-3 text-sm">
            <p><span className="font-semibold text-slate-950">Name:</span> {currentUser?.name}</p>
            <p><span className="font-semibold text-slate-950">Email:</span> {currentUser?.email}</p>
            <p><span className="font-semibold text-slate-950">Role:</span> {currentUser?.role}</p>
          </div>
        </SectionPanel>

        <SectionPanel title="Defaults" icon={UserCircleIcon}>
          <form className="space-y-4" onSubmit={handleSubmit((values) => updateMutation.mutate(values))}>
            <FormAlert type="success">{message}</FormAlert>
            <FormAlert>{formError}</FormAlert>
            <Field label="Phone" error={errors.phone?.message}>
              <input className="form-input" type="tel" {...register('phone')} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Default pickup" error={errors.default_pickup_location_id?.message}>
                <select className="form-input" {...register('default_pickup_location_id')}>
                  <option value="">No default</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>{location.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Default dropoff" error={errors.default_dropoff_location_id?.message}>
                <select className="form-input" {...register('default_dropoff_location_id')}>
                  <option value="">No default</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>{location.name}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Notes" error={errors.notes?.message}>
              <textarea className="form-input min-h-28" {...register('notes')} />
            </Field>
            <SubmitButton isLoading={updateMutation.isPending} loadingText="Saving...">
              Save profile
            </SubmitButton>
          </form>
        </SectionPanel>
      </div>
    </>
  )
}

export default ProfilePage
