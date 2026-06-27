'use client'

import type { InputHTMLAttributes } from 'react'

export function BulkSelectCheckbox(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className="h-4 w-4 shrink-0 rounded border-border text-primary"
      {...props}
    />
  )
}
