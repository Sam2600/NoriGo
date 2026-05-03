import { zodResolver } from '@hookform/resolvers/zod'
import { PlusIcon, TruckIcon, TrashIcon, IdentificationIcon, UserGroupIcon, Cog6ToothIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
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
  bus_code: z.string().trim().min(1, 'Bus code is required.').max(30, 'Bus code must be 30 characters or less.'),
  plate_number: z.string().trim().max(30, 'Plate number must be 30 characters or less.').optional(),
  seat_count: z.coerce.number().int().min(1, 'Seat count must be at least 1.').max(80, 'Seat count must be 80 or less.'),
  status: z.enum(['active', 'inactive', 'maintenance']),
  notes: z.string().trim().max(1000, 'Technical notes must be 1000 characters or less.').optional(),
})

function BusesPage({ user }) {
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('registry')
  const [message, setMessage] = useState('')
  const [serverError, setServerError] = useState('')
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, busId: null, busCode: '' })

  const busesQuery = useQuery({
    queryKey: ['admin-buses'],
    queryFn: async () => {
      const response = await api.get('/admin/buses')
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
      bus_code: '',
      plate_number: '',
      seat_count: 24,
      status: 'active',
      notes: '',
    },
  })

  const createBus = useMutation({
    mutationFn: async (values) => api.post('/admin/buses', values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-buses'] })
      setMessage('Bus unit registered successfully.')
      setServerError('')
      reset()
      setActiveTab('registry')
    },
    onError: (error) => {
      setMessage('')
      setServerError(getApiErrorMessage(error, 'Unable to create bus.'))
    },
  })

  const deactivateBus = useMutation({
    mutationFn: async (busId) => api.delete(`/admin/buses/${busId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-buses'] })
      setMessage('Bus unit deactivated.')
    },
  })

  if (!isAdmin) {
    return (
      <div className="py-20">
        <EmptyState title="Access Restricted" description="Only administrators can manage the vehicle fleet." />
      </div>
    )
  }

  const buses = busesQuery.data || []

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          eyebrow="Fleet Assets"
          title="Vehicle Management"
          description="Register and monitor the operational status of all ferry bus units in the system."
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
            <TruckIcon className="h-4 w-4" />
            Vehicles
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
          <SectionPanel title="Vehicle List" icon={TruckIcon} description="Manifest of all registered transit vehicles and their current status.">
            {buses.length ? (
              <div className="table-container border-none shadow-none ring-1 ring-slate-200">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="py-4 pl-6 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">Unit Identity</th>
                      <th className="py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">License Plate</th>
                      <th className="py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">Capacity</th>
                      <th className="py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">Status</th>
                      <th className="w-10 pr-6 border-b border-slate-200"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {buses.map((bus) => (
                      <tr key={bus.id} className="group hover:bg-slate-50/30 transition-colors">
                        <td className="py-5 pl-6">
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-slate-200 group-hover:bg-white group-hover:text-teal-600 group-hover:ring-teal-100 transition-all">
                              <TruckIcon className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-black text-slate-900 uppercase tracking-tight">{bus.bus_code}</span>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Main Fleet</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <IdentificationIcon className="h-4 w-4 text-slate-300" />
                            <span className="font-mono text-xs font-bold text-slate-600 tracking-wider uppercase">{bus.plate_number || 'N/A'}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <UserGroupIcon className="h-4 w-4 text-slate-300" />
                            <span className="text-sm font-bold text-slate-700">{bus.seat_count} Seats</span>
                          </div>
                        </td>
                        <td><StatusBadge value={bus.status} /></td>
                        <td className="pr-6 text-right">
                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 hover:shadow-sm transition-all active:scale-90"
                            type="button"
                            title="Deactivate Unit"
                            onClick={() => {
                              setConfirmModal({
                                isOpen: true,
                                busId: bus.id,
                                busCode: bus.bus_code,
                              })
                            }}
                            disabled={deactivateBus.isPending || bus.status === 'inactive'}
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
                  title={busesQuery.isLoading ? 'Syncing fleet database...' : 'No Units Found'} 
                  description="Register the first vehicle to begin operational planning."
                  action={
                    <button onClick={() => setActiveTab('registration')} className="primary-button mt-6">
                      <PlusIcon className="h-4 w-4" />
                      Register First Unit
                    </button>
                  }
                />
              </div>
            )}
          </SectionPanel>

          <ConfirmationModal
            isOpen={confirmModal.isOpen}
            onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
            onConfirm={() => deactivateBus.mutate(confirmModal.busId)}
            title="Deactivate Unit"
            description={`Are you sure you want to deactivate ${confirmModal.busCode}? This vehicle will no longer be available for transit scheduling.`}
            confirmText="Deactivate"
          />
        </main>
      ) : (
        <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
          <SectionPanel title="Vehicle Registration" icon={PlusIcon} description="Add a new vehicle to the operational fleet.">
            <form className="space-y-6" onSubmit={handleSubmit((values) => createBus.mutate(values))}>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Identification Code" error={errors.bus_code?.message}>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <TruckIcon className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-teal-600" />
                    </div>
                    <input 
                      className="form-input !pl-12 bg-slate-50/40 border-slate-200/80 focus:bg-white" 
                      placeholder="e.g. BUS-001" 
                      {...register('bus_code')} 
                    />
                  </div>
                </Field>
                <Field label="Plate Number" error={errors.plate_number?.message}>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <IdentificationIcon className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-teal-600" />
                    </div>
                    <input 
                      className="form-input !pl-12 bg-slate-50/40 border-slate-200/80 focus:bg-white" 
                      placeholder="ABC-1234" 
                      {...register('plate_number')} 
                    />
                  </div>
                </Field>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Seating Capacity" error={errors.seat_count?.message}>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <UserGroupIcon className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-teal-600" />
                    </div>
                    <input 
                      className="form-input !pl-12 bg-slate-50/40 border-slate-200/80 focus:bg-white" 
                      type="number" 
                      min="1" 
                      {...register('seat_count')} 
                    />
                  </div>
                </Field>
                <Field label="Operational Status" error={errors.status?.message}>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Cog6ToothIcon className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-teal-600" />
                    </div>
                    <select className="form-input !pl-12 font-bold bg-slate-50/40 border-slate-200/80 focus:bg-white" {...register('status')}>
                      <option value="active">ACTIVE</option>
                      <option value="maintenance">MAINTENANCE</option>
                      <option value="inactive">INACTIVE</option>
                    </select>
                  </div>
                </Field>
              </div>

              <Field label="Technical Notes" error={errors.notes?.message}>
                <div className="group relative">
                  <div className="pointer-events-none absolute left-3 top-3">
                    <DocumentTextIcon className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-teal-600" />
                  </div>
                  <textarea 
                    className="form-input !pl-12 min-h-[120px] resize-none bg-slate-50/40 border-slate-200/80 focus:bg-white" 
                    placeholder="Enter any maintenance history or special notes..." 
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
                    disabled={isSubmitting || createBus.isPending}
                    icon={PlusIcon}
                    isLoading={isSubmitting || createBus.isPending}
                    loadingText="Registering Unit..."
                  >
                    Commit Unit
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

export default BusesPage
