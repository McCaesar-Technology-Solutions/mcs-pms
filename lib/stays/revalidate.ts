import { revalidatePath } from 'next/cache'

export function revalidateStayViews() {
  const paths = [
    '/owner/reservations',
    '/manager/reservations',
    '/owner/guests',
    '/manager/guests',
    '/owner/dashboard',
    '/manager/dashboard',
    '/owner/billing',
    '/owner/gra-reports',
    '/owner/rooms',
    '/manager/rooms',
    '/manager/housekeeping',
    '/mobile/housekeeping',
  ]
  for (const path of paths) revalidatePath(path)
}
