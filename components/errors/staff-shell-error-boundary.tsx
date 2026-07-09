'use client'

import { Component, type ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { captureException } from '@/lib/monitoring/sentry'

interface StaffShellErrorBoundaryProps {
  children: ReactNode
  homeHref: string
  homeLabel?: string
  boundary: string
}

interface StaffShellErrorBoundaryState {
  error: Error | null
}

export class StaffShellErrorBoundary extends Component<
  StaffShellErrorBoundaryProps,
  StaffShellErrorBoundaryState
> {
  state: StaffShellErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): StaffShellErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error(error)
    captureException(error, { boundary: this.props.boundary })
  }

  render() {
    if (this.state.error) {
      const { homeHref, homeLabel = 'Dashboard' } = this.props
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <h2 className="text-lg font-semibold text-foreground">This section failed to load</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            The rest of the app is still available. Try again or return to your dashboard.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="app-btn app-btn-primary px-4 py-2 text-sm"
            >
              Try again
            </button>
            <Link href={homeHref} className="app-btn app-btn-ghost px-4 py-2 text-sm">
              {homeLabel}
            </Link>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
