'use client'

import { Component, type ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { captureException } from '@/lib/monitoring/sentry'
import {
  isStaleDeploymentError,
  reloadOnceForStaleDeployment,
} from '@/lib/client/stale-deployment'

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
    console.error(`[${this.props.boundary}]`, error)
    captureException(error, { boundary: this.props.boundary })

    // A new deploy invalidates the running bundle's server-action IDs; every
    // background refresh then throws. A single reload picks up the new bundle.
    if (isStaleDeploymentError(error)) {
      reloadOnceForStaleDeployment()
    }
  }

  render() {
    if (this.state.error) {
      const { homeHref, homeLabel = 'Dashboard' } = this.props
      const digest = (this.state.error as Error & { digest?: string }).digest
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <h2 className="text-lg font-semibold text-foreground">This section failed to load</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            The rest of the app is still available. Try again or return to your dashboard.
          </p>
          {this.state.error.message && (
            <p className="mt-3 max-w-md break-words rounded-lg bg-secondary/60 px-3 py-2 font-mono text-xs text-muted-foreground">
              {this.state.error.message.slice(0, 300)}
            </p>
          )}
          {digest && <p className="mt-2 text-xs text-muted-foreground/70">Reference: {digest}</p>}
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
