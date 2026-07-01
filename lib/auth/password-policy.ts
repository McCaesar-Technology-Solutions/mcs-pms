import { z } from 'zod'

/** Minimum length for newly set passwords (signup, invite, reset). */
export const PASSWORD_MIN_LENGTH = 12

export const PASSWORD_MIN_LENGTH_MESSAGE = `Password must be at least ${PASSWORD_MIN_LENGTH} characters`

/** New passwords — signup, staff invite, password reset. */
export const newPasswordFieldSchema = z.string().min(PASSWORD_MIN_LENGTH, PASSWORD_MIN_LENGTH_MESSAGE)
