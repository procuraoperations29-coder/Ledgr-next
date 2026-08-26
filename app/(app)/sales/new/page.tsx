import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getActiveMembership } from '@/lib/auth/session';
import { getAccounts } from '@/lib/accounting/queries';
import { getCustomers } from '@/lib/sme/queries';
import type { Account } from '@/lib/accounting/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { InvoiceForm } from './invoice-form';

export const metadata = { title: 'New invoice' };

export default async function NewInvoicePage() {
  const membership = await getActiveMembership();
  const orgId = membership?.organizationId;
  const [customers, accounts] = orgId
    ? await Promise.all([getCustomers(orgId), getAccounts(orgId)])
    : [[], []];
  const revenueAccounts = (accounts as Account[]).filter((a) => a.type === 'revenue');

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/sales"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Sales &amp; Invoices
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">New invoice</h1>

      <div className="mt-6">
        {customers.length === 0 ? (
          <EmptyState
            title="Add a customer first"
            description="You need at least one customer before you can raise an invoice."
            action={
              <Button asChild>
                <Link href="/customers">Go to customers</Link>
              </Button>
            }
          />
        ) : (
          <InvoiceForm
            customers={customers}
            revenueAccounts={revenueAccounts}
            currency={membership?.organization.currency ?? 'NGN'}
          />
        )}
      </div>
    </div>
  );
}
