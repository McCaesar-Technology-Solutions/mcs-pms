import type { TimelineBarSource } from '@/lib/data/occupancy-timeline'

export const TIMELINE_SOURCE_STYLES: Record<
  TimelineBarSource,
  { cell: string; legend: string; label: string }
> = {
  website: { cell: 'bg-[#3C216C] text-white', legend: 'bg-[#3C216C]', label: 'Website' },
  airbnb: { cell: 'bg-sky-600 text-white', legend: 'bg-sky-600', label: 'Airbnb' },
  booking: { cell: 'bg-[#2D215B] text-white', legend: 'bg-[#2D215B]', label: 'Booking.com' },
  walk_in: { cell: 'bg-[#D4A62E] text-[#22124C]', legend: 'bg-[#D4A62E]', label: 'Walk-in' },
  in_house: { cell: 'bg-emerald-600 text-white', legend: 'bg-emerald-600', label: 'In-house stay' },
  other: { cell: 'bg-gray-500 text-white', legend: 'bg-gray-500', label: 'Other' },
}

export function timelineSourceStyle(source: TimelineBarSource) {
  return TIMELINE_SOURCE_STYLES[source] ?? TIMELINE_SOURCE_STYLES.other
}
