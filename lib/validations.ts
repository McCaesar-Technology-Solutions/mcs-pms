import { z } from 'zod'
import { phoneSchema } from '@/lib/phone'

export const signInSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const requestResetSchema = z.object({
  email: z.string().email('Enter a valid email'),
})

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string().min(8, 'Please confirm your password'),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirm) {
      ctx.addIssue({ code: 'custom', message: 'Passwords do not match.', path: ['confirm'] })
    }
  })

export const inviteStaffSchema = z
  .object({
    role: z.enum(['manager', 'technician', 'receptionist']),
    email: z.string().email().optional(),
    phone: phoneSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'manager' || data.role === 'receptionist') {
      if (!data.email?.trim()) {
        ctx.addIssue({ code: 'custom', message: 'Email is required.', path: ['email'] })
      }
    } else if (!data.phone?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Phone number is required.', path: ['phone'] })
    }
  })

export const enrollGuestSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: phoneSchema,
  email: z.string().email().optional().or(z.literal('')),
  roomId: z.string().uuid(),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
})

export const submitComplaintSchema = z.object({
  category: z.enum([
    'plumbing',
    'electrical',
    'hvac',
    'furniture',
    'cleaning',
    'noise',
    'other',
  ]),
  description: z.string().min(10, 'Please describe the issue'),
  priority: z.enum(['medium', 'urgent']).default('medium'),
})

export const scheduleComplaintVisitSchema = z.object({
  complaintId: z.string().uuid(),
  visitAt: z
    .string()
    .min(1, 'Pick a date and time')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date and time'),
})

export const guestRoomEntrySchema = z.object({
  slug: z
    .string()
    .min(3, 'Invalid property link')
    .max(48)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid property link'),
  roomNumber: z
    .string()
    .trim()
    .min(1, 'Enter your room number')
    .max(20, 'Room number is too long'),
})

export const staffComplaintSchema = z.object({
  category: z.enum([
    'plumbing',
    'electrical',
    'hvac',
    'furniture',
    'cleaning',
    'noise',
    'other',
  ]),
  description: z.string().min(10, 'Please describe the issue'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  roomId: z.string().uuid('Select a room').optional(),
  guestId: z.string().uuid().optional(),
})

export const createReservationSchema = z.object({
  guestName: z.string().min(2, 'Guest name is required'),
  roomId: z.string().uuid('Select a room'),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  channel: z.enum(['airbnb', 'booking_com', 'direct', 'walk_in', 'other']),
  rateType: z.enum(['nightly', 'monthly']).default('nightly'),
  nightlyRate: z.coerce.number().min(0, 'Rate cannot be negative'),
  monthlyRate: z.coerce.number().min(0, 'Rate cannot be negative').optional(),
  guestId: z.string().uuid().optional(),
})

export const updateReservationSchema = createReservationSchema
  .partial()
  .extend({
    guestName: z.string().min(2, 'Guest name is required').optional(),
    roomId: z.string().uuid().optional(),
    checkIn: z.string().min(1).optional(),
    checkOut: z.string().min(1).optional(),
  })

export const createHousekeepingTaskSchema = z.object({
  roomId: z.string().uuid(),
  taskType: z.enum(['clean', 'inspect', 'maintenance', 'restock']),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  assignedTo: z.string().uuid().optional().or(z.literal('')),
  dueDate: z.string().optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
})

export const acceptInviteSchema = z.object({
  token: z.string().uuid(),
  name: z.string().min(2),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: phoneSchema,
})

export const updateHotelSettingsSchema = z.object({
  hotelId: z.string().uuid(),
  name: z.string().min(2, 'Property name is required'),
  address: z.string().min(2, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  region: z.string().min(2, 'Region is required'),
  gta_license_number: z.string().max(80).optional().or(z.literal('')),
  gta_license_expiry: z.string().optional().or(z.literal('')),
  vat_registration_number: z.string().max(80).optional().or(z.literal('')),
  invoice_prefix: z
    .string()
    .min(2, 'Prefix must be at least 2 characters')
    .max(12, 'Prefix is too long')
    .regex(/^[A-Za-z0-9-]+$/, 'Use letters, numbers, or hyphens only')
    .optional()
    .or(z.literal('')),
})

export const createPropertySchema = z.object({
  name: z.string().min(2, 'Property name is required'),
  address: z.string().min(2, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  region: z.string().min(2, 'Region is required'),
  totalRooms: z.number().int().min(1).max(999),
})

const estimateMaterialRowSchema = z.object({
  materialName: z.string().min(1, 'Material name is required').max(120),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  unitCost: z.coerce.number().min(0, 'Unit cost cannot be negative'),
})

export const submitComplaintEstimateSchema = z.object({
  complaintId: z.string().uuid(),
  note: z.string().max(2000).optional().or(z.literal('')),
  labourCost: z.coerce.number().min(0, 'Labour cost cannot be negative'),
  materials: z.array(estimateMaterialRowSchema).max(30),
})

export const createRoomCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(80),
  defaultNightlyRate: z.coerce.number().min(0, 'Rate cannot be negative'),
  defaultMonthlyRate: z.coerce.number().min(0, 'Rate cannot be negative').optional().or(z.literal('')),
})

export const updateRoomCategorySchema = createRoomCategorySchema.partial()

export const createRoomSchema = z.object({
  number: z.string().min(1, 'Room number is required'),
  floor: z.coerce.number().int().min(0),
  categoryId: z.string().uuid('Select a room category'),
  nightlyRate: z.coerce.number().min(0, 'Price cannot be negative'),
  monthlyRate: z.coerce.number().min(0, 'Price cannot be negative').optional().or(z.literal('')),
})

export const updateRoomSchema = createRoomSchema
  .partial()
  .extend({
    status: z
      .enum(['available', 'occupied', 'maintenance', 'needs_inspection', 'cleaning'])
      .optional(),
  })

export const signUpOwnerSchema = z.object({
  name: z.string().min(2, 'Your name is required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  hotelName: z.string().min(2, 'Property name is required'),
  hotelAddress: z.string().max(200).optional().or(z.literal('')),
})

export type SignInInput = z.infer<typeof signInSchema>
export type EnrollGuestInput = z.infer<typeof enrollGuestSchema>
export type SubmitComplaintInput = z.infer<typeof submitComplaintSchema>
export type StaffComplaintInput = z.infer<typeof staffComplaintSchema>
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>
