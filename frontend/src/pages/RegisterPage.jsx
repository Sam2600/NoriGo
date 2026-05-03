import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlusIcon } from '@heroicons/react/24/outline'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import Field from '../components/Field.jsx'
import FormAlert from '../components/FormAlert.jsx'
import SubmitButton from '../components/SubmitButton.jsx'
import { saveAuthSession } from '../features/auth/authStorage.js'
import { api } from '../lib/api.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { defaultRouteForRole } from '../lib/roleRoutes.js'

const registerSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
  password_confirmation: z.string().min(8, 'Confirm your password.'),
}).refine((values) => values.password === values.password_confirmation, {
  message: 'Passwords must match.',
  path: ['password_confirmation'],
})

function RegisterPage({ onAuthenticated }) {
  const navigate = useNavigate()
  const [formError, setFormError] = useState('')
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      password_confirmation: '',
    },
  })

  const registerMutation = useMutation({
    mutationFn: async (values) => {
      const response = await api.post('/auth/register', { ...values, device_name: 'web' })
      return response.data
    },
    onSuccess: (session) => {
      saveAuthSession(session)
      onAuthenticated(session.user)
      navigate(defaultRouteForRole(session.user.role), { replace: true })
    },
    onError: (error) => setFormError(getApiErrorMessage(error, 'Unable to register.')),
  })

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-bold uppercase text-teal-600">Passenger Access</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Create your account</h1>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit((values) => registerMutation.mutate(values))}>
          <FormAlert>{formError}</FormAlert>
          <Field label="Name" error={errors.name?.message}>
            <input className="form-input" type="text" autoComplete="name" {...register('name')} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <input className="form-input" type="email" autoComplete="email" {...register('email')} />
          </Field>
          <Field label="Password" error={errors.password?.message}>
            <input className="form-input" type="password" autoComplete="new-password" {...register('password')} />
          </Field>
          <Field label="Confirm password" error={errors.password_confirmation?.message}>
            <input className="form-input" type="password" autoComplete="new-password" {...register('password_confirmation')} />
          </Field>
          <SubmitButton icon={UserPlusIcon} isLoading={registerMutation.isPending} loadingText="Creating...">
            Register
          </SubmitButton>
        </form>

        <p className="mt-5 text-sm text-slate-500">
          Already have an account?{' '}
          <Link className="font-semibold text-teal-700 hover:text-teal-800" to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}

export default RegisterPage
