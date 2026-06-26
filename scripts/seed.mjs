/**
 * Run after applying migrations: node scripts/seed.mjs
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function loadEnv() {
  try {
    const envFile = readFileSync(join(root, '.env.local'), 'utf8')
    for (const line of envFile.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq)
      const value = trimmed.slice(eq + 1).replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // .env.local optional if vars exported
  }
}

loadEnv()

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run seed in production. Use a development environment only.')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

if (!url || !serviceKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const accounts = [
  { email: 'owner@mojo.gh', password: 'password123', role: 'owner', name: 'Kofi Mensah', specialty: null },
  { email: 'manager@mojo.gh', password: 'password123', role: 'manager', name: 'Ama Owusu', specialty: null },
  { email: 'tech1@mojo.gh', password: 'password123', role: 'technician', name: 'Kwame Asante', specialty: 'Plumbing' },
  { email: 'tech2@mojo.gh', password: 'password123', role: 'technician', name: 'Adjoa Boateng', specialty: 'Electrical' },
  { email: 'tech3@mojo.gh', password: 'password123', role: 'technician', name: 'Yaw Darko', specialty: 'HVAC' },
]

async function main() {
  const { data: existingHotel } = await admin.from('hotels').select('id').eq('name', 'MOJO APARTMENTS').maybeSingle()
  let hotelId = existingHotel?.id

  if (!hotelId) {
    const { data: hotel, error } = await admin
      .from('hotels')
      .insert({
        name: 'MOJO APARTMENTS',
        address: '14 Independence Ave, Accra, Ghana',
        vat_registration_number: 'VATGH-10042',
      })
      .select('id')
      .single()
    if (error) throw error
    hotelId = hotel.id
  }

  const profileIds = {}

  for (const account of accounts) {
    const { data: list } = await admin.auth.admin.listUsers()
    let userId = list?.users?.find((u) => u.email === account.email)?.id

    if (!userId) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
      })
      if (error) throw error
      userId = created.user.id
    }

    profileIds[account.email] = userId

    await admin.from('profiles').upsert({
      id: userId,
      hotel_id: hotelId,
      role: account.role,
      name: account.name,
      email: account.email,
      specialty: account.specialty,
      is_active: true,
    })
  }

  const { count: roomCount } = await admin
    .from('rooms')
    .select('*', { count: 'exact', head: true })
    .eq('hotel_id', hotelId)

  if ((roomCount ?? 0) === 0) {
    const rooms = []
    for (let i = 101; i <= 110; i++) rooms.push({ hotel_id: hotelId, number: String(i), floor: 1, type: 'standard', status: i % 3 === 0 ? 'occupied' : 'available' })
    for (let i = 201; i <= 210; i++) rooms.push({ hotel_id: hotelId, number: String(i), floor: 2, type: 'deluxe', status: i % 4 === 0 ? 'maintenance' : 'available' })
    for (let i = 301; i <= 306; i++) rooms.push({ hotel_id: hotelId, number: String(i), floor: 3, type: 'suite', status: 'available' })
    for (let i = 307; i <= 310; i++) rooms.push({ hotel_id: hotelId, number: String(i), floor: 3, type: 'deluxe', status: i % 2 === 0 ? 'cleaning' : 'available' })
    await admin.from('rooms').insert(rooms)
  }

  const { data: rooms } = await admin.from('rooms').select('id, number').eq('hotel_id', hotelId).order('number')

  const { count: guestCount } = await admin.from('guests').select('*', { count: 'exact', head: true }).eq('hotel_id', hotelId)
  const guests = []

  if ((guestCount ?? 0) < 10 && rooms?.length) {
    for (let i = 0; i < 10; i++) {
      const room = rooms[i % rooms.length]
      const checkOut = new Date()
      checkOut.setDate(checkOut.getDate() + 7 + i)
      guests.push({
        hotel_id: hotelId,
        room_id: room.id,
        name: `Guest ${i + 1}`,
        email: `guest${i + 1}@example.com`,
        phone: `+2332000000${i}`,
        check_in: new Date().toISOString().slice(0, 10),
        check_out: checkOut.toISOString().slice(0, 10),
        token_expires_at: checkOut.toISOString(),
        enrolled_by: profileIds['manager@mojo.gh'],
      })
    }
    await admin.from('guests').insert(guests)
  }

  const { data: seededGuests } = await admin.from('guests').select('id, token, name, room_id').eq('hotel_id', hotelId).limit(10)

  const { count: resCount } = await admin.from('reservations').select('*', { count: 'exact', head: true }).eq('hotel_id', hotelId)
  if ((resCount ?? 0) < 5 && rooms?.length && seededGuests?.length) {
    const channels = ['airbnb', 'booking_com', 'direct', 'walk_in', 'other']
    const statuses = ['confirmed', 'checked_in', 'checked_out', 'cancelled']
    const reservations = []
    for (let i = 0; i < 20; i++) {
      const guest = seededGuests[i % seededGuests.length]
      const room = rooms[(i + 3) % rooms.length]
      const checkIn = new Date()
      checkIn.setDate(checkIn.getDate() - i)
      const checkOut = new Date(checkIn)
      checkOut.setDate(checkOut.getDate() + 2 + (i % 4))
      reservations.push({
        hotel_id: hotelId,
        room_id: room.id,
        guest_id: guest.id,
        guest_name: guest.name,
        check_in: checkIn.toISOString().slice(0, 10),
        check_out: checkOut.toISOString().slice(0, 10),
        status: statuses[i % statuses.length],
        channel: channels[i % channels.length],
        nightly_rate: 450 + i * 10,
        total_amount: (450 + i * 10) * (2 + (i % 4)),
        created_by: profileIds['manager@mojo.gh'],
      })
    }
    await admin.from('reservations').insert(reservations)
  }

  const { count: complaintCount } = await admin.from('complaints').select('*', { count: 'exact', head: true }).eq('hotel_id', hotelId)
  if ((complaintCount ?? 0) < 5 && seededGuests?.length && rooms?.length) {
    const categories = ['plumbing', 'electrical', 'hvac', 'furniture', 'cleaning', 'noise', 'other']
    const statuses = [
      'open', 'assigned', 'in_progress', 'pending_approval', 'pending_approval', 'pending_approval',
      'rejected', 'rejected', 'resolved', 'open', 'assigned', 'in_progress', 'resolved', 'open', 'open',
    ]
    const techIds = [
      profileIds['tech1@mojo.gh'],
      profileIds['tech2@mojo.gh'],
      profileIds['tech3@mojo.gh'],
    ]

    const complaintRows = []
    for (let i = 0; i < 15; i++) {
      const guest = seededGuests[i % seededGuests.length]
      const status = statuses[i]
      const priority = i === 14 ? 'urgent' : ['low', 'medium', 'high', 'urgent'][i % 4]
      const assigned = ['assigned', 'in_progress', 'pending_approval', 'rejected', 'resolved'].includes(status)
        ? techIds[i % 3]
        : null
      complaintRows.push({
        hotel_id: hotelId,
        room_id: guest.room_id ?? rooms[i % rooms.length].id,
        guest_id: guest.id,
        category: categories[i % categories.length],
        description: `Seed complaint #${i + 1}: reported issue requiring staff attention.`,
        priority,
        status,
        assigned_to: assigned,
        rejection_note: status === 'rejected' ? 'Please redo the repair — issue persists.' : null,
        submitted_at: new Date(Date.now() - i * 3600000).toISOString(),
        resolved_at: status === 'resolved' ? new Date().toISOString() : null,
      })
    }

    const { data: insertedComplaints } = await admin.from('complaints').insert(complaintRows).select('id, status')

    for (const c of insertedComplaints ?? []) {
      await admin.from('complaint_events').insert([
        { complaint_id: c.id, actor_role: 'guest', event_type: 'submitted', note: 'Guest reported via portal' },
      ])
      if (c.status !== 'open') {
        await admin.from('complaint_events').insert({
          complaint_id: c.id,
          actor_id: profileIds['manager@mojo.gh'],
          actor_role: 'manager',
          event_type: 'assigned',
        })
      }
      if (['in_progress', 'pending_approval', 'rejected', 'resolved'].includes(c.status)) {
        await admin.from('complaint_events').insert({
          complaint_id: c.id,
          actor_id: techIds[0],
          actor_role: 'technician',
          event_type: 'started',
        })
      }
      if (['pending_approval', 'resolved'].includes(c.status)) {
        await admin.from('complaint_events').insert({
          complaint_id: c.id,
          actor_id: techIds[0],
          actor_role: 'technician',
          event_type: 'completion_requested',
        })
      }
      if (c.status === 'rejected') {
        await admin.from('complaint_events').insert({
          complaint_id: c.id,
          actor_id: profileIds['manager@mojo.gh'],
          actor_role: 'manager',
          event_type: 'rejected',
          note: 'Please redo the repair — issue persists.',
        })
      }
      if (c.status === 'resolved') {
        await admin.from('complaint_events').insert({
          complaint_id: c.id,
          actor_id: profileIds['manager@mojo.gh'],
          actor_role: 'manager',
          event_type: 'resolved',
        })
      }
    }
  }

  console.log('\nSeed complete.')
  console.log('\nStaff accounts (password: password123):')
  accounts.forEach((a) => console.log(`  ${a.email} → ${a.role}`))
  console.log('\nGuest portal URLs:')
  seededGuests?.forEach((g) => console.log(`  ${appUrl}/guest/enter?token=${g.token}  (${g.name})`))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
