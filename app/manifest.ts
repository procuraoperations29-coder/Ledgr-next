import type { MetadataRoute } from 'next';

// Brand green — matches --primary (hsl(160 84% 30%)).
const THEME = '#0C8D62';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ledgr — Know Your Numbers',
    short_name: 'Ledgr',
    description:
      'Record transactions, track your money and generate professional management accounts, P&L, balance sheets and cash flow — for Nigerian SMEs.',
    id: '/',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: THEME,
    categories: ['finance', 'business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Dashboard', url: '/dashboard' },
      { name: 'Record transaction', url: '/transactions/new' },
      { name: 'Reports', url: '/reports' },
    ],
  };
}
