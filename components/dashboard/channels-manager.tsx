'use client'

import { AlertCircle, CheckCircle, Link2, Unlink2, Settings, TrendingUp } from 'lucide-react'

const CHANNELS = [
  {
    id: 'website',
    name: 'Website',
    status: 'connected',
    bookings: 18,
    revenue: 6800,
    lastSync: '2 minutes ago',
    listingsCount: 4,
    icon: '🌐',
  },
  {
    id: 'airbnb',
    name: 'Airbnb',
    status: 'connected',
    bookings: 12,
    revenue: 5200,
    lastSync: '5 minutes ago',
    listingsCount: 2,
    icon: '🏠',
  },
  {
    id: 'booking',
    name: 'Booking.com',
    status: 'connected',
    bookings: 8,
    revenue: 3200,
    lastSync: '15 minutes ago',
    listingsCount: 3,
    icon: '📅',
  },
  {
    id: 'expedia',
    name: 'Expedia',
    status: 'disconnected',
    bookings: 0,
    revenue: 0,
    lastSync: null,
    listingsCount: 0,
    icon: '✈️',
  },
]

export function ChannelsManager() {
  const getStatusBadge = (status: string) => {
    if (status === 'connected') {
      return 'bg-amber-100 text-amber-700'
    }
    return 'bg-gray-100 text-gray-700'
  }

  const totalBookings = CHANNELS.filter((ch) => ch.status === 'connected').reduce((sum, ch) => sum + ch.bookings, 0)

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="surface-card stat-tile stat-tile-primary p-6">
          <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Active Channels</p>
          <p className="text-4xl font-bold text-foreground mt-3">3</p>
          <p className="text-xs text-muted-foreground mt-2">of 4 channels enabled</p>
        </div>

        <div className="surface-card stat-tile stat-tile-blue p-6">
          <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Total Bookings</p>
          <p className="text-4xl font-bold text-foreground mt-3">{totalBookings}</p>
          <div className="flex items-center gap-2 mt-3 text-blue-600 text-sm font-medium">
            <TrendingUp className="h-4 w-4" />
            Across all channels
          </div>
        </div>

        <div className="surface-card stat-tile stat-tile-orange p-6">
          <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Sync Status</p>
          <div className="flex items-center gap-2 mt-3">
            <CheckCircle className="h-6 w-6 text-amber-600" />
            <span className="font-semibold text-foreground">All channels live</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Last sync: 2 minutes ago</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {CHANNELS.map((channel) => (
          <div key={channel.id} className="surface-card overflow-hidden">
            <div className={`surface-card-header ${channel.status === 'connected' ? 'bg-[#FAFDFF]/80' : 'bg-secondary/20'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-4xl">{channel.icon}</span>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">{channel.name}</h3>
                    <span className={`inline-block text-xs px-3 py-1.5 rounded-full font-semibold mt-2 ${getStatusBadge(channel.status)}`}>
                      {channel.status === 'connected' ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>
                <button className="inline-flex items-center justify-center w-10 h-10 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                  <Settings className="h-5 w-5" />
                </button>
              </div>
            </div>

            {channel.status === 'connected' ? (
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="surface-inset p-4 rounded-xl">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Bookings</p>
                    <p className="text-2xl font-bold text-foreground mt-2">{channel.bookings}</p>
                  </div>
                  <div className="surface-inset p-4 rounded-xl">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Revenue</p>
                    <p className="text-2xl font-bold text-foreground mt-2">₵{channel.revenue}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="surface-inset p-3 rounded-xl">
                    <p className="text-xs text-muted-foreground">Listings</p>
                    <p className="text-lg font-bold text-foreground mt-1">{channel.listingsCount}</p>
                  </div>
                  <div className="surface-inset p-3 rounded-xl">
                    <p className="text-xs text-muted-foreground">Last Sync</p>
                    <p className="text-sm font-semibold text-foreground mt-1">{channel.lastSync}</p>
                  </div>
                </div>

                <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-50/80 text-red-600 rounded-xl hover:bg-red-100/80 font-semibold transition-colors shadow-elevation-1">
                  <Unlink2 className="h-4 w-4" />
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="p-6">
                <p className="text-sm text-muted-foreground mb-4">Connect {channel.name} to start accepting bookings from this platform.</p>
                <button className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-lg hover:shadow-elevation-2 font-semibold transition-all hover:-translate-y-0.5">
                  <Link2 className="h-4 w-4" />
                  Connect Channel
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
