import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'
import { getOnboardingPageData } from '@/lib/data/onboarding'
import { redirect } from 'next/navigation'

export default async function GetStartedPage() {
  const data = await getOnboardingPageData()
  if (!data) redirect('/login')

  return (
    <div className="min-h-dvh bg-[#22124C] px-4 py-10">
      <div className="mx-auto mb-10 max-w-3xl text-center">
        <p
          className="text-2xl font-semibold tracking-wide text-[#D4A62E]"
          style={{ fontFamily: 'var(--font-cormorant, "Cormorant Garamond", serif)' }}
        >
          MOJO APARTMENTS
        </p>
        <p className="mt-1 text-sm text-white/50">Property management for Ghana hospitality</p>
      </div>

      <OnboardingWizard
        step={data.step}
        ownerName={data.ownerName}
        subscription={data.subscription}
      />
    </div>
  )
}
