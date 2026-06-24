'use client'

import { MfaSmsForm } from '@/components/auth/mfa-sms-form'

interface MfaVerifyFormProps {
  nextPath: string
}

/** Sign-in verification — SMS codes only. */
export function MfaVerifyForm({ nextPath }: MfaVerifyFormProps) {
  return <MfaSmsForm nextPath={nextPath} mode="verify" />
}
