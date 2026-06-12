'use client'

import { ProfilePhoneEditor } from '@/components/dashboard/profile-phone-editor'
import { CenteredModal, ModalBody, ModalHeader } from '@/components/ui/centered-modal'
import { hasPhoneNumber } from '@/lib/phone'

interface AccountPhoneDialogProps {
  open: boolean
  onClose: () => void
  phone?: string | null
  roleLabel: string
}

export function AccountPhoneDialog({ open, onClose, phone, roleLabel }: AccountPhoneDialogProps) {
  return (
    <CenteredModal open={open} onClose={onClose} className="max-w-md" aria-label="Phone number">
      <ModalHeader onClose={onClose}>
        <h3 className="text-lg font-semibold">
          {hasPhoneNumber(phone) ? 'Update phone number' : 'Add phone number'}
        </h3>
        <p className="modal-panel-subtle text-sm">
          Used for SMS alerts and so guests can reach you.
        </p>
      </ModalHeader>
      <ModalBody>
        <ProfilePhoneEditor initialPhone={phone} roleLabel={roleLabel} variant="embedded" />
      </ModalBody>
    </CenteredModal>
  )
}
