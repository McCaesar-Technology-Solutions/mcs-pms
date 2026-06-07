import type {
  User,
  Property,
  Room,
  Reservation,
  HousekeepingTask,
  StaffMember,
  Invoice,
  ChannelPerformance,
  GRATaxSummary,
  Availability,
  KPIMetrics,
} from '@/types'

// Current User
export const currentUser: User = {
  id: '1',
  name: 'Kofi Mensah',
  email: 'kofi@abcfahotel.com',
  role: 'admin',
  avatar: '/placeholder-user.jpg',
}

// Properties
export const properties: Property[] = [
  {
    id: '1',
    name: 'Abɔfa Premier Hotel',
    code: 'APH',
    address: '123 Osu Avenue',
    city: 'Accra',
    region: 'Greater Accra',
    totalRooms: 45,
  },
  {
    id: '2',
    name: 'Abɔfa Comfort Inn',
    code: 'ACI',
    address: '456 Tema Road',
    city: 'Tema',
    region: 'Greater Accra',
    totalRooms: 32,
  },
]

// Rooms
export const rooms: Room[] = [
  { id: '1', number: '101', type: 'single', status: 'occupied', propertyId: '1', floor: 1, price: 250 },
  { id: '2', number: '102', type: 'double', status: 'vacant', propertyId: '1', floor: 1, price: 380 },
  { id: '3', number: '103', type: 'double', status: 'occupied', propertyId: '1', floor: 1, price: 380 },
  { id: '4', number: '104', type: 'suite', status: 'reserved', propertyId: '1', floor: 1, price: 550 },
  { id: '5', number: '201', type: 'single', status: 'occupied', propertyId: '1', floor: 2, price: 250 },
  { id: '6', number: '202', type: 'double', status: 'dirty', propertyId: '1', floor: 2, price: 380 },
  { id: '7', number: '203', type: 'double', status: 'vacant', propertyId: '1', floor: 2, price: 380 },
  { id: '8', number: '204', type: 'suite', status: 'maintenance', propertyId: '1', floor: 2, price: 550 },
  // More rooms for theme variety
  ...Array.from({ length: 37 }, (_, i) => ({
    id: `${i + 9}`,
    number: `${300 + i}`,
    type: (['single', 'double', 'suite'] as const)[i % 3],
    status: (['occupied', 'vacant', 'reserved', 'dirty', 'maintenance'] as const)[i % 5],
    propertyId: i < 20 ? '1' : '2',
    floor: Math.floor((i % 20) / 5) + 3,
    price: ([250, 380, 550] as const)[i % 3],
  })),
]

// Reservations
const today = new Date()
const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
const twoWeeks = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)

