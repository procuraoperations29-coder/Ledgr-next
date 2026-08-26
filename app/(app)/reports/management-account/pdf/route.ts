import { type NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { buildManagementAccount } from '@/lib/accounting/management';
import { resolvePeriod, previousPeriod, isPeriodType } from '@/lib/accounting/periods';
import { renderManagementAccountPdf } from '../management-account-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (!session.canViewReports) {
    return new Response('Not authorised', { status: 403 });
  }

  const periodParam = request.nextUrl.searchParams.get('period') ?? undefined;
  const period = isPeriodType(periodParam) ? periodParam : 'this_month';
  const range = resolvePeriod(period, new Date());
  const prevRange = previousPeriod(period, new Date());

  const data = await buildManagementAccount(session.org.id, range, prevRange, {
    businessName: session.org.name,
    currency: session.org.currency,
  });

  const pdf = await renderManagementAccountPdf(data);
  const safeName = session.org.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="management-account-${safeName}-${range.from}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
