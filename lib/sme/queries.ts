import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface Party {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  is_active: boolean;
}

export async function getCustomers(orgId: string): Promise<Party[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('customers')
    .select('id, name, email, phone, address, is_active')
    .eq('organization_id', orgId)
    .order('name');
  return (data as Party[]) ?? [];
}

export async function getSuppliers(orgId: string): Promise<Party[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('suppliers')
    .select('id, name, email, phone, address, is_active')
    .eq('organization_id', orgId)
    .order('name');
  return (data as Party[]) ?? [];
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  cost_price: number;
  sell_price: number;
  track_inventory: boolean;
  qty_on_hand: number;
  is_active: boolean;
}

export async function getProducts(orgId: string): Promise<Product[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('products')
    .select('id, name, sku, cost_price, sell_price, track_inventory, qty_on_hand, is_active')
    .eq('organization_id', orgId)
    .order('name');
  return (data as Product[]) ?? [];
}

export interface InvoiceListRow {
  id: string;
  number: string;
  issue_date: string;
  due_date: string | null;
  status: string;
  total: number;
  amount_paid: number;
  customer: { name: string } | null;
}

export async function getInvoices(orgId: string): Promise<InvoiceListRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('invoices')
    .select(
      'id, number, issue_date, due_date, status, total, amount_paid, customer:customers(name)'
    )
    .eq('organization_id', orgId)
    .order('issue_date', { ascending: false })
    .order('created_at', { ascending: false });
  return (data as unknown as InvoiceListRow[]) ?? [];
}

export interface InvoiceDetail extends InvoiceListRow {
  subtotal: number;
  tax: number;
  discount: number;
  notes: string | null;
  customer_id: string;
  lines: {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    line_total: number;
  }[];
  payments: { id: string; amount: number; txn_date: string; method: string | null }[];
}

export async function getInvoice(
  orgId: string,
  id: string
): Promise<InvoiceDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('invoices')
    .select(
      `id, number, issue_date, due_date, status, subtotal, tax, discount, total,
       amount_paid, notes, customer_id, customer:customers(name),
       lines:invoice_lines(id, description, quantity, unit_price, tax_rate, line_total),
       payments:payments(id, amount, txn_date, method)`
    )
    .eq('organization_id', orgId)
    .eq('id', id)
    .single();
  return (data as unknown as InvoiceDetail) ?? null;
}

export interface ExpenseRow {
  id: string;
  txn_date: string;
  amount: number;
  description: string | null;
  vendor: string | null;
  on_credit: boolean;
  status: string;
  category: { name: string; plain_name: string | null } | null;
  supplier: { name: string } | null;
}

export async function getExpenses(orgId: string): Promise<ExpenseRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('expenses')
    .select(
      `id, txn_date, amount, description, vendor, on_credit, status,
       category:accounts!expenses_category_account_id_fkey(name, plain_name),
       supplier:suppliers(name)`
    )
    .eq('organization_id', orgId)
    .order('txn_date', { ascending: false });
  return (data as unknown as ExpenseRow[]) ?? [];
}
