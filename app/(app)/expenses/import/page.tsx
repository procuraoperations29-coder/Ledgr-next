import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getActiveMembership } from '@/lib/auth/session';
import { getAccounts } from '@/lib/accounting/queries';
import { getSuppliers } from '@/lib/sme/queries';
import type { Account } from '@/lib/accounting/types';
import { ImportForm } from './import-form';

export const metadata = { title: 'Bulk upload expenses' };

export default async function ImportExpensesPage() {
  const membership = await getActiveMembership();
  const orgId = membership?.organizationId;

  const [accounts, suppliers] = orgId
    ? await Promise.all([getAccounts(orgId), getSuppliers(orgId)])
    : [[], []];

  const categories = (accounts as Account[]).filter(
    (a) => a.type === 'expense' || a.type === 'cost_of_sales'
  );
  const paymentAccounts = (accounts as Account[]).filter((a) => a.isBankOrCash);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/expenses"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Expenses
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">
        Bulk upload expenses
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Download the template, fill it in, then upload it here to record many
        expenses at once.
      </p>
      <div className="mt-6">
        <ImportForm
          categories={categories}
          paymentAccounts={paymentAccounts}
          suppliers={suppliers}
          currency={membership?.organization.currency ?? 'NGN'}
        />
      </div>
    </div>
  );
}
