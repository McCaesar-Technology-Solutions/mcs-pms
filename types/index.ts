// User & Auth (Phase 0 legacy + Phase 1)
export type UserRole = 'owner' | 'manager' | 'technician'

export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'staff' | UserRole
  avatar?: string
}

export interface Profile {
  id: string
  hotel_id: string | null
  role: UserRole
  name: string
  email: string
  phone: string | null
  specialty: string | null
  invited_by: string | null
  is_active: boolean | null
  created_at: string | null
}

export interface Hotel {
  id: string
  name: string
  address: string | null
  city: string | null
  region: string | null
  owner_id: string | null
  gta_license_number: string | null
  gta_license_expiry: string | null
  vat_registration_number: string | null
  invoice_prefix: string | null
  invoice_next_seq: number | null
  invoice_seq_year: number | null
  created_at: string | null
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

// Phase 1 — Supabase schema types
export type DbRoomStatus =
  | 'available'
  | 'occupied'
  | 'maintenance'
  | 'needs_inspection'
  | 'cleaning'

export interface RoomCategory {
  id: string
  hotel_id: string
  name: string
  default_nightly_rate: number
  created_at: string | null
}

export type ReservationStatus = 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'

export type ReservationChannel = 'airbnb' | 'booking_com' | 'direct' | 'walk_in' | 'other'

export type ComplaintCategory =
  | 'plumbing'
  | 'electrical'
  | 'hvac'
  | 'furniture'
  | 'cleaning'
  | 'noise'
  | 'other'

export type ComplaintPriority = 'low' | 'medium' | 'high' | 'urgent'

export type ComplaintStatus =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'pending_approval'
  | 'rejected'
  | 'resolved'

export type ComplaintEventType =
  | 'submitted'
  | 'assigned'
  | 'started'
  | 'completion_requested'
  | 'rejected'
  | 'resolved'
  | 'estimate_submitted'
  | 'estimate_approved'

export type ApprovalStage = 'estimate' | 'completion'

export interface ComplaintEstimateItem {
  id: string
  estimate_id: string
  material_name: string
  quantity: number
  unit_cost: number
  line_total: number
  sort_order: number
}

export interface ComplaintEstimate {
  id: string
  complaint_id: string
  hotel_id: string
  technician_id: string
  note: string | null
  labour_cost: number
  materials_total: number
  total_cost: number
  created_at: string | null
  updated_at: string | null
  items?: ComplaintEstimateItem[]
  technician?: { name: string } | null
}

export type PaymentMethod =
  | 'mtn_momo'
  | 'telecel_cash'
  | 'airteltigo'
  | 'visa'
  | 'mastercard'
  | 'cash'
  | 'bank_transfer'

export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'refunded'

export interface DbRoom {
  id: string
  hotel_id: string
  number: string
  floor: number | null
  category_id: string | null
  nightly_rate: number | null
  status: DbRoomStatus | null
  updated_at: string | null
  updated_by: string | null
  room_categories?: Pick<RoomCategory, 'name' | 'default_nightly_rate'> | null
}

export interface Guest {
  id: string
  hotel_id: string
  room_id: string | null
  name: string
  email: string | null
  phone: string | null
  ghana_card_number: string | null
  token: string
  token_expires_at: string | null
  check_in: string | null
  check_out: string | null
  enrolled_by: string | null
  created_at: string | null
}

export interface DbReservation {
  id: string
  hotel_id: string
  room_id: string | null
  guest_id: string | null
  guest_name: string
  check_in: string
  check_out: string
  status: ReservationStatus | null
  channel: ReservationChannel | null
  nightly_rate: number | null
  total_amount: number | null
  created_by: string | null
  created_at: string | null
}

export interface Complaint {
  id: string
  hotel_id: string
  room_id: string | null
  guest_id: string | null
  category: ComplaintCategory
  description: string
  priority: ComplaintPriority | null
  status: ComplaintStatus | null
  assigned_to: string | null
  approval_stage: ApprovalStage | null
  estimate_approved_at: string | null
  rejection_note: string | null
  submitted_at: string | null
  resolved_at: string | null
  room?: DbRoom | null
  guest?: Guest | null
  assignee?: Pick<Profile, 'id' | 'name' | 'phone' | 'specialty'> | null
  rooms?: { number: string } | null
  guests?: { name: string; phone: string | null } | null
}

export interface ComplaintEvent {
  id: string
  complaint_id: string
  actor_id: string | null
  actor_role: string | null
  event_type: ComplaintEventType
  note: string | null
  created_at: string | null
}

export interface DbInvoice {
  id: string
  hotel_id: string
  reservation_id: string | null
  guest_id: string | null
  guest_name: string
  invoice_number: string | null
  subtotal: number
  vat_amount: number | null
  nhil_amount: number | null
  getfund_amount: number | null
  covid_levy_amount: number | null
  elevy_amount: number | null
  total_amount: number
  payment_method: PaymentMethod | null
  payment_status: PaymentStatus | null
  issued_at: string | null
  due_at: string | null
  paid_at: string | null
}

export interface StaffInvite {
  id: string
  hotel_id: string
  email: string
  phone: string | null
  role: 'manager' | 'technician'
  invited_by: string | null
  token: string
  accepted: boolean | null
  created_at: string | null
}

export type HousekeepingTaskType = 'clean' | 'inspect' | 'maintenance' | 'restock'

export interface DbHousekeepingTask {
  id: string
  hotel_id: string
  room_id: string | null
  task_type: HousekeepingTaskType
  status: TaskStatus
  priority: TaskPriority
  assigned_to: string | null
  notes: string | null
  due_date: string | null
  created_by: string | null
  created_at: string | null
  completed_at: string | null
}