export const reservations: Reservation[] = [
  {
    id: '1',
    bookingRef: 'APH-2024-001',
    guestId: '1',
    guestName: 'Ama Osei',
    guestEmail: 'ama.osei@example.com',
    guestPhone: '+233 24 123 4567',
    roomId: '1',
    roomNumber: '101',
    propertyId: '1',
    checkInDate: today.toISOString().split('T')[0],
    checkOutDate: tomorrow.toISOString().split('T')[0],
    status: 'checked_in',
    numberOfNights: 1,
    totalPrice: 250,
    paidAmount: 250,
    currency: 'GHS',
    source: 'website',
    createdAt: new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: today.toISOString(),
  },
  {
    id: '2',
    bookingRef: 'APH-2024-002',
    guestId: '2',
    guestName: 'Kwesi Adjei',
    guestEmail: 'kwesi.adjei@example.com',
    guestPhone: '+233 20 987 6543',
    roomId: '3',
    roomNumber: '103',
    propertyId: '1',
    checkInDate: today.toISOString().split('T')[0],
    checkOutDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'checked_in',
    numberOfNights: 3,
    totalPrice: 1140,
    paidAmount: 1140,
    currency: 'GHS',
    source: 'airbnb',
    createdAt: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: today.toISOString(),
  },
  {
    id: '3',
    bookingRef: 'APH-2024-003',
    guestId: '3',
    guestName: 'Abena Mensah',
    guestEmail: 'abena@example.com',
    guestPhone: '+233 50 456 7890',
    roomId: '4',
    roomNumber: '104',
    propertyId: '1',
    checkInDate: tomorrow.toISOString().split('T')[0],
    checkOutDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'confirmed',
    numberOfNights: 4,
    totalPrice: 2200,
    paidAmount: 1100,
    currency: 'GHS',
    source: 'booking',
    createdAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: today.toISOString(),
  },
  {
    id: '4',
    bookingRef: 'APH-2024-004',
    guestId: '4',
    guestName: 'Yaw Boateng',
    guestEmail: 'yaw@example.com',
    guestPhone: '+233 24 789 0123',
    roomId: '2',
    roomNumber: '102',
    propertyId: '1',
    checkInDate: nextWeek.toISOString().split('T')[0],
    checkOutDate: new Date(nextWeek.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'confirmed',
    numberOfNights: 2,
    totalPrice: 760,
    paidAmount: 0,
    currency: 'GHS',
    source: 'walk_in',
    createdAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: today.toISOString(),
  },
  {
    id: '5',
    bookingRef: 'APH-2024-005',
    guestId: '5',
    guestName: 'Ekua Ansah',
    guestEmail: 'ekua.a@example.com',
    guestPhone: '+233 55 321 0987',
    roomId: '5',
    roomNumber: '201',
    propertyId: '1',
    checkInDate: twoWeeks.toISOString().split('T')[0],
    checkOutDate: new Date(twoWeeks.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'confirmed',
    numberOfNights: 7,
    totalPrice: 1750,
    paidAmount: 875,
    currency: 'GHS',
    source: 'website',
    createdAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: today.toISOString(),
  },
  {
    id: '6',
    bookingRef: 'ACI-2024-001',
    guestId: '6',
    guestName: 'Efua Boateng',
    guestEmail: 'efua.boateng@example.com',
    guestPhone: '+233 26 555 1234',
    roomId: '29',
    roomNumber: '320',
    propertyId: '2',
    checkInDate: today.toISOString().split('T')[0],
    checkOutDate: tomorrow.toISOString().split('T')[0],
    status: 'checked_in',
    numberOfNights: 1,
    totalPrice: 380,
    paidAmount: 380,
    currency: 'GHS',
    source: 'booking',
    createdAt: new Date(today.getTime() - 12 * 60 * 60 * 1000).toISOString(),
    updatedAt: today.toISOString(),
  },
  {
    id: '7',
    bookingRef: 'ACI-2024-002',
    guestId: '7',
    guestName: 'Yaw Darko',
    guestEmail: 'yaw.darko@example.com',
    guestPhone: '+233 55 444 3322',
    roomId: '35',
    roomNumber: '326',
    propertyId: '2',
    checkInDate: tomorrow.toISOString().split('T')[0],
    checkOutDate: nextWeek.toISOString().split('T')[0],
    status: 'confirmed',
    numberOfNights: 6,
    totalPrice: 2280,
    paidAmount: 1140,
    currency: 'GHS',
    source: 'airbnb',
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  },
]

// Housekeeping Tasks
export const housekeepingTasks: HousekeepingTask[] = [
  {
    id: '1',
    roomId: '6',
    roomNumber: '202',
    taskType: 'clean',
    status: 'todo',
    priority: 'high',
    assignedToId: '1',
    assignedToName: 'Akosua Owusu',
    dueDate: today.toISOString().split('T')[0],
    createdAt: today.toISOString(),
  },
  {
    id: '2',
    roomId: '2',
    roomNumber: '102',
    taskType: 'clean',
    status: 'in_progress',
    priority: 'high',
    assignedToId: '2',
    assignedToName: 'Kofi Opoku',
    dueDate: today.toISOString().split('T')[0],
    createdAt: today.toISOString(),
  },
  {
    id: '3',
    roomId: '7',
    roomNumber: '203',
    taskType: 'inspect',
    status: 'done',
    priority: 'medium',
    assignedToId: '1',
    assignedToName: 'Akosua Owusu',
    dueDate: today.toISOString().split('T')[0],
    completedAt: today.toISOString(),
    createdAt: today.toISOString(),
  },
  {
    id: '4',
    roomId: '8',
    roomNumber: '204',
    taskType: 'maintenance',
    status: 'todo',
    priority: 'high',
    assignedToId: '3',
    assignedToName: 'Ebo Mensah',
    dueDate: today.toISOString().split('T')[0],
    createdAt: today.toISOString(),
  },
  {
    id: '5',
    roomId: '1',
    roomNumber: '101',
    taskType: 'restock',
    status: 'todo',
    priority: 'low',
    assignedToId: '1',
    assignedToName: 'Akosua Owusu',
    dueDate: tomorrow.toISOString().split('T')[0],
    createdAt: today.toISOString(),
  },
]

// Staff
export const staffMembers: StaffMember[] = [
  { id: '1', name: 'Akosua Owusu', role: 'Housekeeper', status: 'available', shift: 'Morning' },
  { id: '2', name: 'Kofi Opoku', role: 'Housekeeper', status: 'busy', shift: 'Morning' },
  { id: '3', name: 'Ebo Mensah', role: 'Maintenance', status: 'available', shift: 'Full-time' },
  { id: '4', name: 'Nana Yaa', role: 'Front Desk', status: 'busy', shift: 'Morning' },
  { id: '5', name: 'Kwaku Asante', role: 'Manager', status: 'available', shift: 'Full-time' },
]

// Channel Performance
export const channelPerformance: ChannelPerformance[] = [
  { channel: 'website', bookings: 18, revenue: 6800, averageRating: 4.8, occupancyRate: 0.85 },
  { channel: 'airbnb', bookings: 12, revenue: 5200, averageRating: 4.6, occupancyRate: 0.72 },
  { channel: 'booking', bookings: 8, revenue: 3200, averageRating: 4.4, occupancyRate: 0.58 },
  { channel: 'walk_in', bookings: 5, revenue: 1800, occupancyRate: 0.42 },
  { channel: 'other', bookings: 2, revenue: 600, occupancyRate: 0.15 },
]

// GRA Tax Summary
export const graTaxSummary: GRATaxSummary = {
  period: 'June 2024',
  totalRevenue: 17600,
  totalTax: 2112, // 12% standard VAT
  taxRate: 0.12,
  invoicesIssued: 45,
  invoicesPaid: 43,
  status: 'submitted',
}

// KPI Metrics
export const kpiMetrics: KPIMetrics = {
  totalRevenue: 17600,
  occupancyRate: 0.73,
  averageNightlyRate: 391,
  totalBookings: 45,
  totalGuests: 87,
  reviParMetric: 285,
}

// Availability Strip (next 30 days) — deterministic forecast for readable charts
export const TOTAL_ROOMS = 45

export const generateAvailability = (totalRooms: number = TOTAL_ROOMS): Availability[] => {
  const availability: Availability[] = []

  for (let i = 0; i < 30; i++) {
    const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000)
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    // Higher demand Fri–Sun; stable weekday baseline
    const demandFactor = isWeekend ? 0.88 : dayOfWeek === 5 ? 0.82 : 0.68 + (i % 4) * 0.03
    const occupied = Math.min(totalRooms - 2, Math.round(totalRooms * demandFactor * 0.72))
    const reserved = Math.min(
      totalRooms - occupied - 1,
      Math.max(0, Math.round(totalRooms * (isWeekend ? 0.12 : 0.08)))
    )
    const maintenance = i % 9 === 0 ? 2 : i % 5 === 0 ? 1 : 0
    const available = Math.max(0, totalRooms - occupied - reserved - maintenance)

    availability.push({
      date: date.toISOString().split('T')[0],
      available,
      occupied,
      maintenance,
      reserved,
    })
  }

  return availability
}

// Invoices
export const invoices: Invoice[] = [
  {
    id: '1',
    invoiceNumber: 'INV-2024-001',
    reservationId: '1',
    guestName: 'Ama Osei',
    issueDate: today.toISOString().split('T')[0],
    dueDate: today.toISOString().split('T')[0],
    totalAmount: 250,
    paidAmount: 250,
    status: 'paid',
    items: [
      { description: 'Room 101 - 1 Night', quantity: 1, unitPrice: 250, amount: 250 },
    ],
    createdAt: today.toISOString(),
  },
  {
    id: '2',
    invoiceNumber: 'INV-2024-002',
    reservationId: '3',
    guestName: 'Abena Mensah',
    issueDate: yesterday.toISOString().split('T')[0],
    dueDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    totalAmount: 2200,
    paidAmount: 1100,
    status: 'overdue',
    items: [
      { description: 'Room 104 (Suite) - 4 Nights', quantity: 4, unitPrice: 550, amount: 2200 },
    ],
    createdAt: yesterday.toISOString(),
  },
]
