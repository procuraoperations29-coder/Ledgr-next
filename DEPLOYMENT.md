# Deploying Ledgr to Vercel

The app is a standard Next.js 16 project — Vercel auto-detects the build. This is
the end-to-end runbook. Steps you must do (accounts / logins) are marked **[you]**;
things already handled in the repo are marked ✅.

---

## 0. Decide: which Supabase project?

- **Recommended:** create a **fresh production Supabase project** (the current
  `rbyhknrjnjupnbqwtpqu` project holds test data — Tayo Foods, Avanti Solutions,
  the `demo@ledgr.test` user). A clean prod DB avoids shipping demo rows.
- **Or** reuse the current project and delete the test data first.

If you make a new project, apply the schema once:
**[you]** SQL Editor → paste `supabase/combined_schema.sql` → Run.

---

## 1. Push the code to a Git host **[you]**

The repo is committed locally on `master` but has no remote.

```bash
# create an EMPTY GitHub repo (no README), then:
cd ledgr-next
git remote add origin https://github.com/<you>/ledgr.git
git push -u origin master
```

## 2. Import into Vercel **[you]**

1. vercel.com → **Add New → Project** → import the GitHub repo.
2. Framework preset: **Next.js** (auto-detected). Build command, output — leave default.
3. Add the environment variables below **before** the first deploy.

## 3. Environment variables (Vercel → Settings → Environment Variables)

| Variable | Scope | Value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | All | your prod project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | prod anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | All (server-only; **never** prefix NEXT_PUBLIC) | prod service_role key |
| `NEXT_PUBLIC_SITE_URL` | All | `https://<your-domain>` (your Vercel/production URL) |
| `NEXT_PUBLIC_STANDARD_PLAN_PRICE_KOBO` | All | `300000` |
| `BILLING_PROVIDER` | All | `paystack` or `flutterwave` (only when going live with payments) |
| `PAYSTACK_SECRET_KEY` | All | live secret (optional until you charge) |
| `FLUTTERWAVE_SECRET_KEY` / `FLUTTERWAVE_SECRET_HASH` | All | live values (if using Flutterwave) |

`NEXT_PUBLIC_SITE_URL` **must** match the deployed domain — it builds the auth
email links (confirmation / password reset) and the billing return URL.

## 4. Supabase configuration **[you]**

1. **Auth → URL Configuration**
   - Site URL: `https://<your-domain>`
   - Redirect URLs (allowlist): `https://<your-domain>/auth/callback`
2. **Auth → Providers → Email**: keep "Confirm email" **on** for production.
   - The built-in email sender is rate-limited — for real signup volume, set up
     **custom SMTP** (Auth → SMTP Settings). Otherwise confirmation emails throttle.
3. Make yourself a platform admin (so `/admin` works):
   `insert into public.platform_admins (user_id) values ('<your-auth-user-id>');`

## 5. Payments (only when you're ready to charge) **[you]**

- Paystack/Flutterwave dashboard → set the **webhook URL** to
  `https://<your-domain>/api/billing/webhook`.
- Put the matching live keys in the Vercel env vars above.
- Until keys are set, the Subscribe button shows a friendly "payments not set up"
  message — everything else works on the trial.

## 6. Deploy & smoke-test

- Push to `master` → Vercel builds and deploys automatically.
- Verify: sign up → confirm email → onboard → record a transaction → open a report.
- Check the P&L / Balance Sheet numbers tie out (they derive from the same ledger).

---

## Already handled in the repo ✅

- `next build` compiles all 38 routes; typecheck clean; 37 tests pass.
- Security headers (X-Frame-Options, nosniff, HSTS, …) in `next.config.mjs`.
- `.env.local` is gitignored — no secrets in the repo.
- Middleware refreshes the Supabase session on every request.
- The app boots without Supabase keys (no-op), so a misconfigured env fails safe.

## Notes / follow-ups

- Next warns that the `middleware` file convention is deprecated in favour of
  `proxy` — it still works; rename `middleware.ts` → `proxy.ts` at leisure.
- The root layout pulls Inter via `next/font/google`; Vercel builds have network
  access so this is fine (local offline builds can transiently fail the font fetch;
  the Tailwind sans stack falls back to system fonts at runtime regardless).
- Point a custom domain at the Vercel project when ready, then update
  `NEXT_PUBLIC_SITE_URL` and the Supabase redirect allowlist to match.
