import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRightEndOnRectangleIcon, TruckIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { api } from '../lib/api.js'
import Field from '../components/Field.jsx'
import FormAlert from '../components/FormAlert.jsx'
import SubmitButton from '../components/SubmitButton.jsx'
import { defaultRouteForRole } from '../lib/roleRoutes.js'

const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.').max(255, 'Password must be 255 characters or less.'),
})

function LoginPage({ onAuthenticated }) {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(values) {
    setServerError('')

    try {
      const response = await api.post('/auth/login', {
        ...values,
        device_name: 'web',
      })

      onAuthenticated(response.data)
      navigate(defaultRouteForRole(response.data.user?.role), { replace: true })
    } catch (error) {
      setServerError(error.response?.data?.message || 'Unable to log in with those credentials.')
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_500px]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-slate-900 p-12 text-white lg:flex">
        {/* Decorative background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/20 to-slate-900" />
          <div className="absolute -left-1/4 -top-1/4 h-[100%] w-[100%] rounded-full bg-teal-500/10 blur-[120px]" />
          <div className="absolute -bottom-1/4 -right-1/4 h-[100%] w-[100%] rounded-full bg-blue-500/10 blur-[120px]" />
        </div>

        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-xl shadow-teal-900/40">
            <TruckIcon className="h-7 w-7" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-widest">FerryBus</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-teal-400">Operations Intelligence</p>
          </div>
        </div>

        <div className="relative z-10 max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-teal-400/80">Professional Dashboard</p>
          <h2 className="mt-6 text-6xl font-black leading-[1.1] tracking-tight text-white">
            Precision control for fleet logistics.
          </h2>
          <p className="mt-8 text-lg font-medium leading-relaxed text-slate-300">
            Manage transit cycles, optimize driver routing, and maintain passenger synchronization through our unified operations workspace.
          </p>
        </div>

        <div className="relative z-10 flex gap-4">
          {['Optimized Routing', 'Live Tracking', 'Instant Dispatch'].map((item) => (
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600">Operations Control</p>
            </div>
          </div>

          <div className="mb-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600">Access Portal</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 uppercase">Welcome Back</h2>
            <p className="mt-3 text-sm font-medium text-slate-500">Sign in to manage your transit ecosystem.</p>
          </div>

          <div className="app-panel border-none bg-white p-8 shadow-2xl shadow-slate-200/60">
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              <Field label="Work Email" error={errors.email?.message}>
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  className="form-input py-3"
                />
              </Field>
              <Field label="Security Key" error={errors.password?.message}>
                <input
                  {...register('password')}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="form-input py-3"
                />
              </Field>

              <FormAlert>{serverError}</FormAlert>

              <SubmitButton
                className="primary-button w-full py-4 text-sm uppercase tracking-widest font-black"
                disabled={isSubmitting}
                icon={ArrowRightEndOnRectangleIcon}
                isLoading={isSubmitting}
                loadingText="Authenticating..."
              >
                Enter Workspace
              </SubmitButton>
            </form>
          </div>

          <p className="mt-8 text-center text-sm font-bold text-slate-500 uppercase tracking-wider">
            New to the system?{' '}
            <Link className="text-teal-600 hover:text-teal-700 underline underline-offset-4 decoration-2" to="/register">
              Create Account
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}

export default LoginPage
