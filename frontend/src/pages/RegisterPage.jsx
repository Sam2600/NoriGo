import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlusIcon, TruckIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { api } from '../lib/api.js'
import Field from '../components/Field.jsx'
import FormAlert from '../components/FormAlert.jsx'
import SubmitButton from '../components/SubmitButton.jsx'
import { defaultRouteForRole } from '../lib/roleRoutes.js'

const schema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(120, 'Name must be 120 characters or less.'),
    email: z.string().email('Enter a valid email address.'),
    password: z.string().min(8, 'Password must be at least 8 characters.').max(255, 'Password must be 255 characters or less.'),
    password_confirmation: z.string().min(8, 'Confirm your password.').max(255, 'Password confirmation must be 255 characters or less.'),
  })
  .refine((values) => values.password === values.password_confirmation, {
    message: 'Passwords do not match.',
    path: ['password_confirmation'],
  })

function RegisterPage({ onAuthenticated }) {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      password_confirmation: '',
    },
  })

  async function onSubmit(values) {
    setServerError('')

    try {
      const response = await api.post('/auth/register', {
        ...values,
        device_name: 'web',
      })

      onAuthenticated(response.data)
      navigate(defaultRouteForRole(response.data.user?.role), { replace: true })
    } catch (error) {
      setServerError(error.response?.data?.message || 'Unable to create your account.')
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_500px]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-slate-900 p-12 text-white lg:flex">
        {/* Decorative background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-slate-900" />
          <div className="absolute -left-1/4 -top-1/4 h-[100%] w-[100%] rounded-full bg-blue-500/10 blur-[120px]" />
          <div className="absolute -bottom-1/4 -right-1/4 h-[100%] w-[100%] rounded-full bg-teal-500/10 blur-[120px]" />
        </div>

        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-xl shadow-blue-900/40">
            <TruckIcon className="h-7 w-7" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-widest">FerryBus</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Passenger Experience</p>
          </div>
        </div>

        <div className="relative z-10 max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-400/80">User Portal</p>
          <h2 className="mt-6 text-6xl font-black leading-[1.1] tracking-tight text-white">
            Smart transit for every journey.
          </h2>
          <p className="mt-8 text-lg font-medium leading-relaxed text-slate-300">
            Secure your seat, track your ride in real-time, and receive instant updates on your transit cycles. Join our connected community.
          </p>
        </div>

        <div className="relative z-10 flex gap-4">
          {['Easy Booking', 'Real-time Alerts', 'Digital Passes'].map((item) => (
            <div key={item} className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-200 backdrop-blur-md">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-4 lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-xl">
              <TruckIcon className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-widest text-slate-900">FerryBus</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Passenger Access</p>
            </div>
          </div>

          <div className="mb-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Onboarding</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 uppercase">Get Started</h2>
            <p className="mt-3 text-sm font-medium text-slate-500">Create your account to start your journey.</p>
          </div>

          <div className="app-panel border-none bg-white p-8 shadow-2xl shadow-slate-200/60">
            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              <Field label="Full Name" error={errors.name?.message}>
                <input
                  {...register('name')}
                  type="text"
                  autoComplete="name"
                  placeholder="John Doe"
                  className="form-input py-2.5"
                />
              </Field>
              <Field label="Email Address" error={errors.email?.message}>
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  placeholder="john@example.com"
                  className="form-input py-2.5"
                />
              </Field>
              <Field label="Security Phrase" error={errors.password?.message}>
                <input
                  {...register('password')}
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="form-input py-2.5"
                />
              </Field>
              <Field label="Confirm Security Phrase" error={errors.password_confirmation?.message}>
                <input
                  {...register('password_confirmation')}
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="form-input py-2.5"
                />
              </Field>

              <FormAlert>{serverError}</FormAlert>

              <SubmitButton
                className="primary-button w-full py-4 text-sm uppercase tracking-widest font-black bg-gradient-to-br from-blue-500 to-blue-700 shadow-blue-500/20"
                disabled={isSubmitting}
                icon={UserPlusIcon}
                isLoading={isSubmitting}
                loadingText="Registering..."
              >
                Create My Account
              </SubmitButton>
            </form>
          </div>

          <p className="mt-8 text-center text-sm font-bold text-slate-500 uppercase tracking-wider">
            Already registered?{' '}
            <Link className="text-blue-600 hover:text-blue-700 underline underline-offset-4 decoration-2" to="/login">
              Sign In
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}

export default RegisterPage
