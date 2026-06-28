'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'

export type RealtimeTopic =
  | 'complaints'
  | 'housekeeping'
  | 'layout'
  | 'messages'
  | 'guest_portal'

type Listener = () => void

interface RealtimeRefreshContextValue {
  subscribe: (topic: RealtimeTopic, listener: Listener) => () => void
  publish: (topics: RealtimeTopic | RealtimeTopic[]) => void
}

const RealtimeRefreshContext = createContext<RealtimeRefreshContextValue | null>(null)

export function RealtimeRefreshProvider({ children }: { children: ReactNode }) {
  const listenersRef = useRef<Map<RealtimeTopic, Set<Listener>>>(new Map())

  const subscribe = useCallback((topic: RealtimeTopic, listener: Listener) => {
    let set = listenersRef.current.get(topic)
    if (!set) {
      set = new Set()
      listenersRef.current.set(topic, set)
    }
    set.add(listener)
    return () => {
      set!.delete(listener)
    }
  }, [])

  const publish = useCallback((topics: RealtimeTopic | RealtimeTopic[]) => {
    const list = Array.isArray(topics) ? topics : [topics]
    for (const topic of list) {
      listenersRef.current.get(topic)?.forEach((fn) => fn())
    }
  }, [])

  const value = useMemo(() => ({ subscribe, publish }), [subscribe, publish])

  return (
    <RealtimeRefreshContext.Provider value={value}>{children}</RealtimeRefreshContext.Provider>
  )
}

export function useRealtimeRefreshContext() {
  const ctx = useContext(RealtimeRefreshContext)
  if (!ctx) {
    throw new Error('useRealtimeRefreshContext must be used within RealtimeRefreshProvider')
  }
  return ctx
}

/** Subscribe to realtime refresh events. No-op when no provider is mounted. */
export function useRealtimeRefresh(topic: RealtimeTopic, onRefresh: () => void) {
  const ctx = useContext(RealtimeRefreshContext)

  useEffect(() => {
    if (!ctx) return
    return ctx.subscribe(topic, onRefresh)
  }, [ctx, topic, onRefresh])
}
