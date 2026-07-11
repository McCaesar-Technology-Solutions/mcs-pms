export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NODE_ENV !== 'production') return

  const { validateProductionEnv } = await import('@/lib/env')
  const result = validateProductionEnv()
  if (!result.ok) {
    const message = `[startup] Production env validation failed: ${result.errors.join('; ')}`
    console.error(message)
    throw new Error(message)
  }
}
