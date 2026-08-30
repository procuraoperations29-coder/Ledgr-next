'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/nav';
import { LogoMark } from '@/components/brand/logo';
import { cn } from '@/lib/utils';

export function AppSidebar({ logoUrl }: { logoUrl?: string | null }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b border-border px-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 font-semibold">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo" className="size-8 rounded-lg object-contain" />
          ) : (
            <>
              <LogoMark className="size-8" />
              Ledgr
            </>
          )}
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + '/');
          if (!item.ready) {
            return (
              <span
                key={item.href}
                className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/60"
              >
                <item.icon className="size-4" />
                {item.label}
                <span className="ml-auto rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                  Soon
                </span>
              </span>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
