import { redirect } from 'next/navigation'
import { SignUpForm } from '@/components/auth/signup-form'
import { isPublicSignupAllowed } from '@/lib/env'

export default function SignUpPage() {
  if (!isPublicSignupAllowed()) {
    redirect('/login?error=signup_disabled')
  }

  return <SignUpForm />
}
