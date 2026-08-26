'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { startCheckoutAction } from './actions';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function SubscribeButton({
  planId,
  label,
}: {
  planId: string;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="info">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await startCheckoutAction({ planId });
            if (r.error) setError(r.error);
            else if (r.authorizationUrl) window.location.href = r.authorizationUrl;
          })
        }
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {label}
      </Button>
    </div>
  );
}
