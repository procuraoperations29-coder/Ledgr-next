import Link from 'next/link';
import { LogoMark } from '@/components/brand/logo';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-secondary/40">
      <header className="container flex h-16 items-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <LogoMark className="size-8" />
          Ledgr
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
