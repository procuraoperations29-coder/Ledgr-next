import { Landmark, Wallet, Banknote } from 'lucide-react';
import { getActiveMembership } from '@/lib/auth/session';
import { getAccounts, getLedgerLines } from '@/lib/accounting/queries';
import { accountBalance } from '@/lib/accounting/reports';
import type { Account } from '@/lib/accounting/types';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { formatMoney } from '@/lib/format';
import { AddBankDialog } from './add-bank-dialog';

export const metadata = { title: 'Bank & Cash' };

export default async function BankPage() {
  const membership = await getActiveMembership();
  const currency = membership?.organization.currency ?? 'NGN';
  const orgId = membership?.organizationId;

  const [accounts, ledger] = orgId
    ? await Promise.all([getAccounts(orgId), getLedgerLines(orgId)])
    : [[], { lines: [], byJournal: new Map() }];

  const bankAccounts = (accounts as Account[]).filter((a) => a.isBankOrCash);
  const total = bankAccounts.reduce(
    (sum, a) => sum + accountBalance(a, ledger.lines),
    0
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bank &amp; Cash</h1>
          <p className="text-sm text-muted-foreground">
            Everywhere your money is held.
          </p>
        </div>
        <AddBankDialog currency={currency} />
      </div>

      {bankAccounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No accounts yet"
          description="Add a bank or cash account to start tracking your money."
        />
      ) : (
        <>
          <Card className="mb-4 border-primary/30">
            <CardContent className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Wallet className="size-5" />
                </div>
                <span className="text-sm text-muted-foreground">Total cash position</span>
              </div>
              <span className="text-2xl font-semibold tabular-nums">
                {formatMoney(total, currency)}
              </span>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bankAccounts.map((a) => (
              <Card key={a.id}>
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                      {a.subtype === 'cash' ? (
                        <Banknote className="size-4" />
                      ) : (
                        <Landmark className="size-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{a.plainName || a.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {a.subtype}
                      </p>
                    </div>
                  </div>
                  <p className="text-xl font-semibold tabular-nums">
                    {formatMoney(accountBalance(a, ledger.lines), currency)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
