'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

interface SidebarDropdownPanelProps {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  children: ReactNode
  className?: string
  width?: number
  /** When true, prefer opening to the right of the anchor (collapsed sidebar). */
  preferSide?: boolean
  onClose?: () => void
}

export function SidebarDropdownPanel({
  open,
  anchorRef,
  children,
  className = '',
  width = 256,
  preferSide = false,
  onClose,
}: SidebarDropdownPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' })

  useEffect(() => {
    setMounted(true)
  }, [])

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current
    const panel = panelRef.current
    if (!anchor || !panel) return

    const rect = anchor.getBoundingClientRect()
    const gap = 8
    const edge = 8
    const panelHeight = panel.offsetHeight
    const sidePreferred = preferSide || window.matchMedia('(min-width: 768px)').matches

    let left = rect.left
    let top = rect.bottom + gap

    if (sidePreferred) {
      const sideLeft = rect.right + gap
      if (sideLeft + width <= window.innerWidth - edge) {
        left = sideLeft
        top = rect.top
      }
    }

    left = Math.max(edge, Math.min(left, window.innerWidth - width - edge))

    if (top + panelHeight > window.innerHeight - edge) {
      const above = rect.top - gap - panelHeight
      top = above >= edge ? above : Math.max(edge, window.innerHeight - panelHeight - edge)
    }

    setStyle({
      position: 'fixed',
      top,
      left,
      width,
      zIndex: 200,
      visibility: 'visible',
    })
  }, [anchorRef, width, preferSide])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
  }, [open, updatePosition, children])

  useEffect(() => {
    if (!open || !onClose) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (anchorRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      onClose()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose, anchorRef])

  useEffect(() => {
    if (!open) return

    const onScrollOrResize = () => updatePosition()
    window.addEventListener('resize', onScrollOrResize)
    window.addEventListener('scroll', onScrollOrResize, true)
    return () => {
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('scroll', onScrollOrResize, true)
    }
  }, [open, updatePosition])

  if (!open || !mounted) return null

  return createPortal(
    <div ref={panelRef} className={className} style={style}>
      {children}
    </div>,
    document.body,
  )
}
