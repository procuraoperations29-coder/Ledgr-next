import { requireSession } from '@/lib/auth/session';
import { isPlatformAdmin } from '@/lib/admin/guard';
import { getUnreadCount } from '@/lib/notify';
import { createClient } from '@/lib/supabase/server';
import { hexToHslTriplet, readableForeground } from '@/lib/branding';
import { AppSidebar } from '@/components/app-shell/app-sidebar';
import { AppMobileNav } from '@/components/app-shell/app-mobile-nav';
import { UserMenu } from '@/components/app-shell/user-menu';
import { NotificationBell } from '@/components/app-shell/notification-bell';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const supabase = await createClient();

  const [unread, admin, { data: brand }] = await Promise.all([
    getUnreadCount(session.org.id),
    isPlatformAdmin(),
    supabase
      .from('organizations')
      .select('brand_color, logo_url')
      .eq('id', session.org.id)
      .maybeSingle(),
  ]);

  // Apply the org's brand colour by overriding the primary design token.
  const hsl = brand?.brand_color ? hexToHslTriplet(brand.brand_color) : null;
  const brandStyle = hsl
    ? `:root{--primary:${hsl};--ring:${hsl};--primary-foreground:${readableForeground(brand!.brand_color)};}`
    : null;

  return (
    <>
      {brandStyle && <style dangerouslySetInnerHTML={{ __html: brandStyle }} />}
      <div className="flex min-h-dvh bg-secondary/30">
        <AppSidebar logoUrl={brand?.logo_url ?? null} />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur sm:px-6">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{session.org.name}</p>
              <p className="text-xs capitalize text-muted-foreground">
                {session.role}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell count={unread} />
              <UserMenu
                name={session.fullName}
                email={session.email}
                orgName={session.org.name}
                isPlatformAdmin={admin}
              />
            </div>
          </header>

          {/* Page body — bottom padding leaves room for the mobile nav */}
          <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>

        <AppMobileNav />
      </div>
    </>
  );
}
