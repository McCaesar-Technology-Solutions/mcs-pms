'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, ArrowRight, BookOpen, Search, Send, Sparkles, X } from 'lucide-react'
import { findHelpTopic, getHelpPack, getRoleLabel, rankHelpTopics } from '@/lib/help'
import type { HelpRole, HelpTopic } from '@/lib/help/types'
import type { UserRole } from '@/types'

const QUERY_MAX = 120

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
  const roleLabel = getRoleLabel(role as HelpRole)

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

  function openFirstResult() {
    const first = ranked[0]
    if (first) setActiveTopicId(first.id)
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      openFirstResult()
    }
  }

  const rootClass =
    bottomOffset === 'guest'
      ? 'help-assistant-root help-assistant-root--guest'
      : 'help-assistant-root'

  return (
    <div className={rootClass}>
      {open && (
        <div
          ref={panelRef}
          className="help-assistant-panel"
          role="dialog"
          aria-label={pack.title}
        >
          <header className="help-assistant-header">
            <div className="help-assistant-header__main">
              <div className="flex items-center justify-between gap-2">
                <span className="help-assistant-status">
                  <span className="help-assistant-status__dot" aria-hidden />
                  Help guide
                </span>
                <div className="help-assistant-badges">
                  <span className="help-assistant-badge help-assistant-badge--muted">Guide</span>
                  <span className="help-assistant-badge help-assistant-badge--accent">{roleLabel}</span>
                </div>
              </div>
              <h2 className="help-assistant-header__title">{pack.title}</h2>
              <p className="help-assistant-header__subtitle">{pack.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="help-assistant-close"
              aria-label="Close help"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {activeTopic ? (
            <TopicDetail
              topic={activeTopic}
              onBack={() => setActiveTopicId(null)}
              onClose={() => setOpen(false)}
            />
          ) : (
            <>
              <div className="help-assistant-compose">
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value.slice(0, QUERY_MAX))}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search checkout, folio, complaints…"
                  className="help-assistant-compose__input"
                  aria-label="Search help topics"
                />
                <div className="help-assistant-compose__bar">
                  <div className="help-assistant-compose__tools">
                    <span className="help-assistant-compose__tool" aria-hidden>
                      <Search className="h-4 w-4" />
                    </span>
                    <span className="help-assistant-compose__tool" aria-hidden>
                      <BookOpen className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="help-assistant-compose__meta" aria-live="polite">
                      {query.length}/{QUERY_MAX}
                    </span>
                    <button
                      type="button"
                      onClick={openFirstResult}
                      disabled={ranked.length === 0}
                      className="help-assistant-send"
                      aria-label="Open top result"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="help-assistant-topics">
                {ranked.length === 0 ? (
                  <p className="help-assistant-empty">
                    No topics match. Try &ldquo;checkout&rdquo;, &ldquo;folio&rdquo;, or &ldquo;complaint&rdquo;.
                  </p>
                ) : (
                  <ul>
                    {ranked.map((topic, index) => {
                      const featured = index < 3 && topicMatchesPath(topic, pathname)
                      return (
                        <li key={topic.id}>
                          <button
                            type="button"
                            onClick={() => setActiveTopicId(topic.id)}
                            className={`help-assistant-topic${featured ? ' help-assistant-topic--featured' : ''}`}
                          >
                            <span className="help-assistant-topic__icon" aria-hidden>
                              {featured ? '★' : index + 1}
                            </span>
                            <span className="help-assistant-topic__body">
                              <span className="help-assistant-topic__title">{topic.title}</span>
                              <span className="help-assistant-topic__summary">{topic.summary}</span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              <footer className="help-assistant-footer">
                <span>
                  Press <kbd>Esc</kbd> to close
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="help-assistant-status__dot" aria-hidden />
                  Role-based tips
                </span>
              </footer>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`help-assistant-fab${open ? ' help-assistant-fab--open' : ''}`}
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
    <>
      <div className="help-assistant-detail">
        <button type="button" onClick={onBack} className="help-assistant-back">
          <ArrowLeft className="h-3.5 w-3.5" />
          All topics
        </button>
        <h3 className="help-assistant-detail__title">{topic.title}</h3>
        <p className="help-assistant-detail__summary">{topic.summary}</p>
        <ol className="help-assistant-detail__steps">
          {topic.steps.map((step, index) => (
            <li key={step} className="help-assistant-detail__step">
              <span className="help-assistant-detail__step-num">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
      {topic.href && (
        <footer className="help-assistant-detail-footer">
          <Link href={topic.href} onClick={onClose} className="help-assistant-cta">
            {topic.hrefLabel ?? 'Go there'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </footer>
      )}
    </>
  )
}
