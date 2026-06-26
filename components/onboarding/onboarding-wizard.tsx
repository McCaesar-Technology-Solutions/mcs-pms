'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  FileText,
  Loader2,
  Rocket,
  Sparkles,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  completeComplianceStep,
  completePropertyStep,
  completeTeamStep,
  completeWelcomeStep,
  finishOnboarding,
} from '@/app/actions/onboarding'
import {
  ONBOARDING_STEP_LABELS,
  ONBOARDING_STEPS,
  onboardingProgress,
  type OnboardingStep,
} from '@/lib/onboarding/state'
import { cn } from '@/lib/utils'

const GHANA_REGIONS = [
  'Greater Accra',
  'Ashanti',
  'Western',
  'Central',
  'Eastern',
  'Northern',
  'Volta',
  'Upper East',
  'Upper West',
  'Bono',
  'Bono East',
  'Ahafo',
  'Savannah',
  'North East',
  'Oti',
  'Western North',
] as const

const LOADING_MESSAGES: Partial<Record<OnboardingStep, string>> = {
  welcome: 'Getting things ready…',
  property: 'Creating your property and rooms…',
  compliance: 'Saving compliance details…',
  team: 'Sending manager invite…',
  done: 'Opening your dashboard…',
}

const inputClass =
  'w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-white placeholder:text-white/40 transition-colors focus:border-[#D4A62E]/60 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-[#D4A62E]/25'

interface OnboardingWizardProps {
  step: OnboardingStep
  ownerName: string
}

export function OnboardingWizard({ step, ownerName }: OnboardingWizardProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null)
  const [visibleStep, setVisibleStep] = useState(step)
  const [animating, setAnimating] = useState(false)

  const progress = onboardingProgress(step)
  const stepIndex = ONBOARDING_STEPS.indexOf(step)

  useEffect(() => {
    if (step === visibleStep) return
    setAnimating(true)
    const timer = window.setTimeout(() => {
      setVisibleStep(step)
      setLoadingMessage(null)
      setAnimating(false)
    }, 280)
    return () => window.clearTimeout(timer)
  }, [step, visibleStep])

  function run(
    action: () => Promise<{ success: boolean; error?: string }>,
    message = LOADING_MESSAGES[step] ?? 'Saving…',
  ) {
    setError(null)
    setLoadingMessage(message)
    startTransition(async () => {
      const result = await action()
      if (!result.success) {
        setLoadingMessage(null)
        setError(result.error ?? 'Something went wrong.')
        toast.error(result.error ?? 'Something went wrong.')
        return
      }
      router.refresh()
    })
  }

  const showLoader = pending || loadingMessage !== null || animating

  return (
    <div className="mx-auto w-full max-w-3xl">
      <StepIndicator current={step} />

      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-white/50">
          <span>Setup · {ONBOARDING_STEP_LABELS[step]}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#D4A62E] transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-md">
        {showLoader && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#22124C]/85 px-6 backdrop-blur-sm animate-in fade-in duration-200">
            <Loader2 className="h-10 w-10 animate-spin text-[#D4A62E]" aria-hidden />
            <p className="text-center text-sm font-medium text-white/90">
              {loadingMessage ?? 'Loading next step…'}
            </p>
          </div>
        )}

        <div className="p-8">
          {error && (
            <p
              className="mb-6 rounded-xl border border-red-400/30 bg-red-500/20 px-4 py-3 text-sm text-red-100 animate-in fade-in slide-in-from-top-2 duration-300"
              role="alert"
            >
              {error}
            </p>
          )}

          <div
            key={visibleStep}
            className={cn(
              'transition-all duration-300 ease-out',
              animating ? 'scale-[0.98] opacity-0' : 'animate-in fade-in slide-in-from-right-4 duration-300',
            )}
          >
            {visibleStep === 'welcome' && (
              <WelcomeStep
                ownerName={ownerName}
                pending={pending}
                onContinue={() => run(completeWelcomeStep)}
              />
            )}
            {visibleStep === 'property' && (
              <PropertyStep pending={pending} onSubmit={(data) => run(() => completePropertyStep(data))} />
            )}
            {visibleStep === 'compliance' && (
              <ComplianceStep
                pending={pending}
                onSubmit={(data) => run(() => completeComplianceStep(data))}
                onSkip={() =>
                  run(() =>
                    completeComplianceStep({
                      gtaLicenseNumber: '',
                      gtaLicenseExpiry: '',
                      vatRegistrationNumber: '',
                      vatMode: 'exclusive',
                    }),
                  )
                }
              />
            )}
            {visibleStep === 'team' && (
              <TeamStep
                pending={pending}
                onSubmit={(email) => run(() => completeTeamStep({ managerEmail: email, skip: !email }))}
                onSkip={() => run(() => completeTeamStep({ skip: true }))}
              />
            )}
            {visibleStep === 'done' && (
              <DoneStep
                pending={pending}
                onLaunch={() =>
                  run(async () => {
                    const result = await finishOnboarding()
                    if (result.success) router.push('/owner/dashboard')
                    return result
                  }, LOADING_MESSAGES.done)
                }
              />
            )}
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-white/40">
        Step {stepIndex + 1} of {ONBOARDING_STEPS.length}
      </p>
    </div>
  )
}

