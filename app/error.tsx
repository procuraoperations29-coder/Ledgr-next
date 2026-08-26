'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Technical detail is logged for administrators, never shown to users (§46).
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-dvh place-items-center bg-secondary/40 px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-card">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" />
        </div>
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          We hit a snag loading this page. Please try again — your data is safe.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" onClick={() => (window.location.href = '/dashboard')}>
            Go to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
