'use client'

import Image from 'next/image'
import { Users } from 'lucide-react'

type MessengerAvatarSize = 'xs' | 'sm' | 'lg'

interface MessengerAvatarProps {
  name: string
  imageUrl?: string | null
  size?: MessengerAvatarSize
  variant?: 'person' | 'group'
  className?: string
}

const sizeClass: Record<MessengerAvatarSize, string> = {
  xs: 'staff-messenger__avatar staff-messenger__avatar--xs',
  sm: 'staff-messenger__avatar',
  lg: 'staff-messenger__avatar staff-messenger__avatar--lg',
}

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?'
}

export function MessengerAvatar({
  name,
  imageUrl,
  size = 'sm',
  variant = 'person',
  className = '',
}: MessengerAvatarProps) {
  const classes = `${sizeClass[size]} ${className}`.trim()

  if (variant === 'group') {
    return (
      <div className={classes} aria-hidden>
        <Users className="h-4 w-4" />
      </div>
    )
  }

  if (imageUrl) {
    return (
      <div className={`${classes} staff-messenger__avatar--photo`} aria-hidden>
        <Image src={imageUrl} alt="" fill className="object-cover" sizes="44px" />
      </div>
    )
  }

  return (
    <div className={classes} aria-hidden>
      {initial(name)}
    </div>
  )
}
