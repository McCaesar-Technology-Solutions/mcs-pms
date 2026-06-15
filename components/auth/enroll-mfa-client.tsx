'use client'

import { MfaEnrollForm } from '@/components/auth/mfa-enroll-form'

interface EnrollMfaClientProps {
  nextPath: string
  required: boolean
}

export function EnrollMfaClient({ nextPath, required }: EnrollMfaClientProps) {
  return <MfaEnrollForm nextPath={nextPath} required={required} />
}
