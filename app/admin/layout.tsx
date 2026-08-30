import Link from 'next/link';
import { LayoutDashboard, Building2, LifeBuoy, ExternalLink } from 'lucide-react';
import { requirePlatformAdmin } from '@/lib/admin/guard';
import { LogoMark } from '@/components/brand/logo';

export const metadata = { title: 'Ledgr Admin' };

const NAV = [
  { label: 'Overview', href: '/admin', icon: LayoutDashboard },
  { label: 'Businesses', href: '/admin/organizations', icon: Building2 },
  { label: 'Support', href: '/admin/tickets', icon: LifeBuoy },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePlatformAdmin();

  return (
    <div className="min-h-dvh bg-secondary/30">
      <header className="sticky top-0 z-20 border-b border-border bg-[#0b1620] text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <span className="inline-flex items-center gap-2 font-semibold">
              <LogoMark className="size-7" />
              Ledgr <span className="text-white/50">Admin</span>
            </span>
            <nav className="hidden items-center gap-1 sm:flex">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <n.icon className="size-4" />
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white"
          >
            Exit to app <ExternalLink className="size-3.5" />
          </Link>
        </div>
      </header>

      {/* Mobile nav */}
      <nav className="flex items-center gap-1 overflow-x-auto border-b border-border bg-[#0b1620] px-4 pb-2 sm:hidden">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-white/70 hover:text-white"
          >
            <n.icon className="size-4" />
            {n.label}
          </Link>
        ))}
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
