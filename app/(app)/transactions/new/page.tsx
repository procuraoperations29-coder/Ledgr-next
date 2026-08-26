import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getActiveMembership } from '@/lib/auth/session';
import { getAccounts } from '@/lib/accounting/queries';
import { RecordForm } from './record-form';

export const metadata = { title: 'Record a transaction' };

export default async function NewTransactionPage() {
  const membership = await getActiveMembership();
  const accounts = membership
    ? await getAccounts(membership.organizationId)
    : [];

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/transactions"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Transactions
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Record a transaction</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter it in plain language — Ledgr does the accounting for you.
      </p>
      <div className="mt-6">
        <RecordForm
          accounts={accounts}
          currency={membership?.organization.currency ?? 'NGN'}
        />
      </div>
    </div>
  );
}
