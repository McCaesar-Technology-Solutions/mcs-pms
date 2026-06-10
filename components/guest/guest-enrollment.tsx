'use client'

import { useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CenteredModal, ModalBody, ModalHeader } from '@/components/ui/centered-modal'
import { enrollGuest, getEnrollmentRooms } from '@/app/actions/guest'

interface Stay {
  roomId: string
  checkIn: string
  checkOut: string
}

export function GuestEnrollment() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [roomId, setRoomId] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [rooms, setRooms] = useState<{ id: string; number: string }[]>([])
  const [stays, setStays] = useState<Stay[]>([])
  const [loginUrl, setLoginUrl] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const datesValid = !!checkIn && !!checkOut && checkOut > checkIn

  const occupiedRoomIds = useMemo(() => {
    const set = new Set<string>()
    if (!datesValid) return set
    for (const s of stays) {
      if (s.checkIn < checkOut && s.checkOut > checkIn) set.add(s.roomId)
    }
    return set
  }, [stays, checkIn, checkOut, datesValid])

  const selectedRoomClashes = datesValid && !!roomId && occupiedRoomIds.has(roomId)
  const suggestions = useMemo(
    () => rooms.filter((r) => !occupiedRoomIds.has(r.id)).slice(0, 5),
    [rooms, occupiedRoomIds],
  )

  async function openModal() {
    setOpen(true)
    setStep(1)
    setError(null)
    const result = await getEnrollmentRooms()
    if (result.success && result.data) {
      setRooms(result.data.rooms)
      setStays(result.data.stays)
    }
  }

  async function handleEnroll() {
    setLoading(true)
    setError(null)
    const result = await enrollGuest({ name, phone, email, roomId, checkIn, checkOut })
    setLoading(false)
    if (!result.success) {
      setError('error' in result ? result.error : 'Enrollment failed')
      return
    }
    if (!result.data) return
    // Build the link from the actual origin the staff member is on, so it
    // works regardless of NEXT_PUBLIC_APP_URL being set on the deployment.
    const url = `${window.location.origin}/guest/enter?token=${result.data.token}`
    setLoginUrl(url)
    const qr = await QRCode.toDataURL(url)
    setQrDataUrl(qr)
    setStep(3)
  }

  function downloadQr() {
    const link = document.createElement('a')
    link.href = qrDataUrl
    link.download = `mojo-guest-${name.replace(/\s+/g, '-').toLowerCase()}.png`
    link.click()
  }

  return (
    <>
      <Button onClick={openModal} className="bg-[#3C216C] text-white">
        Enroll Guest
      </Button>

      <CenteredModal open={open} onClose={() => setOpen(false)} className="max-w-md" aria-label="Enroll Guest">
        <ModalHeader onClose={() => setOpen(false)}>
          <h3 className="text-lg font-semibold">Enroll Guest</h3>
          <p className="modal-panel-subtle text-sm">Step {step} of 3</p>
        </ModalHeader>
        <ModalBody>
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Phone (optional)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email (optional)</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button onClick={() => setStep(2)} disabled={!name.trim()} className="w-full">
              Next
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Check-in</Label>
                <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Check-out</Label>
                <Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Room</Label>
              <select
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="">Select room</option>
                {rooms.map((r) => {
                  const booked = occupiedRoomIds.has(r.id)
                  return (
                    <option key={r.id} value={r.id} disabled={booked}>
                      {r.number}
                      {booked ? ' · occupied these dates' : ''}
                    </option>
                  )
                })}
              </select>
            </div>
            {selectedRoomClashes && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-medium">That room is occupied for these dates.</p>
                {suggestions.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {suggestions.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRoomId(r.id)}
                        className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                      >
                        {r.number}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs">No other rooms are free for these dates.</p>
                )}
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              onClick={handleEnroll}
              disabled={loading || !roomId || !datesValid || selectedRoomClashes}
              className="w-full bg-[#3C216C] text-white"
            >
              {loading ? 'Generating…' : 'Generate access link'}
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-center">
            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="Guest portal QR code" className="mx-auto h-48 w-48" />
            )}
            <p className="break-all text-xs text-muted-foreground">{loginUrl}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => navigator.clipboard.writeText(loginUrl)}
                className="flex-1"
              >
                Copy link
              </Button>
              <Button variant="outline" onClick={downloadQr} className="flex-1">
                Download QR
              </Button>
              <Button variant="outline" onClick={() => window.print()} className="flex-1">
                Print
              </Button>
            </div>
          </div>
        )}
        </ModalBody>
      </CenteredModal>
    </>
  )
}
