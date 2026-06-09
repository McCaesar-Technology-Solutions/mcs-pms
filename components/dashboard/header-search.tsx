import { Search } from 'lucide-react'

interface HeaderSearchProps {
  className?: string
}

export function HeaderSearch({ className = '' }: HeaderSearchProps) {
  return (
    <div className={`header-search-glass relative h-10 w-full rounded-xl ${className}`.trim()}>
      <Search className="header-search-icon pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
      <input
        type="search"
        placeholder="Search guests, bookings, rooms..."
        className="header-search-glass__input h-full w-full rounded-xl pl-10 pr-4 text-sm outline-none focus:outline-none focus:ring-0"
      />
    </div>
  )
}
