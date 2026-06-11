'use client'

import { MessageCircle, Phone } from 'lucide-react'
import { telHref, whatsAppHref } from '@/lib/phone'
import type { StaffContact } from '@/lib/data/contacts'

interface PhoneContactProps {
  name: string
  phone: string
  label?: string
  variant?: 'light' | 'dark'
  compact?: boolean
  whatsAppMessage?: string
}

export function PhoneContact({
  name,
  phone,
  label,
  variant = 'light',
  compact = false,
  whatsAppMessage,
}: PhoneContactProps) {
  const tel = telHref(phone)
  const wa = whatsAppHref(phone, whatsAppMessage)
  if (!tel) return null

  const isDark = variant === 'dark'

  const cardClass = `flex items-center gap-3 rounded-xl transition-colors ${
    compact ? 'px-3 py-2' : 'px-4 py-3'
  } ${
    isDark
      ? 'bg-white/10 hover:bg-white/15'
      : 'bg-white shadow-elevation-1 hover:shadow-elevation-2'
  }`

  const iconClass = `flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
    isDark ? 'bg-[#D4A62E]/20 text-[#D4A62E]' : 'bg-[#3C216C]/8 text-[#3C216C]'
  }`

  return (
    <div className={cardClass}>
      <a href={tel} className="flex min-w-0 flex-1 items-center gap-3">
        <span className={iconClass}>
          <Phone className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-semibold ${isDark ? 'text-white' : 'text-foreground'}`}>
            {label ?? name}
          </span>
          <span className={`block text-xs ${isDark ? 'text-white/70' : 'text-muted-foreground'}`}>
            {phone}
          </span>
        </span>
      </a>
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`WhatsApp ${name}`}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
            isDark
              ? 'bg-[#25D366]/20 text-[#25D366] hover:bg-[#25D366]/30'
              : 'bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20'
          }`}
        >
          <MessageCircle className="h-4 w-4" />
        </a>
      )}
    </div>
  )
}

interface PhoneContactListProps {
  contacts: StaffContact[]
  title: string
  emptyMessage?: string
  variant?: 'light' | 'dark'
}

export function PhoneContactList({
  contacts,
  title,
  emptyMessage = 'No contact number on file.',
  variant = 'light',
}: PhoneContactListProps) {
  const isDark = variant === 'dark'

  if (contacts.length === 0) {
    return (
      <p className={`text-sm ${isDark ? 'text-white/60' : 'text-muted-foreground'}`}>
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${
          isDark ? 'text-white/70' : 'text-muted-foreground'
        }`}
      >
        {title}
      </p>
      {contacts.map((contact) => (
        <PhoneContact
          key={contact.id}
          name={contact.name}
          phone={contact.phone}
          label={`${contact.name}${contact.role === 'owner' ? ' (Owner)' : ''}`}
          variant={variant}
        />
      ))}
    </div>
  )
}
