/** True when the recipient has not read this message yet (edit window still open). */
export function recipientHasNotReadMessage(
  messageCreatedAt: string,
  recipientLastReadAt: string | null | undefined,
): boolean {
  if (!recipientLastReadAt) return true
  return new Date(recipientLastReadAt).getTime() < new Date(messageCreatedAt).getTime()
}

/** Own message is editable only if every recipient has not read it yet. */
export function canEditOwnMessage(
  messageCreatedAt: string,
  recipientReadAts: (string | null | undefined)[],
): boolean {
  return recipientReadAts.every((readAt) => recipientHasNotReadMessage(messageCreatedAt, readAt))
}
