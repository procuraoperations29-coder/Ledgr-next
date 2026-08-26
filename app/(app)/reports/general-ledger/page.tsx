import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { requireSession } from '@/lib/auth/session';
import { getAccounts, getLedgerEntries } from '@/lib/accounting/queries';
import type { Account } from '@/lib/accounting/types';
import { EmptyState } from '@/components/ui/empty-state';
import { formatMoney, formatDate } from '@/lib/format';

export const metadata = { title: 'General Ledger' };

export default async function GeneralLedgerPage() {
  const session = await requireSession();

  if (!session.canViewReports) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Reports are restricted"
        description="You don't have permission to view financial reports. Ask an admin for access."
      />
    );
  }

  const currency = session.org.currency;
  const [accounts, entries] = await Promise.all([
    getAccounts(session.org.id, { includeArchived: true }),
    getLedgerEntries(session.org.id),
  ]);

  const accountsById = new Map<string, Account>(
    accounts.map((a) => [a.id, a as Account])
  );

  // Group entries by account, preserving date order.
  const byAccount = new Map<string, typeof entries>();
  for (const e of entries) {
    const bucket = byAccount.get(e.accountId);
    if (bucket) bucket.push(e);
    else byAccount.set(e.accountId, [e]);
  }

  const activeAccounts = accounts.filter((a) => byAccount.has(a.id));

  return (
    <div>
      <Link
        href="/reports"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Reports
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">General Ledger</h1>
        <p className="text-sm text-muted-foreground">
          Every posting, grouped by account.
        </p>
      </div>

      {activeAccounts.length === 0 ? (
        <EmptyState
          title="Nothing posted yet"
          description="Record transactions and they'll appear here, account by account."
        />
      ) : (
        <div className="space-y-6">
          {activeAccounts.map((account) => {
            const rows = byAccount.get(account.id)!;
            let running = 0;
            const debitNormal = account.normalBalance === 'debit';
            return (
              <section
                key={account.id}
                className="overflow-hidden rounded-lg border border-border bg-card"
              >
                <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
                  <h2 className="text-sm font-semibold">
                    <span className="tabular-nums text-muted-foreground">
                      {account.code}
                    </span>{' '}
                    {account.name}
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2 text-left font-medium">Date</th>
                        <th className="px-4 py-2 text-left font-medium">Description</th>
                        <th className="px-4 py-2 text-right font-medium">Debit</th>
                        <th className="px-4 py-2 text-right font-medium">Credit</th>
                        <th className="px-4 py-2 text-right font-medium">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((e, i) => {
                        running += debitNormal
                          ? e.debit - e.credit
                          : e.credit - e.debit;
                        return (
                          <tr key={i} className="border-b border-border last:border-0">
                            <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                              {formatDate(e.date, 'short')}
                            </td>
                            <td className="px-4 py-2">{e.description || '—'}</td>
                            <td className="px-4 py-2 text-right tabular-nums">
                              {e.debit ? formatMoney(e.debit, currency) : ''}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums">
                              {e.credit ? formatMoney(e.credit, currency) : ''}
                            </td>
                            <td className="px-4 py-2 text-right font-medium tabular-nums">
                              {formatMoney(running, currency)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
