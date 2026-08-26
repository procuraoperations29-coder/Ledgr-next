import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
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
      </body>
    </html>
  );
}
