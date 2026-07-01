import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'MOJO Apartments',
    short_name: 'MOJO',
    description:
      'Property management for MOJO Apartments — owners, managers, and staff.',
    start_url: '/login',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#22124c',
    theme_color: '#22124c',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
