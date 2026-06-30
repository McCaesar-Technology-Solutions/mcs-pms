import { captureException } from '@/lib/monitoring/sentry'

export interface NotifyFailureContext {
  templateKey: string
  hotelId?: string
  channel: 'sms' | 'email' | 'whatsapp'
  recipient: string
  error?: string
  stage?: 'send' | 'outbox_retry' | 'outbox_dead' | 'task'
}

export function reportNotificationFailure(ctx: NotifyFailureContext): void {
  const message = `[notify:${ctx.templateKey}] ${ctx.channel} to ${ctx.recipient} failed (${ctx.stage ?? 'send'}): ${ctx.error ?? 'unknown'}`
  if (process.env.NODE_ENV === 'development') {
    console.error(message)
  }
  captureException(new Error(message), {
    notification_template: ctx.templateKey,
    notification_channel: ctx.channel,
    notification_recipient: ctx.recipient,
    notification_hotel_id: ctx.hotelId,
    notification_stage: ctx.stage ?? 'send',
  })
}
