import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
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

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
})

function LoginPage({ onAuthenticated }) {
  const navigate = useNavigate()
  const [formError, setFormError] = useState('')
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const loginMutation = useMutation({
    mutationFn: async (values) => {
      const response = await api.post('/auth/login', { ...values, device_name: 'web' })
      return response.data
    },
    onSuccess: (session) => {
      saveAuthSession(session)
      onAuthenticated(session.user)
      navigate(defaultRouteForRole(session.user.role), { replace: true })
    },
    onError: (error) => setFormError(getApiErrorMessage(error, 'Unable to sign in.')),
  })

  return (
    <main className="grid min-h-screen bg-slate-100 lg:grid-cols-[1fr_480px]">
      <section className="hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="text-2xl font-bold">FerryBus</p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
            Daily ferry schedules and bookings for Yangon crews and passengers.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {['Yangon', 'Morning', 'Evening'].map((item) => (
            <div key={item} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <p className="text-sm font-semibold text-slate-200">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-bold uppercase text-teal-600">Welcome Back</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">Sign in to FerryBus</h1>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit((values) => loginMutation.mutate(values))}>
            <FormAlert>{formError}</FormAlert>
            <Field label="Email" error={errors.email?.message}>
              <input className="form-input" type="email" autoComplete="email" {...register('email')} />
            </Field>
            <Field label="Password" error={errors.password?.message}>
              <input className="form-input" type="password" autoComplete="current-password" {...register('password')} />
            </Field>
            <SubmitButton icon={ArrowRightOnRectangleIcon} isLoading={loginMutation.isPending} loadingText="Signing in...">
              Sign in
            </SubmitButton>
          </form>

          <p className="mt-5 text-sm text-slate-500">
            Need a passenger account?{' '}
            <Link className="font-semibold text-teal-700 hover:text-teal-800" to="/register">
              Register
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}

export default LoginPage
