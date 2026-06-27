/** Short reference codes for clipboard export across list pages. */
export function complaintRef(id: string) {
  return `CMP-${id.slice(0, 8).toUpperCase()}`
}

export function taskRef(id: string) {
  return `TSK-${id.slice(0, 8).toUpperCase()}`
}

export function staffRef(id: string) {
  return `STF-${id.slice(0, 8).toUpperCase()}`
}

export function logRef(id: string, prefix = 'LOG') {
  return `${prefix}-${id.slice(0, 8).toUpperCase()}`
}

export async function copyToClipboard(text: string, successMessage: string) {
  const { toast } = await import('sonner')
  await navigator.clipboard.writeText(text)
  toast.success(successMessage)
}
