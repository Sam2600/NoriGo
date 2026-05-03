import { IdentificationIcon, PencilSquareIcon, PlusIcon, XCircleIcon } from '@heroicons/react/24/outline'
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
import StatusBadge from '../components/StatusBadge.jsx'
import SubmitButton from '../components/SubmitButton.jsx'
import { api } from '../lib/api.js'
import { getApiErrorMessage } from '../lib/apiError.js'

const driverSchema = z.object({
  name: z.string().min(1, 'Driver name is required.'),
  email: z.string().email('Enter a valid email address.'),
  password: z.string().optional(),
  license_no: z.string().optional(),
  status: z.enum(['active', 'inactive']),
  notes: z.string().optional(),
})

const emptyDriver = {
  name: '',
  email: '',
  password: '',
  license_no: '',
  status: 'active',
  notes: '',
}

function DriversPage() {
  const queryClient = useQueryClient()
  const [editingDriver, setEditingDriver] = useState(null)
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(driverSchema),
    defaultValues: emptyDriver,
  })

  const driversQuery = useQuery({
    queryKey: ['admin', 'drivers'],
    queryFn: async () => {
      const response = await api.get('/admin/drivers')
      return response.data.data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      const payload = {
        ...values,
        password: values.password || undefined,
        license_no: values.license_no || null,
        notes: values.notes || null,
      }
      if (editingDriver) {
        const response = await api.put(`/admin/drivers/${editingDriver.id}`, payload)
        return response.data.data
      }
      const response = await api.post('/admin/drivers', payload)
      return response.data.data
    },
    onSuccess: () => {
      setMessage(editingDriver ? 'Driver updated.' : 'Driver created.')
      setFormError('')
      setEditingDriver(null)
      reset(emptyDriver)
      queryClient.invalidateQueries({ queryKey: ['admin', 'drivers'] })
    },
    onError: (error) => setFormError(getApiErrorMessage(error, 'Unable to save driver.')),
  })

  const deactivateMutation = useMutation({
    mutationFn: async (driverId) => {
      await api.delete(`/admin/drivers/${driverId}`)
    },
    onSuccess: () => {
      setMessage('Driver deactivated.')
      queryClient.invalidateQueries({ queryKey: ['admin', 'drivers'] })
    },
  })

  const startEdit = (driver) => {
    setEditingDriver(driver)
    setMessage('')
    reset({
      name: driver.name ?? '',
      email: driver.email ?? '',
      password: '',
      license_no: driver.driver_profile?.license_no ?? '',
      status: driver.status ?? 'active',
      notes: driver.driver_profile?.notes ?? '',
    })
  }

  const clearEdit = () => {
    setEditingDriver(null)
    setFormError('')
    reset(emptyDriver)
  }

  const submitDriver = (values) => {
    if (!editingDriver && !values.password) {
      setFormError('Password is required for new drivers.')
      return
    }
    saveMutation.mutate(values)
  }

  const drivers = driversQuery.data ?? []

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Drivers"
        description="Create driver accounts and keep their availability ready for schedules."
      />

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <SectionPanel title={editingDriver ? 'Edit driver' : 'Add driver'} icon={IdentificationIcon}>
          <form className="space-y-4" onSubmit={handleSubmit(submitDriver)}>
            <FormAlert type="success">{message}</FormAlert>
            <FormAlert>{formError}</FormAlert>
            <Field label="Name" error={errors.name?.message}>
              <input className="form-input" {...register('name')} />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <input className="form-input" type="email" {...register('email')} />
            </Field>
            <Field label={editingDriver ? 'New password' : 'Password'} error={errors.password?.message}>
              <input className="form-input" type="password" autoComplete="new-password" {...register('password')} />
            </Field>
            <Field label="License number" error={errors.license_no?.message}>
              <input className="form-input" {...register('license_no')} />
            </Field>
            <Field label="Status" error={errors.status?.message}>
              <select className="form-input" {...register('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
            <Field label="Notes" error={errors.notes?.message}>
              <textarea className="form-input min-h-24" {...register('notes')} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <SubmitButton icon={PlusIcon} isLoading={saveMutation.isPending}>
                {editingDriver ? 'Update driver' : 'Create driver'}
              </SubmitButton>
              {editingDriver ? (
                <button type="button" className="secondary-button" onClick={clearEdit}>
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
        </SectionPanel>

        <SectionPanel title="Driver roster" icon={IdentificationIcon}>
          {drivers.length === 0 ? (
            <EmptyState title="No drivers yet" description="Create a driver before scheduling trips." />
          ) : (
            <div className="table-container">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>License</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {drivers.map((driver) => (
                    <tr key={driver.id}>
                      <td className="font-semibold text-slate-950">{driver.name}</td>
                      <td>{driver.email}</td>
                      <td>{driver.driver_profile?.license_no ?? '-'}</td>
                      <td><StatusBadge value={driver.status} /></td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="secondary-button px-3 py-2" onClick={() => startEdit(driver)}>
                            <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="danger-button px-3 py-2"
                            disabled={deactivateMutation.isPending || driver.status === 'inactive'}
                            onClick={() => deactivateMutation.mutate(driver.id)}
                          >
                            <XCircleIcon className="h-4 w-4" aria-hidden="true" />
                            Deactivate
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

export default DriversPage
