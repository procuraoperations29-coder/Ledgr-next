import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-secondary/40 px-4">
      <div className="w-full max-w-md text-center">
        <p className="text-5xl font-semibold tracking-tight text-primary">404</p>
        <h1 className="mt-3 text-lg font-semibold">Page not found</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
