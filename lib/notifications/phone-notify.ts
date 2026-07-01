import type { NotifyOptions } from '@/lib/notifications/send'

/** SMS (Arkesel) plus WhatsApp (Termii) when configured. */
export function phoneNotifyOpts(
  templateKey: string,
  overrides?: Partial<NotifyOptions>,
): NotifyOptions {
  return {
    templateKey,
    includeWhatsApp: true,
    ...overrides,
  }
}
