'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {
  Home,
  BedDouble,
  LifeBuoy,
  User,
  Wifi,
  Car,
  Phone,
  Moon,
  Sun,
  Sparkles,
  Clock,
  CalendarPlus,
  FileText,
  MapPin,
  Star,
  ChevronRight,
  Copy,
  Check,
  Download,
  Camera,
  Mail,
  MessageCircle,
} from 'lucide-react'
import {
  Droplets,
  Zap,
  Wind,
  Armchair,
  Volume2,
  HelpCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getGuestComplaints } from '@/app/actions/guest'
import {
  submitGuestRequest,
  setGuestDoNotDisturb,
  submitGuestFeedback,
  submitGuestComplaintWithPhoto,
  getGuestInvoiceReceiptExport,
  emailGuestInvoiceReceiptAction,
  fetchGuestPortalBundle,
} from '@/app/actions/guest-portal'
import { downloadInvoicePdf } from '@/lib/export/invoice-pdf'
import { GuestPhoneEditor } from '@/components/guest/guest-phone-editor'
import { ProfilePhotoUpload } from '@/components/profile/profile-photo-upload'
import { clearGuestProfilePhoto, uploadGuestProfilePhoto } from '@/app/actions/profile-photo'
import { GuestStayTimeline } from '@/components/guest/guest-stay-timeline'
import { GuestComplaintCard } from '@/components/guest/guest-complaint-card'
import { GuestNextStepBanner } from '@/components/guest/guest-next-step-banner'
import { pickGuestNextAction } from '@/lib/complaints/guest-next-action'
import type { GuestNextAction, GuestNextActionFocus } from '@/lib/complaints/guest-next-action'
import { GuestComplaintChat } from '@/components/guest/guest-complaint-chat'
import { GuestStayChat } from '@/components/guest/guest-stay-chat'
import { GuestStatusAlerts } from '@/components/guest/guest-status-alerts'
import { FormError } from '@/components/ui/form-error'
import { RealtimeReconnectBanner } from '@/components/realtime/reconnect-banner'
import { useRealtimeSubscription } from '@/components/realtime/use-realtime-subscription'
import { PhoneContactList } from '@/components/ui/phone-contact'
import { PortalBrand } from '@/components/brand/portal-brand'
import { HelpAssistant } from '@/components/help/help-assistant'
import type { GuestPortalContext } from '@/lib/data/guest-portal'
import type { StaffContact } from '@/lib/data/contacts'
import type { Complaint, ComplaintCategory, Guest } from '@/types'

type TabId = 'home' | 'stay' | 'messages' | 'help' | 'account'

const tabs: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
  { id: 'stay', label: 'My stay', icon: BedDouble },
  { id: 'help', label: 'Issues', icon: LifeBuoy },
  { id: 'account', label: 'Account', icon: User },
]

const REQUEST_SUCCESS_LABELS: Record<string, string> = {
  housekeeping: 'Housekeeping request sent — the front desk has been notified.',
  late_checkout: 'Late checkout request sent — we will confirm shortly.',
  extension: 'Stay extension request sent — we will confirm shortly.',
}

const categories: { id: ComplaintCategory; label: string; icon: typeof Droplets }[] = [
  { id: 'plumbing', label: 'Plumbing', icon: Droplets },
  { id: 'electrical', label: 'Electrical', icon: Zap },
  { id: 'hvac', label: 'HVAC', icon: Wind },
  { id: 'furniture', label: 'Furniture', icon: Armchair },
  { id: 'cleaning', label: 'Cleaning', icon: Sparkles },
  { id: 'noise', label: 'Noise', icon: Volume2 },
  { id: 'other', label: 'Other', icon: HelpCircle },
]

const REQUEST_LABELS: Record<string, string> = {
  housekeeping: 'Housekeeping',
  late_checkout: 'Late checkout',
  extension: 'Stay extension',
  self_checkout: 'Self check-out',
}

function PortalCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={`guest-portal-card ${className}`}>{children}</div>
}

function GuestContactPropertyCard({ contacts }: { contacts: StaffContact[] }) {
  if (contacts.length === 0) return null
  return (
    <PortalCard className="space-y-3">
      <PhoneContactList
        contacts={contacts}
        title="Contact property"
        emptyMessage=""
        variant="light"
      />
    </PortalCard>
  )
}

