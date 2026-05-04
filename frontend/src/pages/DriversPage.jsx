import { zodResolver } from '@hookform/resolvers/zod'
import { PlusIcon, UsersIcon, TrashIcon, IdentificationIcon, EnvelopeIcon, KeyIcon, Cog6ToothIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import EmptyState from '../components/EmptyState.jsx'
import Field from '../components/Field.jsx'
import FormAlert from '../components/FormAlert.jsx'
import PageHeader from '../components/PageHeader.jsx'
import SectionPanel from '../components/SectionPanel.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import ConfirmationModal from '../components/ConfirmationModal.jsx'
import SubmitButton from '../components/SubmitButton.jsx'
import { api } from '../lib/api.js'
import { getApiErrorMessage } from '../lib/apiError.js'

const schema = z.object({
  name: z.string().trim().min(2, 'Name is required.').max(120, 'Name must be 120 characters or less.'),
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  license_no: z.string().trim().min(1, 'Operator license number is required.').max(60, 'License number must be 60 characters or less.'),
  status: z.enum(['active', 'inactive']),
  notes: z.string().trim().max(1000, 'Operator notes must be 1000 characters or less.').optional(),
})

function DriversPage({ user }) {
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('registry')
  const [message, setMessage] = useState('')
  const [serverError, setServerError] = useState('')
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, driverId: null, driverName: '' })

  const driversQuery = useQuery({
    queryKey: ['admin-drivers'],
    queryFn: async () => {
      const response = await api.get('/admin/drivers')
      return response.data.data
    },
    enabled: isAdmin,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      license_no: '',
      status: 'active',
      notes: '',
    },
  })

  const createDriver = useMutation({
    mutationFn: async (values) => api.post('/admin/drivers', values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-drivers'] })
      setMessage('Driver profile created successfully.')
      setServerError('')
      reset()
      setActiveTab('registry')
    },
    onError: (error) => {
      setMessage('')
      setServerError(getApiErrorMessage(error, 'Unable to create driver.'))
    },
  })

  const deactivateDriver = useMutation({
    mutationFn: async (driverId) => api.delete(`/admin/drivers/${driverId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-drivers'] })
      setMessage('Driver profile deactivated.')
    },
  })

  if (!isAdmin) {
    return (
      <div className="py-20">
        <EmptyState title="Access Restricted" description="Only administrators can manage personnel." />
      </div>
    )
  }

  const drivers = driversQuery.data || []

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          eyebrow="Personnel Directory"
          title="Driver Management"
          description="Register and manage specialized operators and their transit credentials."
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
            <UsersIcon className="h-4 w-4" />
            Drivers
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
          <SectionPanel title="Driver List" icon={UsersIcon} description="Directory of all registered transit drivers and their current status.">
            {drivers.length ? (
              <div className="table-container border-none shadow-none ring-1 ring-slate-200">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="py-4 pl-6 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">Operator Identity</th>
                      <th className="py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">Credentials</th>
                      <th className="py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">License</th>
                      <th className="py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">Status</th>
                      <th className="w-10 pr-6 border-b border-slate-200"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {drivers.map((driver) => (
                      <tr key={driver.id} className="group hover:bg-slate-50/30 transition-colors">
                        <td className="py-5 pl-6">
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-slate-200 group-hover:bg-white group-hover:text-teal-600 group-hover:ring-teal-100 transition-all font-bold text-xs uppercase">
                              {driver.name?.slice(0, 2)}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-black text-slate-900 leading-none">{driver.name}</span>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1.5">{driver.role}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <EnvelopeIcon className="h-4 w-4 text-slate-300" />
                            <span className="text-sm font-medium text-slate-600">{driver.email}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <IdentificationIcon className="h-4 w-4 text-slate-300" />
                            <span className="font-mono text-xs font-bold text-slate-500 tracking-wider uppercase">{driver.driver_profile?.license_no || 'NOT FILED'}</span>
                          </div>
                        </td>
                        <td><StatusBadge value={driver.status} /></td>
                        <td className="pr-6 text-right">
                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 hover:shadow-sm transition-all active:scale-90"
                            type="button"
                            title="Deactivate Operator"
                            onClick={() => {
                              setConfirmModal({
                                isOpen: true,
                                driverId: driver.id,
                                driverName: driver.name,
                              })
                            }}
                            disabled={deactivateDriver.isPending || driver.status === 'inactive'}
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
                  title={driversQuery.isLoading ? 'Syncing personnel records...' : 'No Operators Found'} 
                  description="Onboard the first transit operator to begin fleet dispatch."
                  action={
                    <button onClick={() => setActiveTab('registration')} className="primary-button mt-6">
                      <PlusIcon className="h-4 w-4" />
                      Onboard First Operator
                    </button>
                  }
                />
              </div>
            )}
          </SectionPanel>

          <ConfirmationModal
            isOpen={confirmModal.isOpen}
            onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
            onConfirm={() => deactivateDriver.mutate(confirmModal.driverId)}
            title="Deactivate Operator"
            description={`Are you sure you want to deactivate ${confirmModal.driverName}? This operator will no longer be able to log in or manage trips.`}
            confirmText="Deactivate"
          />
        </main>
      ) : (
        <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
          <SectionPanel title="Driver Registration" icon={PlusIcon} description="Create a new operator profile and system access.">
            <form className="space-y-6" onSubmit={handleSubmit((values) => createDriver.mutate(values))}>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Full Legal Name" error={errors.name?.message}>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <UsersIcon className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-teal-600" />
                    </div>
                    <input 
                      className="form-input !pl-12 bg-slate-50/40 border-slate-200/80 focus:bg-white" 
                      placeholder="e.g. Robert Smith" 
                      {...register('name')} 
                    />
                  </div>
                </Field>
                <Field label="Work Email Address" error={errors.email?.message}>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <EnvelopeIcon className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-teal-600" />
                    </div>
                    <input 
                      className="form-input !pl-12 bg-slate-50/40 border-slate-200/80 focus:bg-white" 
                      type="email" 
                      placeholder="robert.s@company.com" 
                      {...register('email')} 
                    />
                  </div>
                </Field>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Temporary Password" error={errors.password?.message}>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <KeyIcon className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-teal-600" />
                    </div>
                    <input 
                      className="form-input !pl-12 bg-slate-50/40 border-slate-200/80 focus:bg-white" 
                      type="password" 
                      placeholder="••••••••" 
                      {...register('password')} 
                    />
                  </div>
                </Field>
                <Field label="Operator License No." error={errors.license_no?.message}>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <IdentificationIcon className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-teal-600" />
                    </div>
                    <input 
                      className="form-input !pl-12 bg-slate-50/40 border-slate-200/80 focus:bg-white" 
                      placeholder="DL-XXXX-XXXX" 
                      {...register('license_no')} 
                    />
                  </div>
                </Field>
              </div>

              <Field label="Operational Status" error={errors.status?.message}>
                <div className="group relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Cog6ToothIcon className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-teal-600" />
                  </div>
                  <select className="form-input !pl-12 font-bold bg-slate-50/40 border-slate-200/80 focus:bg-white" {...register('status')}>
                    <option value="active">ACTIVE</option>
                    <option value="inactive">INACTIVE</option>
                  </select>
                </div>
              </Field>

              <Field label="Operator Notes" error={errors.notes?.message}>
                <div className="group relative">
                  <div className="pointer-events-none absolute left-3 top-3">
                    <DocumentTextIcon className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-teal-600" />
                  </div>
                  <textarea 
                    className="form-input !pl-12 min-h-[120px] resize-none bg-slate-50/40 border-slate-200/80 focus:bg-white" 
                    placeholder="Special certifications or notes..." 
                    {...register('notes')} 
                  />
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
                    disabled={isSubmitting || createDriver.isPending}
                    icon={PlusIcon}
                    isLoading={isSubmitting || createDriver.isPending}
                    loadingText="Creating Operator..."
                  >
                    Initialize Operator
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

export default DriversPage
