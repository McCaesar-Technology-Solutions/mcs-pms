'use client'

import { MfaVerifyForm } from '@/components/auth/mfa-verify-form'

interface VerifyMfaClientProps {
  nextPath: string
}

export function VerifyMfaClient({ nextPath }: VerifyMfaClientProps) {
  return <MfaVerifyForm nextPath={nextPath} />
}
