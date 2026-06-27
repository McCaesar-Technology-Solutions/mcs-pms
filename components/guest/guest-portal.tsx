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
import { GuestStayTimeline } from '@/components/guest/guest-stay-timeline'
import { GuestComplaintCard } from '@/components/guest/guest-complaint-card'
import { GuestNextStepBanner } from '@/components/guest/guest-next-step-banner'
import { guestComplaintReference } from '@/lib/complaints/guest-progress'
import { pickGuestNextAction } from '@/lib/complaints/guest-next-action'
import type { GuestNextAction, GuestNextActionFocus } from '@/lib/complaints/guest-next-action'
import { guestStatusLabel } from '@/components/complaints/complaints-overview'
import { GuestComplaintChat } from '@/components/guest/guest-complaint-chat'
import { GuestStayChat } from '@/components/guest/guest-stay-chat'
import { GuestStatusAlerts } from '@/components/guest/guest-status-alerts'
import { FormError } from '@/components/ui/form-error'
import { RealtimeReconnectBanner } from '@/components/realtime/reconnect-banner'
import { PhoneContactList } from '@/components/ui/phone-contact'
import type { GuestPortalContext } from '@/lib/data/guest-portal'
import type { StaffContact } from '@/lib/data/contacts'
import type { Complaint, ComplaintCategory, Guest } from '@/types'

type TabId = 'home' | 'stay' | 'help' | 'account'

const tabs: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'stay', label: 'Stay', icon: BedDouble },
  { id: 'help', label: 'Help', icon: LifeBuoy },
  { id: 'account', label: 'You', icon: User },
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
  self_checkout: 'Self check-out', // legacy requests only
}

interface GuestPortalProps {
  guest: Guest
  roomNumber: string | null
  propertyContacts: StaffContact[]
  context: GuestPortalContext
}

function PortalCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl border border-white/12 bg-white/[0.08] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.18)] backdrop-blur-md transition hover:border-[var(--brand-gold)]/22 hover:bg-white/[0.1] ${className}`}
    >
      {children}
    </div>
  )
}

function money(value: number) {
  return `GHS ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function GuestPortal({
  guest,
  roomNumber,
  propertyContacts,
  context,
}: GuestPortalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [dnd, setDnd] = useState(Boolean((guest as Guest & { do_not_disturb?: boolean }).do_not_disturb))
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [disconnected, setDisconnected] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
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

  useEffect(() => {
    setPortalRequests(context.requests)
  }, [context.requests])
  const propertyLine = [property.address, property.city, property.region].filter(Boolean).join(', ')

  const loadComplaints = useCallback(async () => {
    const result = await getGuestComplaints()
    if (result.success && result.data) setComplaints(result.data)
  }, [])

  useEffect(() => {
    loadComplaints()
    const interval = setInterval(loadComplaints, 12000)
    return () => clearInterval(interval)
  }, [loadComplaints])

  useEffect(() => {
    const supabase = createClient()
    let backoff = 1000
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const channel = supabase
      .channel(`guest-complaints-${guest.id}-${retryKey}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'complaints', filter: `guest_id=eq.${guest.id}` },
        () => loadComplaints(),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          backoff = 1000
          setDisconnected(false)
        }
        if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          setDisconnected(true)
          retryTimer = setTimeout(() => setRetryKey((k) => k + 1), backoff)
          backoff = Math.min(backoff * 2, 8000)
        }
      })

    return () => {
      if (retryTimer) clearTimeout(retryTimer)
      supabase.removeChannel(channel)
    }
  }, [guest.id, loadComplaints, retryKey])

  async function toggleDnd() {
    const next = !dnd
    setDnd(next)
    const result = await setGuestDoNotDisturb(next)
    if (!result.success) setDnd(!next)
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
    setFocusComplaintId(action.complaintId)
    setFocusSection(action.focus)
    if (action.focus === 'chat') {
      setChatComplaintId(action.complaintId)
    }
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
      <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-[#1a0f3d] via-[#22124C] to-[#2d1860] px-6 text-center text-white">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
          <Check className="h-8 w-8 text-emerald-300" />
        </div>
        <p className="text-2xl font-semibold">Issue reported</p>
        <p className="mt-2 text-[#D4A62E]">Ref {reference}</p>
        <p className="mt-4 max-w-sm text-sm text-white/70">
          Our team has been notified and will respond shortly. You can track progress under Help.
        </p>
        <button
          type="button"
          onClick={() => {
            setReference(null)
            setActiveTab('help')
          }}
          className="mt-8 rounded-2xl bg-white/10 px-8 py-3.5 font-medium backdrop-blur transition hover:bg-white/15"
        >
          Back to portal
        </button>
      </div>
    )
  }

  return (
    <div className="guest-portal-shell relative min-h-dvh bg-gradient-to-b from-[var(--brand-purple-deep)] via-[var(--brand-purple-ink)] to-[#12082a] text-white">
      {disconnected && (
        <RealtimeReconnectBanner
          onReconnect={() => setRetryKey((k) => k + 1)}
          offset="guest-nav"
        />
      )}

      <header className="guest-portal-header">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--brand-gold)]/12 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 top-24 h-32 w-32 rounded-full bg-[var(--brand-purple)]/20 blur-2xl" />
        <div className="relative flex items-start gap-4">
          {property.imageUrl ? (
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl ring-2 ring-white/20">
              <Image src={property.imageUrl} alt={`${property.name} property photo`} fill className="object-cover" sizes="56px" />
            </div>
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#D4A62E]/20 text-lg font-bold text-[#D4A62E]">
              {property.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-2xl font-semibold text-[var(--brand-gold)]">
              {property.name}
            </p>
            <p className="mt-0.5 text-sm text-white/80">
              Hi {guest.name.split(' ')[0]}
              {roomNumber ? ` · Room ${roomNumber}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleDnd}
            className={`guest-btn flex shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-semibold tracking-wide transition ${
              dnd ? 'bg-[var(--brand-orange)]/25 text-[var(--brand-orange-light)]' : 'bg-white/10 text-white/70'
            }`}
          >
            {dnd ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            {dnd ? 'DND on' : 'DND off'}
          </button>
        </div>
        {property.welcome && activeTab === 'home' && (
          <p className="relative mt-5 text-sm leading-relaxed text-white/75">{property.welcome}</p>
        )}
      </header>

      <main className="guest-portal-main">
        <GuestStatusAlerts
          complaints={complaints}
          requests={portalRequests}
          onOpenHelp={() => setActiveTab('help')}
        />
        {activeTab === 'home' && (
          <div
            role="tabpanel"
            id="guest-panel-home"
            aria-labelledby="guest-tab-home"
            className="guest-tab-panel"
          >
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowRequestForm('housekeeping')
                  setActiveTab('stay')
                }}
                className="guest-quick-card guest-btn flex flex-col items-start gap-2 rounded-2xl bg-gradient-to-br from-[var(--brand-purple)] to-[var(--brand-purple-deep)] p-5 text-left shadow-lg"
              >
                <Sparkles className="h-5 w-5 text-[var(--brand-gold)]" />
                <span className="text-sm font-semibold">Housekeeping</span>
                <span className="text-xs text-white/60">Request a clean</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('help')}
                className="guest-quick-card guest-btn flex flex-col items-start gap-2 rounded-2xl bg-gradient-to-br from-[var(--brand-orange)]/90 to-[#a84320] p-5 text-left shadow-lg"
              >
                <LifeBuoy className="h-5 w-5 text-white" />
                <span className="text-sm font-semibold">Report issue</span>
                <span className="text-xs text-white/80">Maintenance help</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('stay')}
              className="guest-btn guest-quick-card flex w-full items-center gap-3 rounded-2xl border border-[var(--brand-gold)]/30 bg-[var(--brand-gold)]/10 p-4 text-left transition hover:border-[var(--brand-gold)]/45 hover:bg-[var(--brand-gold)]/14"
            >
              <MessageCircle className="h-5 w-5 shrink-0 text-[var(--brand-gold)]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Message the team</p>
                <p className="text-xs text-white/60">Chat with the front desk about your stay</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/50" />
            </button>

            {primaryNextAction && (
              <GuestNextStepBanner action={primaryNextAction} onAction={handleGuestNextStep} />
            )}

            {(property.wifiSsid || property.parking || property.emergencyPhone) && (
              <PortalCard className="space-y-3">
                <p className="label-eyebrow label-eyebrow-accent">Essentials</p>
                {property.wifiSsid && (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-white/60" />
                      <div>
                        <p className="text-sm font-medium">{property.wifiSsid}</p>
                        {property.wifiPassword && (
                          <p className="text-xs text-white/55">Password: {property.wifiPassword}</p>
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
                        <Check className="h-4 w-4 text-emerald-300" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                )}
                {property.parking && (
                  <div className="flex gap-3 border-t border-white/10 pt-3">
                    <Car className="mt-0.5 h-4 w-4 shrink-0 text-white/60" />
                    <p className="text-sm text-white/80">{property.parking}</p>
                  </div>
                )}
                {property.emergencyPhone && (
                  <div className="flex gap-3 border-t border-white/10 pt-3">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                    <a href={`tel:${property.emergencyPhone}`} className="text-sm font-medium text-red-200">
                      Emergency · {property.emergencyPhone}
                    </a>
                  </div>
                )}
              </PortalCard>
            )}

            {propertyLine && (
              <PortalCard className="flex gap-3">
                <MapPin className="h-4 w-4 shrink-0 text-[#D4A62E]" />
                <p className="text-sm text-white/75">{propertyLine}</p>
              </PortalCard>
            )}

            {openComplaints.length > 1 && (
              <PortalCard>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">More open issues</p>
                  <span className="rounded-md bg-[var(--brand-orange)]/20 px-2 py-0.5 text-xs font-bold text-[var(--brand-orange-light)]">
                    {openComplaints.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('help')}
                  className="mt-3 flex w-full items-center justify-between text-sm text-white/70"
                >
                  View all issues
                  <ChevronRight className="h-4 w-4" />
                </button>
              </PortalCard>
            )}

            {openComplaints.length === 1 && !primaryNextAction && (
              <PortalCard>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Open issues</p>
                  <span className="rounded-md bg-[var(--brand-orange)]/20 px-2 py-0.5 text-xs font-bold text-[var(--brand-orange-light)]">
                    {openComplaints.length}
                  </span>
                </div>
                {openComplaints[0] && (
                  <div className="mt-3 rounded-xl bg-white/5 px-3 py-2.5">
                    <p className="text-sm font-medium capitalize text-white">
                      {openComplaints[0].category}
                      <span className="ml-2 font-mono text-[10px] text-white/50">
                        {guestComplaintReference(openComplaints[0].id)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-[#D4A62E]">
                      {guestStatusLabel(
                        openComplaints[0].status,
                        openComplaints[0].approval_stage,
                      )}
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('help')}
                  className="mt-3 flex w-full items-center justify-between text-sm text-white/70"
                >
                  View progress &amp; message staff
                  <ChevronRight className="h-4 w-4" />
                </button>
              </PortalCard>
            )}

            {propertyContacts.length > 0 && (
              <PortalCard className="space-y-3">
                <PhoneContactList
                  contacts={propertyContacts}
                  title="Contact manager"
                  emptyMessage=""
                  variant="dark"
                />
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
            {requestSuccess && (
              <div
                role="status"
                className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100"
              >
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

            <GuestStayChat />

            <PortalCard>
              <p className="label-eyebrow label-eyebrow-accent">Requests</p>
              <p className="mt-1 text-xs text-white/55">
                Check-out by {property.checkOutTime}. Tap to notify the front desk.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
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
                    className={`guest-btn flex items-center gap-2 rounded-xl px-3 py-3 text-left text-sm transition ${
                      showRequestForm === type
                        ? 'bg-[var(--brand-gold)]/20 ring-1 ring-[var(--brand-gold)]/50'
                        : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-[#D4A62E]" />
                    {label}
                  </button>
                ))}
              </div>
              {showRequestForm && (
                <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                  {showRequestForm === 'extension' && (
                    <input
                      type="date"
                      value={requestDate}
                      onChange={(e) => setRequestDate(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
                    />
                  )}
                  {showRequestForm === 'late_checkout' && (
                    <input
                      type="text"
                      value={requestTime}
                      onChange={(e) => setRequestTime(e.target.value)}
                      placeholder="Preferred checkout time (e.g. 2:00 PM)"
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm placeholder:text-white/35"
                    />
                  )}
                  <textarea
                    value={requestNote}
                    onChange={(e) => setRequestNote(e.target.value)}
                    rows={2}
                    placeholder="Optional note for the front desk…"
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm placeholder:text-white/35"
                  />
                  {requestError && <FormError message={requestError} variant="dark" />}
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
                <p className="text-sm font-semibold">Your requests</p>
                {portalRequests.slice(0, 5).map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm"
                  >
                    <span className="capitalize text-white/80">
                      {req.requestType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs font-semibold uppercase text-[#D4A62E]">
                      {req.status}
                    </span>
                  </div>
                ))}
              </PortalCard>
            )}

            <PortalCard className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#D4A62E]" />
                <p className="text-sm font-semibold">Billing</p>
              </div>
              {invoices.length === 0 ? (
                <p className="text-sm text-white/55">No invoices linked to your stay yet.</p>
              ) : (
                <ul className="space-y-2">
                  {invoices.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {inv.invoiceNumber ?? 'Invoice'}
                        </p>
                        <p className="text-xs text-white/55">
                          {money(inv.totalAmount)} · {inv.paymentStatus}
                        </p>
                      </div>
                      {inv.paymentStatus === 'paid' && (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => downloadReceipt(inv.id)}
                            disabled={receiptLoading === inv.id}
                            className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 disabled:opacity-50"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {receiptLoading === inv.id ? '…' : 'PDF'}
                          </button>
                          <button
                            type="button"
                            onClick={() => emailReceipt(inv.id)}
                            disabled={emailReceiptLoading === inv.id}
                            className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white/80 disabled:opacity-50"
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
              <p className="text-xs text-white/45">Pay at the front desk — staff will record your payment.</p>
              {emailReceiptMessage && (
                <p className="text-xs text-[#D4A62E]">{emailReceiptMessage}</p>
              )}
            </PortalCard>
          </div>
        )}

        {activeTab === 'help' && (
          <div
            role="tabpanel"
            id="guest-panel-help"
            aria-labelledby="guest-tab-help"
            className="guest-tab-panel"
          >
            <form onSubmit={handleComplaintSubmit} className="flex flex-col gap-5">
              <PortalCard>
                <p className="text-sm font-semibold">Report an issue</p>
                <p className="mt-1 text-xs text-white/55">Add a photo to help our team diagnose faster.</p>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {categories.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setCategory(id)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl p-2.5 text-[10px] transition ${
                        category === id
                          ? 'bg-[#D4A62E]/20 ring-1 ring-[#D4A62E]'
                          : 'bg-white/5'
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
                  className="mt-4 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm placeholder:text-white/35"
                />
                <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white/70">
                  <Camera className="h-4 w-4" />
                  {photo ? photo.name : 'Attach photo (optional)'}
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
                        className={`guest-btn flex-1 rounded-xl py-2.5 text-sm font-semibold ${
                          urgent === isUrgent
                            ? isUrgent
                              ? 'guest-btn-accent'
                              : 'guest-btn-primary'
                            : 'bg-white/5 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
                {complaintError && <FormError message={complaintError} variant="dark" className="mt-2" />}
                <button
                  type="submit"
                  disabled={complaintLoading || !category || description.length < 10}
                  className="guest-btn guest-btn-accent mt-4 w-full py-3.5 text-sm disabled:opacity-50"
                >
                  {complaintLoading ? 'Submitting…' : 'Submit issue'}
                </button>
              </PortalCard>
            </form>

            {complaints.length > 0 && (
              <section className="flex flex-col gap-3">
                <p className="text-sm font-semibold">My issues</p>
                <ul className="flex flex-col gap-3">
                  {complaints.map((c) => (
                    <GuestComplaintCard
                      key={c.id}
                      complaint={c}
                      onUpdated={loadComplaints}
                      onOpenChat={() => setChatComplaintId(c.id)}
                      forceExpanded={focusComplaintId === c.id}
                      focusSection={focusComplaintId === c.id ? focusSection : null}
                      onFocusHandled={clearComplaintFocus}
                      onNextStep={handleComplaintNextStep}
                    />
                  ))}
                </ul>
              </section>
            )}

            {localGuide.length > 0 && (
              <PortalCard className="space-y-3">
                <p className="text-sm font-semibold">Local guide</p>
                {localGuide.map((item) => (
                  <div key={item.id} className="border-t border-white/10 pt-3 first:border-0 first:pt-0">
                    <p className="text-sm font-medium text-[#D4A62E]">{item.title}</p>
                    <p className="mt-1 text-sm text-white/70">{item.body}</p>
                  </div>
                ))}
              </PortalCard>
            )}

            {rules.length > 0 && (
              <PortalCard className="space-y-2">
                <p className="text-sm font-semibold">Property rules</p>
                <ol className="space-y-2 text-sm text-white/70">
                  {rules.map((rule, i) => (
                    <li key={rule.id}>
                      <span className="mr-2 font-semibold text-[#D4A62E]">{i + 1}.</span>
                      {rule.ruleText}
                    </li>
                  ))}
                </ol>
              </PortalCard>
            )}
          </div>
        )}

        {activeTab === 'account' && (
          <div
            role="tabpanel"
            id="guest-panel-account"
            aria-labelledby="guest-tab-account"
            className="guest-tab-panel"
          >
            <PortalCard>
              <p className="mb-3 text-sm font-semibold">Your phone</p>
              <GuestPhoneEditor initialPhone={guest.phone} />
            </PortalCard>

            {!feedbackDone ? (
              <PortalCard>
                <p className="text-sm font-semibold">How was your stay?</p>
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
                            n <= rating ? 'fill-[#D4A62E] text-[#D4A62E]' : 'text-white/25'
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
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm placeholder:text-white/35"
                  />
                  {feedbackError && <FormError message={feedbackError} variant="dark" />}
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
                <Star className="mx-auto h-8 w-8 fill-[#D4A62E] text-[#D4A62E]" />
                <p className="mt-2 text-sm font-medium">Thanks for your feedback</p>
              </PortalCard>
            )}
          </div>
        )}
      </main>

      <div className="fixed bottom-[4.75rem] left-0 right-0 z-10 flex justify-center gap-3 px-4 pb-1 text-[10px] text-white/35">
        <Link href="/privacy" className="hover:text-white/60 hover:underline">
          Privacy
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/terms" className="hover:text-white/60 hover:underline">
          Terms
        </Link>
      </div>

      <nav
        className="guest-portal-nav fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-[#12082a]/90 px-3 backdrop-blur-xl"
        role="tablist"
        aria-label="Guest portal sections"
      >
        <div className="mx-auto flex max-w-lg justify-around gap-1">
          {tabs.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id
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
                className={`guest-tab-btn flex flex-1 flex-col items-center gap-1.5 rounded-xl py-2.5 text-[10px] font-semibold ${
                  active ? 'text-[var(--brand-gold)]' : 'text-white/45'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? 'scale-110' : ''}`} />
                {label}
              </button>
            )
          })}
        </div>
      </nav>

      {chatComplaintId && (
        <div className="fixed inset-0 z-30 flex flex-col bg-[#12082a]/95 backdrop-blur">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-[#D4A62E]" />
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
    </div>
  )
}
