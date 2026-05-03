import { zodResolver } from '@hookform/resolvers/zod'
import { CheckIcon, UserCircleIcon, IdentificationIcon, ShieldCheckIcon, PhoneIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import Field from '../components/Field.jsx'
import FormAlert from '../components/FormAlert.jsx'
import PageHeader from '../components/PageHeader.jsx'
import SectionPanel from '../components/SectionPanel.jsx'
import SubmitButton from '../components/SubmitButton.jsx'
import { api } from '../lib/api.js'
import { getApiErrorMessage } from '../lib/apiError.js'

const schema = z.object({
  phone: z.string()
    .trim()
    .max(30, 'Phone number must be 30 characters or less.')
    .regex(/^[+()\d\s-]*$/, 'Phone number can only contain digits, spaces, +, -, and parentheses.')
    .optional(),
  default_pickup_location_id: z.string().optional(),
  default_dropoff_location_id: z.string().optional(),
  notes: z.string().trim().max(1000, 'Notes must be 1000 characters or less.').optional(),
})

function ProfilePage({ user }) {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')
  const [serverError, setServerError] = useState('')
  const locationsQuery = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const response = await api.get('/locations')
      return response.data.data
    },
  })
  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await api.get('/profile')
      return response.data.data
    },
  })
  const formValues = useMemo(() => {
    const profile = profileQuery.data

    return {
      phone: profile?.phone || '',
      default_pickup_location_id: profile?.default_pickup_location_id
        ? String(profile.default_pickup_location_id)
        : '',
      default_dropoff_location_id: profile?.default_dropoff_location_id
        ? String(profile.default_dropoff_location_id)
        : '',
      notes: profile?.notes || '',
    }
  }, [profileQuery.data])
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    values: formValues,
  })
  const updateProfile = useMutation({
    mutationFn: async (values) => api.put('/profile', normalizeProfilePayload(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile'] })
      setMessage('Your identity profile has been updated.')
      setServerError('')
    },
    onError: (error) => {
      setMessage('')
      setServerError(getApiErrorMessage(error, 'Unable to save profile.'))
    },
  })
  const locations = locationsQuery.data || []

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Settings"
        title="Personal Profile"
        description="Manage your contact information, transit preferences, and personal account configurations."
      />

      <div className="grid gap-10 xl:grid-cols-[1fr_400px]">
        <main className="space-y-8">
          <SectionPanel 
            title="Profile Configurations" 
            icon={UserCircleIcon} 
            description="Operational details and transit preferences for your account."
          >
            <form className="space-y-8" onSubmit={handleSubmit((values) => updateProfile.mutate(values))}>
              <div className="grid gap-6 md:grid-cols-2">
                <Field label="Contact Phone" error={errors.phone?.message}>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <PhoneIcon className="h-4 w-4" />
                    </div>
                    <input className="form-input !pl-10" placeholder="+1 (555) 000-0000" {...register('phone')} />
                  </div>
                </Field>
                
                <div className="grid gap-6">
                  <Field label="Default Pickup Terminal" error={errors.default_pickup_location_id?.message}>
                    <select className="form-input" {...register('default_pickup_location_id')}>
                      <option value="">Manual selection per trip</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Default Destination" error={errors.default_dropoff_location_id?.message}>
                    <select className="form-input" {...register('default_dropoff_location_id')}>
                      <option value="">Manual selection per trip</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              <Field label="Personal Notes & Preferences" error={errors.notes?.message}>
                <textarea 
                  className="form-input min-h-[140px] resize-none" 
                  placeholder="e.g. Accessibility requirements or special transit requests..."
                  {...register('notes')} 
                />
              </Field>

              <div className="flex flex-col gap-4 pt-2">
                <FormAlert>{serverError}</FormAlert>
                <FormAlert type="success">{message}</FormAlert>

                <SubmitButton
                  className="primary-button w-full sm:w-auto py-4 px-10 text-xs font-black uppercase tracking-widest shadow-teal-500/20"
                  disabled={isSubmitting || updateProfile.isPending}
                  icon={CheckIcon}
                  isLoading={isSubmitting || updateProfile.isPending}
                  loadingText="Saving Profile..."
                >
                  Synchronize Profile
                </SubmitButton>
              </div>
            </form>
          </SectionPanel>
        </main>

        <aside className="space-y-6">
          <SectionPanel title="Account Integrity" icon={ShieldCheckIcon} description="Core system identity credentials.">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white font-black text-sm shadow-xl">
                  {user.name?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-black text-slate-900 leading-none">{user.name}</p>
                  <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest mt-1.5">{user.role} Account</p>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <ProfileItem 
                  icon={IdentificationIcon} 
                  label="System Identifier" 
                  value={`UID-${user.id.toString().padStart(6, '0')}`} 
                />
                <ProfileItem 
                  icon={ShieldCheckIcon} 
                  label="Primary Email" 
                  value={user.email} 
                />
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 mt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Security Note</p>
                <p className="mt-2 text-xs font-medium text-slate-500 leading-relaxed italic">
                  Core identity fields (Name, Email, Role) are managed by administration. Contact support for modifications.
                </p>
              </div>
            </div>
          </SectionPanel>
        </aside>
      </div>
    </div>
  )
}

function ProfileItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 border border-slate-100 text-slate-400">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-sm font-bold text-slate-900 mt-0.5 truncate">{value}</p>
      </div>
    </div>
  )
}

function normalizeProfilePayload(values) {
  return {
    phone: values.phone || null,
    default_pickup_location_id: values.default_pickup_location_id
      ? Number(values.default_pickup_location_id)
      : null,
    default_dropoff_location_id: values.default_dropoff_location_id
      ? Number(values.default_dropoff_location_id)
      : null,
    notes: values.notes || null,
  }
}

export default ProfilePage
