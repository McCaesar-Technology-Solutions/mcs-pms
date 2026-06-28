import type { RefObject } from 'react'

type ComposeField = HTMLTextAreaElement | HTMLInputElement

/** Fill the compose box with a suggested message; user edits and sends manually. */
export function prepopulateMessageComposer(
  text: string,
  setBody: (value: string) => void,
  fieldRef: RefObject<ComposeField | null>,
) {
  setBody(text)
  requestAnimationFrame(() => {
    const el = fieldRef.current
    if (!el) return
    el.focus()
    if ('setSelectionRange' in el) {
      const len = text.length
      el.setSelectionRange(len, len)
    }
  })
}
