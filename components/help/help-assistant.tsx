'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, ArrowRight, Search, Sparkles, X } from 'lucide-react'
import { findHelpTopic, getHelpPack, getRoleLabel, rankHelpTopics } from '@/lib/help'
import type { HelpRole, HelpTopic } from '@/lib/help/types'
import type { UserRole } from '@/types'

interface HelpAssistantProps {
  role: UserRole | 'guest'
  /** Extra bottom offset when a tab bar sits below (guest portal). */
  bottomOffset?: 'default' | 'guest'
}

export function HelpAssistant({ role, bottomOffset = 'default' }: HelpAssistantProps) {
  const pathname = usePathname() ?? ''
  const pack = useMemo(() => getHelpPack(role), [role])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const ranked = useMemo(
    () => rankHelpTopics(pack.topics, pathname, query),
    [pack.topics, pathname, query],
  )

  const activeTopic = activeTopicId ? findHelpTopic(pack, activeTopicId) : null

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeTopicId) setActiveTopicId(null)
        else setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, activeTopicId])

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 120)
      return () => window.clearTimeout(t)
    }
    setQuery('')
    setActiveTopicId(null)
  }, [open])

  const fabBottom =
    bottomOffset === 'guest'
      ? 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))]'
      : 'bottom-[calc(1.25rem+env(safe-area-inset-bottom))]'

  return (
    <div className={`fixed right-4 z-[9990] ${fabBottom}`}>
      {open && (
        <div
          ref={panelRef}
          className="help-assistant-panel mb-3 flex w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-elevation-3"
          role="dialog"
          aria-label={pack.title}
        >
          <header className="border-b border-border/70 bg-gradient-to-br from-primary/[0.06] to-[rgba(212,166,46,0.08)] px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-[var(--brand-gold)]" aria-hidden />
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {getRoleLabel(role as HelpRole)} help
                  </p>
                </div>
                <h2 className="mt-0.5 truncate text-base font-semibold text-foreground">{pack.title}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{pack.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close help"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          {activeTopic ? (
            <TopicDetail
              topic={activeTopic}
              onBack={() => setActiveTopicId(null)}
              onClose={() => setOpen(false)}
            />
          ) : (
            <>
              <div className="border-b border-border/60 px-3 py-2.5">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search help…"
                    className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none ring-primary focus:ring-2"
                  />
                </label>
              </div>

              <div className="max-h-[min(50dvh,20rem)] overflow-y-auto p-2">
                {ranked.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                    No topics match. Try “checkout”, “folio”, or “complaint”.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {ranked.map((topic, index) => (
                      <li key={topic.id}>
                        <button
                          type="button"
                          onClick={() => setActiveTopicId(topic.id)}
                          className="flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
                            {index < 3 && topicMatchesPath(topic, pathname) ? '★' : '→'}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-foreground">{topic.title}</span>
                            <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {topic.summary}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <footer className="border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
                Tips are based on your role — not AI. Press Esc to close.
              </footer>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-14 w-14 items-center justify-center rounded-full shadow-elevation-3 transition-all hover:-translate-y-0.5 hover:shadow-elevation-3 ${
          open
            ? 'bg-primary text-primary-foreground'
            : 'bg-primary text-primary-foreground ring-4 ring-primary/15'
        }`}
        aria-expanded={open}
        aria-label={open ? 'Close help assistant' : 'Open help assistant'}
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </button>
    </div>
  )
}

function topicMatchesPath(topic: HelpTopic, pathname: string): boolean {
  if (!topic.pathPrefixes?.length) return false
  return topic.pathPrefixes.some((prefix) => pathname.startsWith(prefix))
}

function TopicDetail({
  topic,
  onBack,
  onClose,
}: {
  topic: HelpTopic
  onBack: () => void
  onClose: () => void
}) {
  return (
    <div className="flex max-h-[min(58dvh,24rem)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All topics
        </button>
        <h3 className="text-base font-semibold text-foreground">{topic.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{topic.summary}</p>
        <ol className="mt-4 list-decimal space-y-2 pl-4 text-sm text-foreground">
          {topic.steps.map((step) => (
            <li key={step} className="pl-1">
              {step}
            </li>
          ))}
        </ol>
      </div>
      <footer className="flex flex-col gap-2 border-t border-border/60 p-3">
        {topic.href && (
          <Link
            href={topic.href}
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-elevation-2"
          >
            {topic.hrefLabel ?? 'Go there'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </footer>
    </div>
  )
}