function StepIndicator({ current }: { current: OnboardingStep }) {
  const currentIndex = ONBOARDING_STEPS.indexOf(current)

  return (
    <ol className="mb-8 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      {ONBOARDING_STEPS.map((step, index) => {
        const done = index < currentIndex
        const active = step === current
        return (
          <li key={step} className="flex items-center gap-2 sm:gap-3">
            <div
              className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-300',
                done && 'bg-emerald-500/20 text-emerald-200',
                active && 'bg-[#D4A62E]/25 text-[#F5D77A] ring-1 ring-[#D4A62E]/40',
                !done && !active && 'bg-white/5 text-white/40',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[10px]',
                  done && 'bg-emerald-500 text-white',
                  active && 'bg-[#D4A62E] text-[#22124C]',
                  !done && !active && 'bg-white/10 text-white/50',
                )}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className="hidden sm:inline">{ONBOARDING_STEP_LABELS[step]}</span>
            </div>
            {index < ONBOARDING_STEPS.length - 1 && (
              <span className={cn('hidden h-px w-4 sm:block', done ? 'bg-emerald-400/50' : 'bg-white/10')} />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function PrimaryButton({
  children,
  pending,
  className,
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pending?: boolean }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-11 min-w-[160px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#D4A62E] px-6 text-sm font-semibold text-[#22124C] shadow-lg shadow-[#D4A62E]/30 transition-all hover:bg-[#E8C45A] hover:shadow-[#D4A62E]/45 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      disabled={pending || props.disabled}
      {...props}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  )
}

function SecondaryButton({
  children,
  pending,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pending?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-6 text-sm font-semibold text-white transition-all hover:border-white/40 hover:bg-white/15 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      disabled={pending || props.disabled}
      {...props}
    >
      {children}
    </button>
  )
}

function WelcomeStep({
  ownerName,
  pending,
  onContinue,
}: {
  ownerName: string
  pending: boolean
  onContinue: () => void
}) {
  return (
    <div className="space-y-6 text-white">
      <StepHeader
        icon={Sparkles}
        title={`Welcome, ${ownerName.split(' ')[0]}`}
        description="Let's configure your property, Ghana compliance fields, and optional manager access. This takes about five minutes."
      />
      <ul className="grid gap-3 sm:grid-cols-2">
        {[
          'Room inventory & nightly rates',
          'GRA-ready invoicing on checkout',
          'Guest portal & complaints',
          'OTA calendar sync (iCal)',
        ].map((item) => (
          <li
            key={item}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            {item}
          </li>
        ))}
      </ul>
      <PrimaryButton pending={pending} onClick={onContinue} className="w-full sm:w-auto">
        Let&apos;s set up your property
        <ChevronRight className="h-4 w-4" />
      </PrimaryButton>
    </div>
  )
}

function PropertyStep({
  pending,
  onSubmit,
}: {
  pending: boolean
  onSubmit: (data: Record<string, unknown>) => void
}) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('Accra')
  const [region, setRegion] = useState<(typeof GHANA_REGIONS)[number]>('Greater Accra')
  const [totalRooms, setTotalRooms] = useState(10)

  return (
    <form
      className="space-y-5 text-white"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ name, address, city, region, totalRooms })
      }}
    >
      <StepHeader
        icon={Building2}
        title="Your property"
        description="We create rooms and default rates automatically. You can refine categories later in Settings."
      />
      <Field label="Property name">
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="MOJO Apartments Osu"
        />
      </Field>
      <Field label="Street address">
        <input
          className={inputClass}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
          placeholder="14 Oxford Street"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City">
          <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} required />
        </Field>
        <Field label="Region">
          <select
            className={cn(inputClass, 'cursor-pointer')}
            value={region}
            onChange={(e) => setRegion(e.target.value as (typeof GHANA_REGIONS)[number])}
          >
            {GHANA_REGIONS.map((r) => (
              <option key={r} value={r} className="text-gray-900">
                {r}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Number of rooms">
        <input
          className={inputClass}
          type="number"
          min={1}
          max={200}
          value={totalRooms}
          onChange={(e) => setTotalRooms(Number(e.target.value))}
          required
        />
      </Field>
      <PrimaryButton type="submit" pending={pending} className="w-full sm:w-auto">
        Create property & continue
        <ChevronRight className="h-4 w-4" />
      </PrimaryButton>
    </form>
  )
}

function ComplianceStep({
  pending,
  onSubmit,
  onSkip,
}: {
  pending: boolean
  onSubmit: (data: Record<string, unknown>) => void
  onSkip: () => void
}) {
  const [gtaLicenseNumber, setGtaLicenseNumber] = useState('')
  const [gtaLicenseExpiry, setGtaLicenseExpiry] = useState('')
  const [vatRegistrationNumber, setVatRegistrationNumber] = useState('')
  const [vatMode, setVatMode] = useState<'exclusive' | 'inclusive'>('exclusive')

  return (
    <form
      className="space-y-5 text-white"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ gtaLicenseNumber, gtaLicenseExpiry, vatRegistrationNumber, vatMode })
      }}
    >
      <StepHeader
        icon={FileText}
        title="Ghana compliance"
        description="Optional now — add GTA licence and VAT details for GRA reports and invoice exports."
      />
      <Field label="GTA licence number">
        <input
          className={inputClass}
          value={gtaLicenseNumber}
          onChange={(e) => setGtaLicenseNumber(e.target.value)}
          placeholder="GTA-XXXX"
        />
      </Field>
      <Field label="GTA licence expiry">
        <input
          className={inputClass}
          type="date"
          value={gtaLicenseExpiry}
          onChange={(e) => setGtaLicenseExpiry(e.target.value)}
        />
      </Field>
      <Field label="VAT registration (TIN)">
        <input
          className={inputClass}
          value={vatRegistrationNumber}
          onChange={(e) => setVatRegistrationNumber(e.target.value)}
          placeholder="C000XXXXXXX"
        />
      </Field>
      <Field label="VAT display on invoices">
        <select
          className={cn(inputClass, 'cursor-pointer')}
          value={vatMode}
          onChange={(e) => setVatMode(e.target.value as 'exclusive' | 'inclusive')}
        >
          <option value="exclusive" className="text-gray-900">
            Exclusive — tax added on top
          </option>
          <option value="inclusive" className="text-gray-900">
            Inclusive — tax included in room rate
          </option>
        </select>
      </Field>
      <div className="flex flex-wrap gap-3 pt-1">
        <PrimaryButton type="submit" pending={pending}>
          Save & continue
          <ChevronRight className="h-4 w-4" />
        </PrimaryButton>
        <SecondaryButton type="button" pending={pending} onClick={onSkip}>
          Skip for now
        </SecondaryButton>
      </div>
    </form>
  )
}

