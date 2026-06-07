// User & Auth
export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'staff'
  avatar?: string
}

// Property & Rooms
export interface Property {
  id: string
  name: string
  code: string
  address: string
  city: string
  region: string
  totalRooms: number
}

export type RoomStatus = 'occupied' | 'vacant' | 'maintenance' | 'reserved' | 'dirty'

export interface Room {
  id: string
  number: string
  type: 'single' | 'double' | 'suite'
  status: RoomStatus
  propertyId: string
  floor: number
  price: number
}

// Reservations & Bookings
export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'

export interface Reservation {
  id: string
  bookingRef: string
  guestId: string
  guestName: string
  guestEmail: string
  guestPhone: string
  roomId: string
  roomNumber: string
  propertyId: string
  checkInDate: string
  checkOutDate: string
  status: BookingStatus
  numberOfNights: number
  totalPrice: number
  paidAmount: number
  currency: string
  source: 'website' | 'airbnb' | 'booking' | 'walk_in' | 'other'
  notes?: string
  createdAt: string
  updatedAt: string
}

// Housekeeping
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface HousekeepingTask {
  id: string
  roomId: string
  roomNumber: string
  taskType: 'clean' | 'inspect' | 'maintenance' | 'restock'
  status: TaskStatus
  priority: TaskPriority
  assignedToId: string
  assignedToName: string
  notes?: string
  dueDate: string
  completedAt?: string
  createdAt: string
}

export interface StaffMember {
  id: string
  name: string
  role: string
  status: 'available' | 'busy' | 'off'
  shift: string
}

// Billing & Invoices
export interface Invoice {
  id: string
  invoiceNumber: string
  reservationId: string
  guestName: string
  issueDate: string
  dueDate: string
  totalAmount: number
  paidAmount: number
  status: 'draft' | 'issued' | 'paid' | 'overdue'
  items: InvoiceItem[]
  notes?: string
  createdAt: string
}

export interface InvoiceItem {
  description: string
  quantity: number
  unitPrice: number
  amount: number
}

// GRA Tax Compliance
export interface GRATaxSummary {
  period: string
  totalRevenue: number
  totalTax: number
  taxRate: number
  invoicesIssued: number
  invoicesPaid: number
  status: 'pending' | 'submitted' | 'approved'
}

// Channels & Distribution
export interface ChannelPerformance {
  channel: 'website' | 'airbnb' | 'booking' | 'walk_in' | 'other'
  bookings: number
  revenue: number
  averageRating?: number
  occupancyRate: number
}

// Analytics
export interface KPIMetrics {
  totalRevenue: number
  occupancyRate: number
  averageNightlyRate: number
  totalBookings: number
  totalGuests: number
  reviParMetric: number
}

export interface Availability {
  date: string
  available: number
  occupied: number
  maintenance: number
  reserved: number
}
