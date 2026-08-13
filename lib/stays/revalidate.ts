import { revalidatePath } from 'next/cache'

export function revalidateStayViews() {
  const paths = [
    '/owner/reservations',
    '/manager/reservations',
    '/receptionist/reservations',
    '/owner/guests',
    '/manager/guests',
    '/receptionist/guests',
    '/owner/dashboard',
    '/manager/dashboard',
    '/receptionist/dashboard',
    '/owner/billing',
    '/manager/invoices',
    '/receptionist/billing',
    '/owner/gra-reports',
    '/owner/rooms',
    '/manager/rooms',
    '/receptionist/rooms',
    '/manager/housekeeping',
    '/mobile/housekeeping',
  ]
  for (const path of paths) revalidatePath(path)
}
