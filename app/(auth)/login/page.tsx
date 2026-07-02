import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { LoginForm } from '@/components/auth/login-form'
import { isPublicSignupAllowed } from '@/lib/env'

export default function LoginPage() {
  const publicSignupAllowed = isPublicSignupAllowed()

  return (
    <Suspense
      fallback={
        <div className="auth-form-card">
          <Skeleton tone="dark" className="mx-auto mb-6 h-8 w-48" />
          <div className="space-y-4">
            <Skeleton tone="dark" className="h-10 w-full rounded-lg" />
            <Skeleton tone="dark" className="h-10 w-full rounded-lg" />
            <Skeleton tone="dark" className="h-11 w-full rounded-lg" />
          </div>
        </div>
      }
    >
      <LoginForm publicSignupAllowed={publicSignupAllowed} />
    </Suspense>
  )
}
