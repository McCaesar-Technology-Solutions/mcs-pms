import { reportNotificationFailure } from '@/lib/notifications/notify-failure'

export interface NotifyTaskContext {
  templateKey: string
  hotelId?: string
  channel?: 'sms' | 'email'
}

/** Run async notification work without blocking the caller; log and report failures. */
export function runNotifyTask(task: Promise<unknown>, ctx: NotifyTaskContext): void {
  void task.catch((err: unknown) => {
    const error = err instanceof Error ? err.message : String(err)
    reportNotificationFailure({
      templateKey: ctx.templateKey,
      hotelId: ctx.hotelId,
      channel: ctx.channel ?? 'sms',
      recipient: 'batch',
      error,
      stage: 'task',
    })
  })
}
