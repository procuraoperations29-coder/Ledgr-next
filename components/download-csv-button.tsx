'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Downloads a pre-built CSV string as a file. The CSV is assembled on the
 * server (so money formatters stay server-side) and passed in as a string.
 */
export function DownloadCsvButton({
  csv,
  filename,
  label = 'Export CSV',
  size = 'sm',
}: {
  csv: string;
  filename: string;
  label?: string;
  size?: 'sm' | 'default';
}) {
  function download() {
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="outline" size={size} onClick={download}>
      <Download className="size-4" />
      {label}
    </Button>
  );
}
