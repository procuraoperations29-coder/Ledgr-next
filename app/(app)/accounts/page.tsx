import { BookOpen } from 'lucide-react';
import { getActiveMembership } from '@/lib/auth/session';
import { getAccounts, getLedgerLines } from '@/lib/accounting/queries';
import { accountBalance } from '@/lib/accounting/reports';
import type { Account, AccountType } from '@/lib/accounting/types';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatMoney } from '@/lib/format';
import { AddAccountDialog } from './add-account-dialog';

export const metadata = { title: 'Chart of Accounts' };

const GROUPS: { type: AccountType; label: string }[] = [
  { type: 'asset', label: 'Assets' },
  { type: 'liability', label: 'Liabilities' },
  { type: 'equity', label: 'Equity' },
  { type: 'revenue', label: 'Revenue' },
  { type: 'cost_of_sales', label: 'Cost of Sales' },
  { type: 'expense', label: 'Operating Expenses' },
];

export default async function AccountsPage() {
  const membership = await getActiveMembership();
  const currency = membership?.organization.currency ?? 'NGN';
  const orgId = membership?.organizationId;

  const [accounts, ledger] = orgId
    ? await Promise.all([
        getAccounts(orgId, { includeArchived: true }),
        getLedgerLines(orgId),
      ])
    : [[], { lines: [], byJournal: new Map() }];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Chart of Accounts
          </h1>
          <p className="text-sm text-muted-foreground">
            The categories your money is organised into.
          </p>
        </div>
        <AddAccountDialog />
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No accounts yet"
          description="Finish setting up your business to generate your chart of accounts."
        />
      ) : (
        <div className="space-y-6">
          {GROUPS.map((group) => {
            const groupAccounts = accounts.filter((a) => a.type === group.type);
            if (groupAccounts.length === 0) return null;
            return (
              <section key={group.type}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </h2>
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  {groupAccounts.map((account) => {
                    const balance = accountBalance(
                      account as Account,
                      ledger.lines
                    );
                    return (
                      <div
                        key={account.id}
                        className="flex items-center justify-between border-b border-border px-4 py-3 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-12 text-xs tabular-nums text-muted-foreground">
                            {account.code}
                          </span>
                          <div>
                            <p className="text-sm font-medium">
                              {account.plainName || account.name}
                            </p>
                            {account.plainName &&
                              account.plainName !== account.name && (
                                <p className="text-xs text-muted-foreground">
                                  {account.name}
                                </p>
                              )}
                          </div>
                          {!account.isActive && (
                            <Badge variant="secondary">Archived</Badge>
                          )}
                        </div>
                        <span className="font-medium tabular-nums">
                          {formatMoney(balance, currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
