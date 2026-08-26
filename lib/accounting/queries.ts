import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Account, JournalLine } from './types';

interface AccountRow {
  id: string;
  code: string;
  name: string;
  plain_name: string | null;
  type: Account['type'];
  subtype: string | null;
  normal_balance: Account['normalBalance'];
  is_bank_or_cash: boolean;
  is_active: boolean;
}

function mapAccount(r: AccountRow): Account & { isActive: boolean } {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    plainName: r.plain_name,
    type: r.type,
    subtype: r.subtype,
    normalBalance: r.normal_balance,
    isBankOrCash: r.is_bank_or_cash,
    isActive: r.is_active,
  };
}

/** Chart of accounts for the org (active + archived), ordered by code. */
export async function getAccounts(
  orgId: string,
  opts: { includeArchived?: boolean } = {}
): Promise<(Account & { isActive: boolean })[]> {
  const supabase = await createClient();
  let query = supabase
    .from('accounts')
    .select(
      'id, code, name, plain_name, type, subtype, normal_balance, is_bank_or_cash, is_active'
    )
    .eq('organization_id', orgId)
    .order('code', { ascending: true });

  if (!opts.includeArchived) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as AccountRow[]).map(mapAccount);
}

export interface LedgerData {
  lines: JournalLine[];
  byJournal: Map<string, JournalLine[]>;
}

interface LineRow {
  account_id: string;
  debit: number;
  credit: number;
  journals: {
    id: string;
    entry_date: string;
    status: string;
  } | null;
}

/**
 * Ledger lines for the org, excluding drafts. Optional inclusive date bounds
 * (ISO yyyy-mm-dd). Callers pass `to` alone for as-at reports (balance sheet)
 * and both for period reports (P&L, cash flow).
 */
export async function getLedgerLines(
  orgId: string,
  opts: { from?: string; to?: string } = {}
): Promise<LedgerData> {
  const supabase = await createClient();
  let query = supabase
    .from('journal_lines')
    .select('account_id, debit, credit, journals!inner(id, entry_date, status)')
    .eq('organization_id', orgId)
    .neq('journals.status', 'draft');

  if (opts.from) query = query.gte('journals.entry_date', opts.from);
  if (opts.to) query = query.lte('journals.entry_date', opts.to);

  const { data, error } = await query;
  if (error || !data) return { lines: [], byJournal: new Map() };

  const lines: JournalLine[] = [];
  const byJournal = new Map<string, JournalLine[]>();

  for (const row of data as unknown as LineRow[]) {
    const line: JournalLine = {
      accountId: row.account_id,
      debit: Number(row.debit),
      credit: Number(row.credit),
    };
    lines.push(line);
    const jid = row.journals?.id ?? 'unknown';
    const bucket = byJournal.get(jid);
    if (bucket) bucket.push(line);
    else byJournal.set(jid, [line]);
  }

  return { lines, byJournal };
}

export interface LedgerEntry {
  accountId: string;
  date: string;
  description: string | null;
  debit: number;
  credit: number;
}

/** Detailed ledger entries (with dates + descriptions) for the General Ledger. */
export async function getLedgerEntries(
  orgId: string,
  opts: { from?: string; to?: string } = {}
): Promise<LedgerEntry[]> {
  const supabase = await createClient();
  let query = supabase
    .from('journal_lines')
    .select(
      'account_id, debit, credit, journals!inner(entry_date, status, description)'
    )
    .eq('organization_id', orgId)
    .neq('journals.status', 'draft');

  if (opts.from) query = query.gte('journals.entry_date', opts.from);
  if (opts.to) query = query.lte('journals.entry_date', opts.to);

  const { data, error } = await query;
  if (error || !data) return [];

  const rows = data as unknown as {
    account_id: string;
    debit: number;
    credit: number;
    journals: { entry_date: string; description: string | null } | null;
  }[];

  return rows
    .map((r) => ({
      accountId: r.account_id,
      date: r.journals?.entry_date ?? '',
      description: r.journals?.description ?? null,
      debit: Number(r.debit),
      credit: Number(r.credit),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface TransactionRow {
  id: string;
  type: string;
  txn_date: string;
  amount: number;
  description: string | null;
  status: string;
  account: { name: string; plain_name: string | null } | null;
  category: { name: string; plain_name: string | null } | null;
}

/** Recent transactions for the SME-facing feed. */
export async function getTransactions(
  orgId: string,
  opts: { limit?: number } = {}
): Promise<TransactionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('transactions')
    .select(
      `id, type, txn_date, amount, description, status,
       account:accounts!transactions_account_id_fkey(name, plain_name),
       category:accounts!transactions_category_account_id_fkey(name, plain_name)`
    )
    .eq('organization_id', orgId)
    .order('txn_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 50);

  if (error || !data) return [];
  return data as unknown as TransactionRow[];
}
