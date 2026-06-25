'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  FileText,
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

const inputClass =
  'w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-white placeholder:text-white/40 focus:border-[#D4A62E]/50 focus:outline-none focus:ring-2 focus:ring-[#D4A62E]/20'

interface OnboardingWizardProps {
  step: OnboardingStep
  ownerName: string
}

export function OnboardingWizard({ step, ownerName }: OnboardingWizardProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const progress = onboardingProgress(step)
  const stepIndex = ONBOARDING_STEPS.indexOf(step)

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.success) {
        setError(result.error ?? 'Something went wrong.')
        toast.error(result.error ?? 'Something went wrong.')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-white/50">
          <span>Setup · {ONBOARDING_STEP_LABELS[step]}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#D4A62E] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-md">
        {error && (
          <p className="mb-6 rounded-lg bg-red-500/20 px-4 py-3 text-sm text-red-100" role="alert">
            {error}
          </p>
        )}

        {step === 'welcome' && (
          <WelcomeStep ownerName={ownerName} pending={pending} onContinue={() => run(completeWelcomeStep)} />
        )}
        {step === 'property' && (
          <PropertyStep pending={pending} onSubmit={(data) => run(() => completePropertyStep(data))} />
        )}
        {step === 'compliance' && (
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
        {step === 'team' && (
          <TeamStep
            pending={pending}
            onSubmit={(email) => run(() => completeTeamStep({ managerEmail: email, skip: !email }))}
            onSkip={() => run(() => completeTeamStep({ skip: true }))}
          />
        )}
        {step === 'done' && (
          <DoneStep
            pending={pending}
            onLaunch={() =>
              run(async () => {
                const result = await finishOnboarding()
                if (result.success) router.push('/owner/dashboard')
                return result
              })
            }
          />
        )}
      </div>
    </div>
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
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#D4A62E]/20 text-[#D4A62E]">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Welcome, {ownerName.split(' ')[0]}</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Let&apos;s configure your property, Ghana compliance fields, and optional manager access.
            This takes about five minutes.
          </p>
        </div>
      </div>
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
      <button type="button" className="btn-primary h-11 w-full gap-2 sm:w-auto" disabled={pending} onClick={onContinue}>
        Let&apos;s set up your property
        <ChevronRight className="h-4 w-4" />
      </button>
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
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required placeholder="MOJO Apartments Osu" />
      </Field>
      <Field label="Street address">
        <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="14 Oxford Street" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City">
          <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} required />
        </Field>
        <Field label="Region">
          <select className={inputClass} value={region} onChange={(e) => setRegion(e.target.value as (typeof GHANA_REGIONS)[number])}>
            {GHANA_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Number of rooms">
        <input className={inputClass} type="number" min={1} max={200} value={totalRooms} onChange={(e) => setTotalRooms(Number(e.target.value))} required />
      </Field>
      <button type="submit" className="btn-primary h-11 w-full sm:w-auto" disabled={pending}>
        Create property & continue
      </button>
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
        <input className={inputClass} value={gtaLicenseNumber} onChange={(e) => setGtaLicenseNumber(e.target.value)} placeholder="GTA-XXXX" />
      </Field>
      <Field label="GTA licence expiry">
        <input className={inputClass} type="date" value={gtaLicenseExpiry} onChange={(e) => setGtaLicenseExpiry(e.target.value)} />
      </Field>
      <Field label="VAT registration (TIN)">
        <input className={inputClass} value={vatRegistrationNumber} onChange={(e) => setVatRegistrationNumber(e.target.value)} placeholder="C000XXXXXXX" />
      </Field>
      <Field label="VAT display on invoices">
        <select className={inputClass} value={vatMode} onChange={(e) => setVatMode(e.target.value as 'exclusive' | 'inclusive')}>
          <option value="exclusive">Exclusive — tax added on top</option>
          <option value="inclusive">Inclusive — tax included in room rate</option>
        </select>
      </Field>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primary h-11" disabled={pending}>
          Save & continue
        </button>
        <button type="button" className="btn-secondary h-11 border-white/20 bg-transparent text-white hover:bg-white/10" disabled={pending} onClick={onSkip}>
          Skip for now
        </button>
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
        <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="manager@yourproperty.com" />
      </Field>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-primary h-11" disabled={pending || !email.trim()} onClick={() => onSubmit(email.trim())}>
          Send invite & continue
        </button>
        <button type="button" className="btn-secondary h-11 border-white/20 bg-transparent text-white hover:bg-white/10" disabled={pending} onClick={onSkip}>
          Skip — I&apos;ll invite later
        </button>
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
      <button type="button" className="btn-primary mx-auto h-11 min-w-[200px] gap-2" disabled={pending} onClick={onLaunch}>
        Open dashboard
        <ChevronRight className="h-4 w-4" />
      </button>
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
        <p className="mt-1 text-sm text-white/65">{description}</p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-white/90">{label}</span>
      {children}
    </label>
  )
}
