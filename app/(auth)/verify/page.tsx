import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function VerifyPage() {
  return (
    <Card className="text-center shadow-elevated">
      <CardHeader>
        <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground">
          <MailCheck className="size-6" />
        </div>
        <CardTitle className="text-2xl">Check your inbox</CardTitle>
        <CardDescription>
          We&apos;ve sent you a confirmation link. Click it to verify your email
          and finish setting up your business.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Back to log in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
