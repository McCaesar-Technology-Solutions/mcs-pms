export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NODE_ENV !== 'production') return

  const { validateProductionEnv } = await import('@/lib/env')
  const result = validateProductionEnv()
  if (!result.ok) {
    console.error(
      '[startup] Production env validation failed — /api/ready will return 503 until fixed:',
      result.errors.join('; '),
    )
  }
}
