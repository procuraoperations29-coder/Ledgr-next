'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Upload, Download, FileUp } from 'lucide-react';
import { parseCsv } from '@/lib/csv';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface ImportResult {
  ok?: boolean;
  error?: string;
  imported?: number;
  skipped?: number;
}

export function ImportCsvDialog({
  title,
  description,
  templateName,
  templateHeaders,
  sampleRow,
  action,
}: {
  title: string;
  description: string;
  templateName: string;
  templateHeaders: string[];
  sampleRow: string[];
  action: (rows: Record<string, string>[]) => Promise<ImportResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function downloadTemplate() {
    const csv = templateHeaders.join(',') + '\r\n' + sampleRow.join(',');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = templateName;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      setError('That file has no data rows.');
      setRows([]);
      return;
    }
    setRows(parsed);
  }

  function doImport() {
    setError(null);
    startTransition(async () => {
      const r = await action(rows);
      if (r.error) return setError(r.error);
      toast.success(`Imported ${r.imported ?? 0}${r.skipped ? `, skipped ${r.skipped}` : ''}`);
      setOpen(false);
      setRows([]);
      setFileName('');
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="size-4" /> Import
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <button
            type="button"
            onClick={downloadTemplate}
            className="flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
          >
            <Download className="size-4" /> Download the CSV template
          </button>

          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-center hover:bg-secondary">
            <FileUp className="size-6 text-muted-foreground" />
            <span className="text-sm font-medium">
              {fileName || 'Choose a CSV file'}
            </span>
            <span className="text-xs text-muted-foreground">
              Columns: {templateHeaders.join(', ')}
            </span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          </label>

          {rows.length > 0 && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{rows.length}</span> row
              {rows.length === 1 ? '' : 's'} ready to import.
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
          <Button type="button" onClick={doImport} disabled={pending || rows.length === 0}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Import {rows.length > 0 ? `${rows.length} row${rows.length === 1 ? '' : 's'}` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
