import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getActiveMembership } from '@/lib/auth/session';
import { getAccounts } from '@/lib/accounting/queries';
import { ImportForm } from './import-form';

export const metadata = { title: 'Bulk upload transactions' };

export default async function ImportTransactionsPage() {
  const membership = await getActiveMembership();
  const accounts = membership
    ? await getAccounts(membership.organizationId)
    : [];

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/transactions"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Transactions
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">
        Bulk upload transactions
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Download the template, fill it in, then upload it here to record many
        transactions at once.
      </p>
      <div className="mt-6">
        <ImportForm
          accounts={accounts}
          currency={membership?.organization.currency ?? 'NGN'}
        />
      </div>
    </div>
  );
}
