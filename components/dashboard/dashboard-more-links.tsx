import Link from 'next/link'
import { BarChart3, FileText, Moon, Star, ChevronRight } from 'lucide-react'

interface DashboardMoreLinksProps {
  showGuestReviews?: boolean
  showNightAudit?: boolean
  todayClosed?: boolean
}

const links = [
  {
    href: '/owner/analytics',
    icon: BarChart3,
    label: 'Analytics',
    description: 'Trends and performance',
  },
  {
    href: '/owner/gra-reports',
    icon: FileText,
    label: 'GRA reports',
    description: 'Tax and compliance',
  },
]

export function DashboardMoreLinks({
  showGuestReviews = false,
  showNightAudit = false,
  todayClosed = false,
}: DashboardMoreLinksProps) {
  const items = [...links]

  if (showGuestReviews) {
    items.push({
      href: '/owner/dashboard#guest-reviews',
      icon: Star,
      label: 'Guest reviews',
      description: 'Portal feedback',
    })
  }

  if (showNightAudit) {
    items.push({
      href: '/owner/dashboard#night-audit',
      icon: Moon,
      label: 'Night audit',
      description: todayClosed ? 'Today closed' : 'End of day',
    })
  }

  return (
    <section className="dashboard-more" aria-label="More modules">
      <p className="dashboard-more__label">More</p>
      <div className="dashboard-more__grid">
        {items.map(({ href, icon: Icon, label, description }) => (
          <Link key={href} href={href} className="dashboard-more__item">
            <span className="dashboard-more__icon">
              <Icon className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">{label}</span>
              <span className="block text-xs text-muted-foreground">{description}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </section>
  )
}