function GuestRoomCard({
  roomNumber,
  roomImageUrl,
}: {
  roomNumber: string | null
  roomImageUrl: string | null
}) {
  if (!roomNumber) return null
  return (
    <PortalCard className="flex items-center gap-3">
      {roomImageUrl ? (
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-[var(--guest-border-strong)]">
          <Image src={roomImageUrl} alt={`Room ${roomNumber}`} fill className="object-cover" sizes="64px" />
        </div>
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[var(--guest-accent-softer)] text-lg font-bold text-[var(--brand-purple)]">
          {roomNumber}
        </div>
      )}
      <div>
        <p className="guest-portal-card__title">Your room</p>
        <p className="text-sm guest-text-muted">Room {roomNumber}</p>
      </div>
    </PortalCard>
  )
}

interface GuestPortalProps {
  guest: Guest
  roomNumber: string | null
  propertyContacts: StaffContact[]
  context: GuestPortalContext
  initialTab?: string | null
}

function parseInitialTab(value?: string | null): TabId {
  if (value === 'home' || value === 'stay' || value === 'messages' || value === 'help' || value === 'account') {
    return value
  }
  return 'home'
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

function money(value: number) {
  return `GHS ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function GuestPortal({
  guest,
  roomNumber,
  propertyContacts,
  context,
  initialTab,
}: GuestPortalProps) {
  const [activeTab, setActiveTabState] = useState<TabId>(() => parseInitialTab(initialTab))
  const [staffMessageUnread, setStaffMessageUnread] = useState(false)
  const [dnd, setDnd] = useState(Boolean((guest as Guest & { do_not_disturb?: boolean }).do_not_disturb))
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [copiedWifi, setCopiedWifi] = useState(false)
  const [requestLoading, setRequestLoading] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null)
  const [requestNote, setRequestNote] = useState('')
  const [requestDate, setRequestDate] = useState('')
  const [requestTime, setRequestTime] = useState('')
  const [showRequestForm, setShowRequestForm] = useState<string | null>(null)
  const [emailReceiptLoading, setEmailReceiptLoading] = useState<string | null>(null)
  const [emailReceiptMessage, setEmailReceiptMessage] = useState<string | null>(null)

  const [category, setCategory] = useState<ComplaintCategory | null>(null)
  const [description, setDescription] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [complaintLoading, setComplaintLoading] = useState(false)
  const [complaintError, setComplaintError] = useState<string | null>(null)
  const [reference, setReference] = useState<string | null>(null)
  const [chatComplaintId, setChatComplaintId] = useState<string | null>(null)
  const [focusComplaintId, setFocusComplaintId] = useState<string | null>(null)
  const [focusSection, setFocusSection] = useState<GuestNextActionFocus | null>(null)

  const [rating, setRating] = useState(0)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackDone, setFeedbackDone] = useState(context.hasFeedback)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)

  const [receiptLoading, setReceiptLoading] = useState<string | null>(null)
  const [portalRequests, setPortalRequests] = useState(context.requests)

  const { property, rules, localGuide, invoices } = context
  const roomImageUrl = property.roomImageUrl

  const setActiveTab = useCallback((tab: TabId) => {
    setActiveTabState(tab)
    if (tab === 'messages') setStaffMessageUnread(false)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', tab)
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  const tabBadges = useMemo(() => {
    const pendingRequests = portalRequests.filter((r) => r.status === 'pending').length
    const openIssues = complaints.filter((c) => c.status !== 'resolved').length
    return {
      messages: staffMessageUnread ? 1 : 0,
      stay: pendingRequests,
      help: openIssues,
    } satisfies Partial<Record<TabId, number>>
  }, [portalRequests, complaints, staffMessageUnread])

  useEffect(() => {
    setActiveTabState(parseInitialTab(initialTab))
  }, [initialTab])

  useEffect(() => {
    setPortalRequests(context.requests)
  }, [context.requests])
  const propertyLine = [property.address, property.city, property.region].filter(Boolean).join(', ')

  const loadComplaints = useCallback(async () => {
    const result = await getGuestComplaints()
    if (result.success && result.data) setComplaints(result.data)
  }, [])

  const subscribeGuestComplaints = useCallback(
    (supabase: ReturnType<typeof createClient>, retryKey: number) =>
      supabase
        .channel(`guest-complaints-${guest.id}-${retryKey}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'complaints', filter: `guest_id=eq.${guest.id}` },
          () => {
            void loadComplaints()
          },
        ),
    [guest.id, loadComplaints],
  )

  const { showReconnectBanner, reconnect } = useRealtimeSubscription(subscribeGuestComplaints, [guest.id])

  useEffect(() => {
    void loadComplaints()
    const interval = setInterval(loadComplaints, 12000)
    return () => clearInterval(interval)
  }, [loadComplaints])

  async function toggleDnd() {
    const next = !dnd
    setDnd(next)
    const result = await setGuestDoNotDisturb(next)
    if (!result.success) {
      setDnd(!next)
      toast.error(result.error ?? 'Could not update Do Not Disturb.')
      return
    }
    toast.success(next ? 'Do Not Disturb is on' : 'Do Not Disturb is off')
  }

  async function handleRequest(type: string) {
    setRequestLoading(type)
    setRequestError(null)
    setRequestSuccess(null)
    const result = await submitGuestRequest({
      requestType: type,
      note: requestNote.trim() || undefined,
      requestedDate: type === 'extension' && requestDate ? requestDate : undefined,
      requestedTime: type === 'late_checkout' && requestTime ? requestTime : undefined,
    })
    setRequestLoading(null)
    if (!result.success) {
      setRequestError(result.error ?? null)
      return
    }
    setShowRequestForm(null)
    setRequestNote('')
    setRequestDate('')
    setRequestTime('')
    const bundle = await fetchGuestPortalBundle()
    if (bundle.success && bundle.data) {
      setPortalRequests(bundle.data.context.requests)
    }
    setRequestSuccess(
      REQUEST_SUCCESS_LABELS[type] ?? 'Request sent — the front desk has been notified.',
    )
    setActiveTab('stay')
  }

  async function handleComplaintSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!category) return
    setComplaintLoading(true)
    setComplaintError(null)
    const formData = new FormData()
    formData.set('category', category)
    formData.set('description', description)
    formData.set('priority', urgent ? 'urgent' : 'medium')
    if (photo) formData.set('photo', photo)
    const result = await submitGuestComplaintWithPhoto(formData)
    setComplaintLoading(false)
    if (!result.success) {
      setComplaintError(result.error)
      return
    }
    setReference(result.data?.reference ?? null)
    setDescription('')
    setCategory(null)
    setUrgent(false)
    setPhoto(null)
    void loadComplaints()
  }

  async function handleFeedback(e: React.FormEvent) {
    e.preventDefault()
    if (rating < 1) return
    setFeedbackLoading(true)
    setFeedbackError(null)
    const result = await submitGuestFeedback({ rating, comment: feedbackComment.trim() || undefined })
    setFeedbackLoading(false)
    if (!result.success) {
      setFeedbackError(result.error)
      return
    }
    setFeedbackDone(true)
  }

  async function emailReceipt(invoiceId: string) {
    setEmailReceiptLoading(invoiceId)
    setEmailReceiptMessage(null)
    const result = await emailGuestInvoiceReceiptAction(invoiceId)
    setEmailReceiptLoading(null)
    setEmailReceiptMessage(
      result.success ? 'Receipt sent to your email.' : (result.error ?? 'Could not send email.'),
    )
  }

  async function downloadReceipt(invoiceId: string) {
    setReceiptLoading(invoiceId)
    const result = await getGuestInvoiceReceiptExport(invoiceId)
    setReceiptLoading(null)
    if (!result.success || !result.data) return
    downloadInvoicePdf(result.data.hotel, result.data.invoice)
  }

  async function copyWifi() {
    const text = property.wifiPassword
      ? `Network: ${property.wifiSsid}\nPassword: ${property.wifiPassword}`
      : property.wifiSsid ?? ''
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopiedWifi(true)
    setTimeout(() => setCopiedWifi(false), 2000)
  }

  const openComplaints = useMemo(
    () => complaints.filter((c) => c.status !== 'resolved'),
    [complaints],
  )

  const primaryNextAction = useMemo(() => pickGuestNextAction(openComplaints), [openComplaints])

  function handleGuestNextStep(action: GuestNextAction) {
    setActiveTab('help')
    if (action.focus === 'chat') {
      setChatComplaintId(action.complaintId)
      return
    }
    setFocusComplaintId(action.complaintId)
    setFocusSection(action.focus)
  }

  function handleComplaintNextStep(complaintId: string, focus: GuestNextActionFocus) {
    if (focus === 'chat') {
      setChatComplaintId(complaintId)
      return
    }
    setFocusComplaintId(complaintId)
    setFocusSection(focus)
  }

  function clearComplaintFocus() {
    setFocusComplaintId(null)
    setFocusSection(null)
  }

  if (reference) {
    return (
      <div className="guest-portal-shell flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/12">
          <Check className="h-7 w-7 text-emerald-600" />
        </div>
        <p className="text-xl font-semibold">Issue reported</p>
        <p className="mt-2 font-mono text-sm text-[var(--brand-purple)]">Ref {reference}</p>
        <p className="mt-3 max-w-sm text-sm leading-relaxed guest-text-muted">
          Our team has been notified. Track progress under Help.
        </p>
        <button
          type="button"
          onClick={() => {
            setReference(null)
            setActiveTab('help')
          }}
          className="guest-btn guest-btn-primary mt-8 px-8 py-3 text-sm"
        >
          View in Help
        </button>
      </div>
    )
  }

  return (
    <div className="guest-portal-shell">
      {showReconnectBanner && (
        <RealtimeReconnectBanner onReconnect={reconnect} offset="guest-nav" />
      )}

      <header className={`guest-portal-header ${activeTab === 'messages' ? 'guest-portal-header--compact' : ''}`}>
        <div className="mx-auto max-w-md">
          <PortalBrand variant="guest" className="mb-3" />
          <div className="flex items-start gap-3.5">
            {property.imageUrl ? (
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl ring-1 ring-[var(--guest-border-strong)]">
                <Image src={property.imageUrl} alt={`${property.name} property photo`} fill className="object-cover" sizes="48px" />
              </div>
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-gold-light)] to-[var(--brand-gold)] text-base font-bold text-[var(--brand-purple-ink)] shadow-sm ring-1 ring-[var(--guest-gold-border)]">
                {property.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="guest-portal-header__title truncate text-lg font-semibold">{property.name}</p>
              <p className="guest-portal-header__greeting mt-0.5 text-sm">
                Hi <strong>{guest.name.split(' ')[0]}</strong>
                {roomNumber ? ` · Room ${roomNumber}` : ''}
              </p>
            </div>
            {roomNumber && roomImageUrl && (
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl ring-1 ring-[var(--guest-border-strong)]">
                <Image src={roomImageUrl} alt={`Room ${roomNumber}`} fill className="object-cover" sizes="48px" />
              </div>
            )}
          </div>
        </div>
        {property.welcome && activeTab === 'home' && (
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed guest-text-muted">{property.welcome}</p>
        )}
      </header>

      <main
        className={`guest-portal-main ${activeTab === 'messages' ? 'guest-portal-main--fill' : ''}`}
      >
        {(activeTab === 'home' || activeTab === 'stay' || activeTab === 'help') && (
          <GuestStatusAlerts
            complaints={complaints}
            requests={portalRequests}
            onOpenHelp={() => setActiveTab('help')}
            onOpenStay={() => setActiveTab('stay')}
          />
        )}
        {activeTab === 'home' && (
          <div
            role="tabpanel"
            id="guest-panel-home"
            aria-labelledby="guest-tab-home"
            className="guest-tab-panel"
          >
            <p className="guest-tab-intro">What you need right now — Wi‑Fi, checkout, and quick actions.</p>

            {guest.check_in && guest.check_out && (
              <div className="guest-checkout-strip">
                Check-out {formatShortDate(guest.check_out)} by {property.checkOutTime}
                {roomNumber ? ` · Room ${roomNumber}` : ''}
              </div>
            )}

            <div className="guest-action-list">
              <button
                type="button"
                onClick={() => {
                  setShowRequestForm('housekeeping')
                  setActiveTab('stay')
                }}
                className="guest-action-row guest-btn"
              >
                <span className="guest-action-row__icon">
                  <Sparkles className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="guest-action-row__label block">Request housekeeping</span>
                  <span className="guest-action-row__hint block">Opens in My stay</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 guest-text-subtle" />
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('help')}
                className="guest-action-row guest-btn"
              >
                <span className="guest-action-row__icon guest-action-row__icon--help">
                  <LifeBuoy className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="guest-action-row__label block">Report an issue</span>
                  <span className="guest-action-row__hint block">Maintenance or room problem</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 guest-text-subtle" />
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('messages')}
                className="guest-action-row guest-btn"
              >
                <span className="guest-action-row__icon guest-action-row__icon--messages">
                  <MessageCircle className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="guest-action-row__label block">Message the team</span>
                  <span className="guest-action-row__hint block">Opens in Messages</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 guest-text-subtle" />
              </button>
            </div>

            {primaryNextAction && (
              <GuestNextStepBanner action={primaryNextAction} onAction={handleGuestNextStep} />
            )}

            <GuestContactPropertyCard contacts={propertyContacts} />

            {(property.wifiSsid || property.parking || property.emergencyPhone) && (
              <PortalCard className="space-y-3">
                <p className="guest-portal-card__title">Essentials</p>
                {property.wifiSsid && (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-purple)]" />
                      <div>
                        <p className="text-sm font-medium">{property.wifiSsid}</p>
                        {property.wifiPassword && (
                          <p className="text-xs guest-text-subtle">Password: {property.wifiPassword}</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={copyWifi}
                      className="guest-icon-btn"
                      aria-label="Copy Wi-Fi details"
                    >
                      {copiedWifi ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                )}
                {property.parking && (
                  <div className="flex gap-3 guest-divider pt-3">
                    <Car className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-purple)]" />
                    <p className="text-sm guest-text-muted">{property.parking}</p>
                  </div>
                )}
                {property.emergencyPhone && (
                  <div className="flex gap-3 guest-divider pt-3">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <a href={`tel:${property.emergencyPhone}`} className="text-sm font-medium text-red-600">
                      Emergency · {property.emergencyPhone}
                    </a>
                  </div>
                )}
              </PortalCard>
            )}

            {propertyLine && (
              <PortalCard className="flex gap-3">
                <MapPin className="h-4 w-4 shrink-0 text-[var(--brand-gold-dark)]" />
                <p className="text-sm guest-text-muted">{propertyLine}</p>
              </PortalCard>
            )}
          </div>
        )}

        {activeTab === 'stay' && (
          <div
            role="tabpanel"
            id="guest-panel-stay"
            aria-labelledby="guest-tab-stay"
            className="guest-tab-panel"
          >
            <p className="guest-tab-intro">Your dates, requests, and billing for this stay.</p>

            <GuestRoomCard roomNumber={roomNumber} roomImageUrl={roomImageUrl} />

            {requestSuccess && (
              <div role="status" className="guest-checkout-strip guest-checkout-strip--success">
                {requestSuccess}
              </div>
            )}

            {guest.check_in && guest.check_out && (
              <GuestStayTimeline
                checkIn={guest.check_in}
                checkOut={guest.check_out}
                roomNumber={roomNumber}
                checkOutTime={property.checkOutTime}
              />
            )}

            <PortalCard>
              <p className="guest-portal-card__title">Requests</p>
              <p className="guest-portal-card__hint">
                Check-out by {property.checkOutTime}. Tap a request to notify the front desk.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(
                  [
                    { type: 'housekeeping', icon: Sparkles, label: 'Housekeeping' },
                    { type: 'late_checkout', icon: Clock, label: 'Late checkout' },
                    { type: 'extension', icon: CalendarPlus, label: 'Extend stay' },
                  ] as const
                ).map(({ type, icon: Icon, label }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setShowRequestForm(showRequestForm === type ? null : type)
                      setRequestSuccess(null)
                      setRequestError(null)
                    }}
                    className={`guest-request-btn guest-btn w-full ${
                      showRequestForm === type ? 'guest-request-btn--active' : ''
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-[var(--brand-gold-dark)]" />
                    {label}
                  </button>
                ))}
              </div>
              {showRequestForm && (
                <div className="mt-4 space-y-3 guest-divider pt-4">
                  {showRequestForm === 'extension' && (
                    <input
                      type="date"
                      value={requestDate}
                      onChange={(e) => setRequestDate(e.target.value)}
                      className="guest-field"
                    />
                  )}
                  {showRequestForm === 'late_checkout' && (
                    <input
                      type="text"
                      value={requestTime}
                      onChange={(e) => setRequestTime(e.target.value)}
                      placeholder="Preferred checkout time (e.g. 2:00 PM)"
                      className="guest-field"
                    />
                  )}
                  <textarea
                    value={requestNote}
                    onChange={(e) => setRequestNote(e.target.value)}
                    rows={2}
                    placeholder="Optional note for the front desk…"
                    className="guest-field"
                  />
                  {requestError && <FormError message={requestError} className="mt-2" />}
                  <button
                    type="button"
                    disabled={requestLoading === showRequestForm}
                    onClick={() => handleRequest(showRequestForm)}
                    className="guest-btn guest-btn-primary w-full py-3 text-sm disabled:opacity-50"
                  >
                    {requestLoading === showRequestForm ? 'Sending…' : 'Submit request'}
                  </button>
                </div>
              )}
            </PortalCard>

            {portalRequests.length > 0 && (
              <PortalCard className="space-y-2">
                <p className="guest-portal-card__title">Your requests</p>
                {portalRequests.slice(0, 5).map((req) => (
                  <div
                    key={req.id}
                    className="guest-inset-row flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <span className="guest-text-muted">
                      {REQUEST_LABELS[req.requestType] ?? req.requestType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs font-semibold uppercase text-[var(--brand-purple)]">
                      {req.status}
                    </span>
                  </div>
                ))}
              </PortalCard>
            )}

            <PortalCard className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--brand-gold-dark)]" />
                <p className="guest-portal-card__title">Billing</p>
              </div>
              {invoices.length === 0 ? (
                <p className="text-sm guest-text-muted">No invoices linked to your stay yet.</p>
              ) : (
                <ul className="space-y-2">
                  {invoices.map((inv) => (
                    <li
                      key={inv.id}
                      className="guest-inset-row flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {inv.invoiceNumber ?? 'Invoice'}
                        </p>
                        <p className="text-xs guest-text-subtle">
                          {money(inv.totalAmount)} · {inv.paymentStatus}
                        </p>
                      </div>
                      {inv.paymentStatus === 'paid' && (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => downloadReceipt(inv.id)}
                            disabled={receiptLoading === inv.id}
                            className="flex items-center gap-1 rounded-lg bg-emerald-500/12 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {receiptLoading === inv.id ? '…' : 'PDF'}
                          </button>
                          <button
                            type="button"
                            onClick={() => emailReceipt(inv.id)}
                            disabled={emailReceiptLoading === inv.id}
                            className="guest-btn guest-btn-ghost flex items-center gap-1 px-2.5 py-1.5 text-xs disabled:opacity-50"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            {emailReceiptLoading === inv.id ? '…' : 'Email'}
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs guest-text-subtle">Pay at the front desk — staff will record your payment.</p>
              {emailReceiptMessage && (
                <p className="text-xs text-[var(--brand-purple)]">{emailReceiptMessage}</p>
              )}
            </PortalCard>
          </div>
        )}

        {activeTab === 'messages' && (
          <div
            role="tabpanel"
            id="guest-panel-messages"
            aria-labelledby="guest-tab-messages"
            className="guest-tab-panel guest-tab-panel--fill"
          >
            <GuestStayChat
              variant="screen"
              propertyName={property.name}
              isActive={activeTab === 'messages'}
              onStaffMessages={(count, isActive) => {
                if (!isActive && count > 0) setStaffMessageUnread(true)
              }}
            />
          </div>
        )}

        {activeTab === 'help' && (
          <div
            role="tabpanel"
            id="guest-panel-help"
            aria-labelledby="guest-tab-help"
            className="guest-tab-panel"
          >
            <p className="guest-tab-intro">Track open maintenance issues or report something new.</p>

            {complaints.length > 0 && (
              <section className="mb-4 flex flex-col gap-3">
                <p className="guest-portal-card__title">Your issues</p>
                <ul className="flex flex-col gap-3">
                  {complaints.map((c) => (
                    <GuestComplaintCard
                      key={c.id}
                      complaint={c}
                      onUpdated={loadComplaints}
                      onOpenChat={() => setChatComplaintId(c.id)}
                      forceOpen={focusComplaintId === c.id}
                      focusSection={focusComplaintId === c.id ? focusSection : null}
                      onFocusHandled={clearComplaintFocus}
                      onNextStep={handleComplaintNextStep}
                    />
                  ))}
                </ul>
              </section>
            )}

            <form onSubmit={handleComplaintSubmit} className="flex flex-col gap-4">
              <PortalCard>
                <p className="guest-portal-card__title">Report an issue</p>
                <p className="guest-portal-card__hint">Pick a category, describe what happened, then send.</p>
                <div className="guest-category-grid mt-4">
                  {categories.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setCategory(id)}
                      className={`guest-category-chip guest-btn ${
                        category === id ? 'guest-category-chip--active' : ''
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  minLength={10}
                  rows={4}
                  placeholder="Describe the issue…"
                  className="guest-field mt-4"
                />
                <label className="guest-inset-row mt-3 flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm guest-text-muted">
                  <Camera className="h-4 w-4" />
                  {photo ? photo.name : 'Add photo (optional)'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                  />
                </label>
                <div className="mt-3 flex gap-2">
                  {(['Normal', 'Urgent'] as const).map((label) => {
                    const isUrgent = label === 'Urgent'
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setUrgent(isUrgent)}
                        className={`guest-toggle-btn guest-btn flex-1 py-2.5 text-sm ${
                          urgent === isUrgent
                            ? isUrgent
                              ? 'guest-btn-accent'
                              : 'guest-btn-primary'
                            : ''
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
                {complaintError && <FormError message={complaintError} className="mt-2" />}
                <button
                  type="submit"
                  disabled={complaintLoading || !category || description.length < 10}
                  className="guest-btn guest-btn-primary mt-4 w-full py-3 text-sm disabled:opacity-50"
                >
                  {complaintLoading ? 'Submitting…' : 'Submit issue'}
                </button>
              </PortalCard>
            </form>
          </div>
        )}

        {activeTab === 'account' && (
          <div
            role="tabpanel"
            id="guest-panel-account"
            aria-labelledby="guest-tab-account"
            className="guest-tab-panel guest-tab-panel--account"
          >
            <p className="guest-tab-intro">Your details, preferences, and property information.</p>

            <PortalCard>
              <div className="guest-account-dnd-row flex items-center justify-between gap-3">
                <div>
                  <p className="guest-portal-card__title">Do not disturb</p>
                  <p className="guest-portal-card__hint">
                    Staff will see a do-not-disturb flag on your room and call before entering.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleDnd}
                  className={`guest-btn flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                    dnd ? 'guest-btn-accent' : 'guest-btn-ghost'
                  }`}
                >
                  {dnd ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  {dnd ? 'On' : 'Off'}
                </button>
              </div>
            </PortalCard>

            <PortalCard>
              <ProfilePhotoUpload
                name={guest.name}
                imagePath={guest.profile_image_path}
                compact
                className="guest-portal-profile-photo"
                hint="Your photo appears in messages with the front desk and maintenance team."
                onUpload={async (formData) => {
                  const result = await uploadGuestProfilePhoto(formData)
                  if (result.success && result.data) {
                    return { success: true, imageUrl: result.data.imageUrl }
                  }
                  return { success: false, error: !result.success ? result.error : undefined }
                }}
                onClear={async () => {
                  const result = await clearGuestProfilePhoto()
                  return { success: result.success, error: !result.success ? result.error : undefined }
                }}
              />
            </PortalCard>

            <PortalCard>
              <p className="guest-portal-card__title mb-3">Your phone</p>
              <GuestPhoneEditor initialPhone={guest.phone} />
            </PortalCard>

            {!feedbackDone ? (
              <PortalCard>
                <p className="guest-portal-card__title">How was your stay?</p>
                <form onSubmit={handleFeedback} className="mt-4 space-y-4">
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(n)}
                        className="p-1"
                        aria-label={`Rate ${n} stars`}
                      >
                        <Star
                          className={`h-8 w-8 ${
                            n <= rating ? 'fill-[var(--brand-gold)] text-[var(--brand-gold)]' : 'text-[var(--guest-border-strong)]'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    rows={3}
                    placeholder="Tell us more (optional)…"
                    className="guest-field"
                  />
                  {feedbackError && <FormError message={feedbackError} className="mt-2" />}
                  <button
                    type="submit"
                    disabled={feedbackLoading || rating < 1}
                    className="guest-btn guest-btn-primary w-full py-3 text-sm disabled:opacity-50"
                  >
                    {feedbackLoading ? 'Saving…' : 'Submit feedback'}
                  </button>
                </form>
              </PortalCard>
            ) : (
              <PortalCard className="text-center">
                <Star className="mx-auto h-8 w-8 fill-[var(--brand-gold)] text-[var(--brand-gold)]" />
                <p className="mt-2 text-sm font-medium">Thanks for your feedback</p>
              </PortalCard>
            )}

            {propertyContacts.length > 0 && (
              <GuestContactPropertyCard contacts={propertyContacts} />
            )}

            {localGuide.length > 0 && (
              <PortalCard className="space-y-3">
                <p className="guest-portal-card__title">Local guide</p>
                {localGuide.map((item) => (
                  <div key={item.id} className="guest-divider pt-3 first:border-0 first:pt-0">
                    <p className="text-sm font-medium text-[var(--brand-purple)]">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed guest-text-muted">{item.body}</p>
                  </div>
                ))}
              </PortalCard>
            )}

            {rules.length > 0 && (
              <PortalCard className="space-y-2">
                <p className="guest-portal-card__title">Property rules</p>
                <ol className="space-y-2 text-sm leading-relaxed guest-text-muted">
                  {rules.map((rule, i) => (
                    <li key={rule.id}>
                      <span className="mr-2 font-semibold text-[var(--brand-gold-dark)]">{i + 1}.</span>
                      {rule.ruleText}
                    </li>
                  ))}
                </ol>
              </PortalCard>
            )}

            <div className="flex justify-center gap-3 pt-1 text-xs guest-text-subtle">
              <Link href="/privacy" className="hover:text-[var(--brand-purple)] hover:underline">
                Privacy
              </Link>
              <span aria-hidden="true">·</span>
              <Link href="/terms" className="hover:text-[var(--brand-purple)] hover:underline">
                Terms
              </Link>
            </div>
          </div>
        )}
      </main>

      <nav
        className="guest-portal-nav fixed bottom-0 left-0 right-0 z-20 px-2"
        role="tablist"
        aria-label="Guest portal sections"
      >
        <div className="mx-auto flex max-w-md justify-around gap-0.5">
          {tabs.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id
            const badge = (tabBadges as Partial<Record<TabId, number>>)[id] ?? 0
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`guest-tab-${id}`}
                aria-selected={active}
                aria-controls={`guest-panel-${id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setActiveTab(id)}
                className={`guest-tab-btn relative flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-semibold ${
                  active ? '' : 'guest-text-subtle'
                }`}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {badge > 0 && (
                    <span className="guest-tab-badge" aria-label={`${badge} update${badge === 1 ? '' : 's'}`}>
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                {label}
              </button>
            )
          })}
        </div>
      </nav>

      {chatComplaintId && (
        <div className="guest-chat-overlay fixed inset-0 z-30 flex flex-col">
          <div className="flex items-center justify-between border-b border-[var(--guest-border)] bg-[var(--guest-bg-elevated)] px-4 py-3.5">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-[var(--brand-purple)]" />
              <p className="font-semibold">Message staff</p>
            </div>
            <button
              type="button"
              onClick={() => setChatComplaintId(null)}
              className="guest-btn guest-btn-ghost rounded-lg px-3 py-1.5 text-sm"
            >
              Close
            </button>
          </div>
          <GuestComplaintChat complaintId={chatComplaintId} />
        </div>
      )}

      <HelpAssistant role="guest" bottomOffset="guest" />
    </div>
  )
}
