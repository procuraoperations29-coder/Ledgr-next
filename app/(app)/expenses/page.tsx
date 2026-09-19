import Link from 'next/link';
import { ReceiptText, Upload } from 'lucide-react';
import { getActiveMembership } from '@/lib/auth/session';
import { getAccounts } from '@/lib/accounting/queries';
import { getExpenses, getSuppliers } from '@/lib/sme/queries';
import type { Account } from '@/lib/accounting/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMoney, formatDate } from '@/lib/format';
import { RecordExpenseDialog } from './record-expense-dialog';
import { ExpenseRowActions } from '@/components/expenses/row-actions';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Expenses' };

export default async function ExpensesPage() {
  const membership = await getActiveMembership();
  const currency = membership?.organization.currency ?? 'NGN';
  const orgId = membership?.organizationId;

  const [accounts, expenses, suppliers] = orgId
    ? await Promise.all([
        getAccounts(orgId),
        getExpenses(orgId),
        getSuppliers(orgId),
      ])
    : [[], [], []];

  const categories = (accounts as Account[]).filter(
    (a) => a.type === 'expense' || a.type === 'cost_of_sales'
  );
  const paymentAccounts = (accounts as Account[]).filter((a) => a.isBankOrCash);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Track what you spend, and on what.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/expenses/import">
              <Upload className="size-4" /> Bulk Upload
            </Link>
          </Button>
          <RecordExpenseDialog
            categories={categories}
            paymentAccounts={paymentAccounts}
            suppliers={suppliers}
            currency={currency}
          />
        </div>
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="No expenses yet"
          description="Record an expense to keep track of your spending and keep your reports accurate."
        />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => {
                const reversed = e.status === 'reversed';
                return (
                <TableRow key={e.id} className={cn(reversed && 'opacity-50')}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(e.txn_date, 'short')}
                  </TableCell>
                  <TableCell>
                    <div className={cn('font-medium', reversed && 'line-through')}>
                      {e.description ||
                        e.category?.plain_name ||
                        e.category?.name ||
                        'Expense'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {e.supplier?.name || e.vendor || '—'}
                      {reversed && (
                        <Badge variant="default" className="ml-2">
                          Deleted
                        </Badge>
                      )}
                      {!reversed && e.on_credit && (
                        <Badge variant="warning" className="ml-2">
                          {e.status === 'unpaid' ? 'Unpaid' : 'On credit'}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {e.category?.plain_name || e.category?.name}
                  </TableCell>
                  <TableCell className={cn('text-right font-semibold tabular-nums', reversed && 'line-through')}>
                    {formatMoney(e.amount, currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {!reversed && (
                      <ExpenseRowActions
                        id={e.id}
                        label={
                          e.description ||
                          e.category?.plain_name ||
                          e.category?.name ||
                          'Expense'
                        }
                      />
                    )}
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
