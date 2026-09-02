import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { RegisterSW } from '@/components/pwa/register-sw';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Ledgr — Know Your Numbers. Run Your Business.',
    template: '%s · Ledgr',
  },
  description:
    'Record your transactions, track your money and automatically generate professional management accounts, P&L, balance sheets and cash flow statements.',
  applicationName: 'Ledgr',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Ledgr' },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0C8D62',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans text-foreground">
        {children}
        <Toaster richColors position="top-center" />
        <RegisterSW />
      </body>
    </html>
  );
}
