import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { publicEnv, supabaseConfigured } from '@/config/env';

const ACTIVE_ORG_COOKIE = 'ledgr_active_org';

/**
 * App-group paths that require an org in good standing. Billing and support
 * stay reachable no matter the status, so a suspended/unpaid business can
 * always get back in by paying or asking for help.
 */
const GATED_PATHS = [
  '/dashboard', '/transactions', '/accounts', '/reports', '/sales',
  '/expenses', '/customers', '/suppliers', '/bank', '/inventory',
  '/team', '/notifications', '/settings',
];

function isGatedPath(pathname: string): boolean {
  return GATED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refresh the Supabase auth session on every request so Server Components
 * always see the current user. No-op until Supabase keys are configured.
 * Also blocks access to the working app (but not billing/support) for an
 * org whose service has been suspended or cancelled — e.g. for non-payment.
 */
export async function middleware(request: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL!,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && isGatedPath(request.nextUrl.pathname)) {
    const { data: memberships } = await supabase
      .from('organization_members')
      .select('organization_id, organizations!inner(status)')
      .eq('status', 'active');

    if (memberships && memberships.length > 0) {
      const activeOrgId = request.cookies.get(ACTIVE_ORG_COOKIE)?.value;
      const row =
        memberships.find((m) => m.organization_id === activeOrgId) ??
        memberships[0];
      let orgStatus = (row.organizations as unknown as { status: string })
        .status;

      // Best-effort: lazily flip a lapsed trial/renewal to 'suspended' so
      // the status is never just stale — there is no billing cron, so this
      // is the moment that actually enforces "no payment → suspended".
      const { data: synced } = await supabase.rpc('sync_org_billing_status', {
        p_org: row.organization_id,
      });
      if (typeof synced === 'string') orgStatus = synced;

      if (orgStatus === 'suspended' || orgStatus === 'cancelled' || orgStatus === 'past_due') {
        const url = request.nextUrl.clone();
        url.pathname = '/billing';
        url.search = '';
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
