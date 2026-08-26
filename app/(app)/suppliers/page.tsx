import { Truck, Mail, Phone } from 'lucide-react';
import { getActiveMembership } from '@/lib/auth/session';
import { getSuppliers } from '@/lib/sme/queries';
import { EmptyState } from '@/components/ui/empty-state';
import { AddPartyDialog } from '@/components/sme/add-party-dialog';
import { ImportCsvDialog } from '@/components/sme/import-csv-dialog';
import { createSupplierAction, importSuppliersAction } from './actions';

export const metadata = { title: 'Suppliers' };

export default async function SuppliersPage() {
  const membership = await getActiveMembership();
  const suppliers = membership ? await getSuppliers(membership.organizationId) : [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground">
            The people and businesses you buy from.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportCsvDialog
            title="Import suppliers"
            description="Upload a CSV to add suppliers in bulk."
            templateName="suppliers-template.csv"
            templateHeaders={['name', 'email', 'phone', 'address']}
            sampleRow={['Fresh Farms Ltd', 'sales@freshfarms.ng', '0805 333 4444', 'Ibadan']}
            action={importSuppliersAction}
          />
          <AddPartyDialog
            title="New supplier"
            triggerLabel="Add supplier"
            action={createSupplierAction}
          />
        </div>
      </div>

      {suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No suppliers yet"
          description="Add a supplier so you can track your expenses and what you owe them."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => (
            <div key={s.id} className="rounded-lg border border-border bg-card p-4">
              <p className="font-medium">{s.name}</p>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                {s.email && (
                  <p className="flex items-center gap-2">
                    <Mail className="size-3.5" /> {s.email}
                  </p>
                )}
                {s.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="size-3.5" /> {s.phone}
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
