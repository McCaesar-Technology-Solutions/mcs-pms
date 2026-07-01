import type { NotifyOptions } from '@/lib/notifications/send'
import { isWhatsAppNotificationsConfigured } from '@/lib/notifications/termii'

/** SMS (Arkesel) plus WhatsApp (Termii) when a WhatsApp provider is configured. */
export function phoneNotifyOpts(
  templateKey: string,
  overrides?: Partial<NotifyOptions>,
): NotifyOptions {
  return {
    templateKey,
    includeWhatsApp: isWhatsAppNotificationsConfigured(),
    ...overrides,
  }
}
