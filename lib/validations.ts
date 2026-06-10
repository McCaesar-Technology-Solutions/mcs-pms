import { z } from 'zod'

export const signInSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const inviteStaffSchema = z.object({
  email: z.string().email(),
  role: z.enum(['manager', 'technician']),
})

export const enrollGuestSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().optional(),
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

export const createReservationSchema = z.object({
  guestName: z.string().min(2),
  roomId: z.string().uuid().optional(),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  channel: z.enum(['airbnb', 'booking_com', 'direct', 'walk_in', 'other']).optional(),
  nightlyRate: z.number().positive().optional(),
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
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>