function TeamStep({
  pending,
  onSubmit,
  onSkip,
}: {
  pending: boolean
  onSubmit: (email: string) => void
  onSkip: () => void
}) {
  const [email, setEmail] = useState('')

  return (
    <div className="space-y-5 text-white">
      <StepHeader
        icon={Users}
        title="Invite your manager"
        description="Managers run daily ops — reservations, housekeeping, and complaints. They won't see revenue or billing."
      />
      <Field label="Manager email (optional)">
        <input
          className={inputClass}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="manager@yourproperty.com"
        />
      </Field>
      <div className="flex flex-wrap gap-3 pt-1">
        <PrimaryButton pending={pending || !email.trim()} onClick={() => onSubmit(email.trim())}>
          Send invite & continue
          <ChevronRight className="h-4 w-4" />
        </PrimaryButton>
        <SecondaryButton pending={pending} onClick={onSkip}>
          Skip — I&apos;ll invite later
        </SecondaryButton>
      </div>
    </div>
  )
}

function DoneStep({ pending, onLaunch }: { pending: boolean; onLaunch: () => void }) {
  return (
    <div className="space-y-6 text-center text-white">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
        <Rocket className="h-8 w-8" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold">You&apos;re ready to go</h1>
        <p className="mt-2 text-sm text-white/70">
          Your property is live. Open the dashboard to create reservations and connect OTA calendars.
        </p>
      </div>
      <PrimaryButton pending={pending} onClick={onLaunch} className="mx-auto min-w-[220px]">
        Open dashboard
        <ChevronRight className="h-4 w-4" />
      </PrimaryButton>
    </div>
  )
}

function StepHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Building2
  title: string
  description: string
}) {
  return (
    <div className="mb-2 flex items-start gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D4A62E]/20 text-[#D4A62E]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-white/65">{description}</p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-white/90">{label}</span>
      {children}
    </label>
  )
}
