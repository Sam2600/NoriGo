import { PencilSquareIcon, PlusIcon, TruckIcon, XCircleIcon } from '@heroicons/react/24/outline'
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

const busSchema = z.object({
  bus_code: z.string().min(1, 'Bus code is required.'),
  plate_number: z.string().optional(),
  seat_count: z.coerce.number().int().min(1, 'Seat count is required.'),
  status: z.enum(['active', 'inactive', 'maintenance']),
  notes: z.string().optional(),
})

const emptyBus = {
  bus_code: '',
  plate_number: '',
  seat_count: 40,
  status: 'active',
  notes: '',
}

function BusesPage() {
  const queryClient = useQueryClient()
  const [editingBus, setEditingBus] = useState(null)
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(busSchema),
    defaultValues: emptyBus,
  })

  const busesQuery = useQuery({
    queryKey: ['admin', 'buses'],
    queryFn: async () => {
      const response = await api.get('/admin/buses')
      return response.data.data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      const payload = {
        ...values,
        plate_number: values.plate_number || null,
        notes: values.notes || null,
      }
      if (editingBus) {
        const response = await api.put(`/admin/buses/${editingBus.id}`, payload)
        return response.data.data
      }
      const response = await api.post('/admin/buses', payload)
      return response.data.data
    },
    onSuccess: () => {
      setMessage(editingBus ? 'Bus updated.' : 'Bus created.')
      setFormError('')
      setEditingBus(null)
      reset(emptyBus)
      queryClient.invalidateQueries({ queryKey: ['admin', 'buses'] })
    },
    onError: (error) => setFormError(getApiErrorMessage(error, 'Unable to save bus.')),
  })

  const deactivateMutation = useMutation({
    mutationFn: async (busId) => {
      await api.delete(`/admin/buses/${busId}`)
    },
    onSuccess: () => {
      setMessage('Bus deactivated.')
      queryClient.invalidateQueries({ queryKey: ['admin', 'buses'] })
    },
  })

  const startEdit = (bus) => {
    setEditingBus(bus)
    setMessage('')
    reset({
      bus_code: bus.bus_code ?? '',
      plate_number: bus.plate_number ?? '',
      seat_count: bus.seat_count ?? 40,
      status: bus.status ?? 'active',
      notes: bus.notes ?? '',
    })
  }

  const clearEdit = () => {
    setEditingBus(null)
    setFormError('')
    reset(emptyBus)
  }

  const buses = busesQuery.data ?? []

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Buses"
        description="Manage bus records and availability for trip assignment."
      />

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <SectionPanel title={editingBus ? 'Edit bus' : 'Add bus'} icon={TruckIcon}>
          <form className="space-y-4" onSubmit={handleSubmit((values) => saveMutation.mutate(values))}>
            <FormAlert type="success">{message}</FormAlert>
            <FormAlert>{formError}</FormAlert>
            <Field label="Bus code" error={errors.bus_code?.message}>
              <input className="form-input" {...register('bus_code')} />
            </Field>
            <Field label="Plate number" error={errors.plate_number?.message}>
              <input className="form-input" {...register('plate_number')} />
            </Field>
            <Field label="Seat count" error={errors.seat_count?.message}>
              <input className="form-input" type="number" min="1" {...register('seat_count')} />
            </Field>
            <Field label="Status" error={errors.status?.message}>
              <select className="form-input" {...register('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </Field>
            <Field label="Notes" error={errors.notes?.message}>
              <textarea className="form-input min-h-24" {...register('notes')} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <SubmitButton icon={PlusIcon} isLoading={saveMutation.isPending}>
                {editingBus ? 'Update bus' : 'Create bus'}
              </SubmitButton>
              {editingBus ? (
                <button type="button" className="secondary-button" onClick={clearEdit}>
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
        </SectionPanel>

        <SectionPanel title="Bus fleet" icon={TruckIcon}>
          {buses.length === 0 ? (
            <EmptyState title="No buses yet" description="Create an active bus before scheduling trips." />
          ) : (
            <div className="table-container">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th>Code</th>
                    <th>Plate</th>
                    <th>Seats</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {buses.map((bus) => (
                    <tr key={bus.id}>
                      <td className="font-semibold text-slate-950">{bus.bus_code}</td>
                      <td>{bus.plate_number ?? '-'}</td>
                      <td>{bus.seat_count}</td>
                      <td><StatusBadge value={bus.status} /></td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="secondary-button px-3 py-2" onClick={() => startEdit(bus)}>
                            <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="danger-button px-3 py-2"
                            disabled={deactivateMutation.isPending || bus.status === 'inactive'}
                            onClick={() => deactivateMutation.mutate(bus.id)}
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

export default BusesPage
