'use client';

import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Upload, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { updateBrandingAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LogoMark } from '@/components/brand/logo';

export function BrandingUpsell() {
  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="mb-1 flex items-center gap-2 font-semibold">
          <Sparkles className="size-4 text-primary" /> Custom branding
        </h2>
        <p className="text-sm text-muted-foreground">
          Add your own logo and brand colour so Ledgr looks like your business. Available on the{' '}
          <b>Growth</b> plan.
        </p>
        <Button asChild size="sm" className="mt-4">
          <Link href="/billing">Upgrade to Growth</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function BrandingForm({
  initialColor,
  initialLogo,
}: {
  initialColor: string;
  initialLogo: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState(initialColor || '#0b7d5a');
  const [preview, setPreview] = useState<string | null>(initialLogo);
  const [removeLogo, setRemoveLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) { setPreview(URL.createObjectURL(f)); setRemoveLogo(false); }
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (removeLogo) fd.set('removeLogo', 'on');
    startTransition(async () => {
      const r = await updateBrandingAction(fd);
      if (r?.error) return setError(r.error);
      toast.success('Branding saved');
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="mb-1 flex items-center gap-2 font-semibold">
          <Sparkles className="size-4 text-primary" /> Custom branding
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Make Ledgr look like your business — your logo and brand colour appear across the app.
        </p>
        <form onSubmit={submit} className="space-y-5">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          {/* Logo */}
          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              <div className="grid size-14 place-items-center overflow-hidden rounded-xl border border-border bg-secondary/40">
                {preview && !removeLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="Logo preview" className="size-full object-contain" />
                ) : (
                  <LogoMark className="size-9" />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="size-4" /> Upload logo
                </Button>
                {(preview || initialLogo) && (
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => { setRemoveLogo(true); setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}>
                    Remove
                  </Button>
                )}
              </div>
              <input ref={fileRef} type="file" name="logo" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden" onChange={onFile} />
            </div>
            <p className="text-xs text-muted-foreground">PNG, SVG or JPG, up to 2MB. Square works best.</p>
          </div>

          {/* Colour */}
          <div className="space-y-2">
            <Label htmlFor="brandColor">Brand colour</Label>
            <div className="flex items-center gap-3">
              <input
                id="brandColor" name="brandColor" type="color" value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
              />
              <Input value={color} onChange={(e) => setColor(e.target.value)}
                className="w-32 font-mono uppercase" aria-label="Hex colour" />
              <div className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white" style={{ background: color }}>
                Preview
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />} Save branding
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
