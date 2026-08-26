import { Package } from 'lucide-react';
import { getActiveMembership } from '@/lib/auth/session';
import { getProducts } from '@/lib/sme/queries';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMoney } from '@/lib/format';
import { AddProductDialog } from './add-product-dialog';
import { ImportCsvDialog } from '@/components/sme/import-csv-dialog';
import { importProductsAction } from './actions';

export const metadata = { title: 'Inventory' };

const LOW_STOCK_THRESHOLD = 5;

export default async function InventoryPage() {
  const membership = await getActiveMembership();
  const currency = membership?.organization.currency ?? 'NGN';
  const products = membership ? await getProducts(membership.organizationId) : [];

  const tracked = products.filter((p) => p.track_inventory);
  const inventoryValue = tracked.reduce(
    (sum, p) => sum + Math.round(p.qty_on_hand * p.cost_price),
    0
  );
  const lowStock = tracked.filter((p) => p.qty_on_hand <= LOW_STOCK_THRESHOLD);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            The products you buy and sell.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportCsvDialog
            title="Import products"
            description="Upload a CSV to add products in bulk."
            templateName="products-template.csv"
            templateHeaders={['name', 'sku', 'cost', 'price', 'quantity']}
            sampleRow={['Jollof Rice Pack', 'JR-001', '1200', '2500', '50']}
            action={importProductsAction}
          />
          <AddProductDialog />
        </div>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description="Add products to use them on invoices and, optionally, track stock levels."
        />
      ) : (
        <>
          {tracked.length > 0 && (
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Inventory value</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {formatMoney(inventoryValue, currency)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Low-stock products</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {lowStock.length}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden sm:table-cell">SKU</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">In stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {p.sku || '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.cost_price, currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.sell_price, currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.track_inventory ? (
                        <span
                          className={
                            p.qty_on_hand <= LOW_STOCK_THRESHOLD
                              ? 'font-medium text-warning-foreground'
                              : ''
                          }
                        >
                          {p.qty_on_hand}
                          {p.qty_on_hand <= LOW_STOCK_THRESHOLD && (
                            <Badge variant="warning" className="ml-2">
                              Low
                            </Badge>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
