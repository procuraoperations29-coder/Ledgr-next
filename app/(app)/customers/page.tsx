import { Users, Mail, Phone } from 'lucide-react';
import { getActiveMembership } from '@/lib/auth/session';
import { getCustomers } from '@/lib/sme/queries';
import { EmptyState } from '@/components/ui/empty-state';
import { AddPartyDialog } from '@/components/sme/add-party-dialog';
import { ImportCsvDialog } from '@/components/sme/import-csv-dialog';
import { createCustomerAction, importCustomersAction } from './actions';

export const metadata = { title: 'Customers' };

export default async function CustomersPage() {
  const membership = await getActiveMembership();
  const customers = membership ? await getCustomers(membership.organizationId) : [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            The people and businesses you sell to.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportCsvDialog
            title="Import customers"
            description="Upload a CSV to add customers in bulk."
            templateName="customers-template.csv"
            templateHeaders={['name', 'email', 'phone', 'address']}
            sampleRow={['ABC Limited', 'accounts@abc.ng', '0803 111 2222', 'Lagos']}
            action={importCustomersAction}
          />
          <AddPartyDialog
            title="New customer"
            triggerLabel="Add customer"
            action={createCustomerAction}
          />
        </div>
      </div>

      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="Add a customer so you can invoice them and track what they owe you."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => (
            <div
              key={c.id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <p className="font-medium">{c.name}</p>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                {c.email && (
                  <p className="flex items-center gap-2">
                    <Mail className="size-3.5" /> {c.email}
                  </p>
                )}
                {c.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="size-3.5" /> {c.phone}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
