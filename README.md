# VibeCheck

**Pre-launch QA for vibe-coded apps.** Paste your staging URL. We run 100 checks across 9 categories. Ship without embarrassment.

---

## What It Is

VibeCheck is an automated auditor. Give it a public URL and it spins up a headless browser (Playwright), probes your app from the outside — like a real user and a real attacker would — and returns a **Vibe Score (0–100)** with a breakdown of every check: what passed, what failed, and exactly how to fix it.

It is not a penetration test. It is not a replacement for human QA. It is the 30-minute checklist you forget to run before you post on Product Hunt — done automatically in 2 minutes.

---

## Architecture

```
User pastes URL
      │
      ▼
Next.js App (Vercel)
POST /api/audit
  → creates Audit record (PostgreSQL/Supabase)
  → enqueues job (BullMQ → Upstash Redis)
      │
      ▼
Playwright Worker (Docker/Railway)
  → picks up job from queue
  → launches headless Chromium
  → detects stack (Next.js, Supabase, Stripe, Vercel)
  → runs up to 100 checks (10s timeout each, 5 min total)
  → POSTs results back to /api/worker
      │
      ▼
Next.js App
POST /api/worker
  → saves all TestResult rows
  → calculates weighted Vibe Score
  → marks Audit as COMPLETE
  → updates per-check fail/pass counts (learning loop)
      │
      ▼
Audit page polls /api/audit/[id] every 2s
  → streams live results as they arrive
  → renders final report
```

### Components

| Component | Tech | Hosting |
|---|---|---|
| Web app + API | Next.js 14 App Router | Vercel |
| Job queue | BullMQ + IORedis | Upstash Redis |
| Check runner | Playwright (Chromium) | Docker on Railway |
| Database | Prisma 5 + PostgreSQL | Supabase |
| Auth (app users) | Supabase Auth | Supabase |
| Payments | Stripe | Stripe |

---

## The Tester + Learner Loop

### Tester
Every audit runs the full check suite as an **unauthenticated anonymous visitor** — no account creation, no login. Playwright launches a fresh browser context per audit with a custom user agent (`VibeCheck/1.0`) so your analytics can identify and ignore it.

Each check gets a 10-second timeout. If the check can't determine a result, it returns `SKIP` — not a false failure. The total audit budget is 5 minutes.

### Learner
After every audit, the `/api/worker` route upserts a `failCount` and `passCount` for each check ID into the `Check` table. Over time this builds a real-world signal: which checks fail most often across all apps audited. The public dashboard surfaces this data so you can see what the most common pre-launch mistakes actually are, ranked by frequency across real products — not hypothetical severity.

This means the tool gets smarter as more audits run. A check that flags a false positive often will show a low fail-rate relative to audits, which is a signal to tune its heuristics.

---

## What You Provide

| Input | Required | Notes |
|---|---|---|
| Staging or production URL | Yes | Must be publicly reachable. No `localhost`. |
| Stack hint | No (auto-detected) | Detected from headers and DOM: Next.js, Supabase, Stripe, Vercel |
| Test credentials | No (planned) | Future: email + password for authenticated deep-audit pass |

The URL must be accessible from the public internet. Private staging environments behind VPNs or basic auth will return a `FAILED` audit.

---

## What You Get Back

### Vibe Score (0–100)
A weighted composite score across all checks that returned PASS or FAIL (SKIP and ERROR don't count against you).

| Severity | Weight |
|---|---|
| CRITICAL | 15 points |
| HIGH | 8 points |
| MEDIUM | 4 points |
| LOW | 1 point |

Score = `(points earned / max possible points) × 100`

### Score Band

| Score | Band | Meaning |
|---|---|---|
| 80–100 | Ship it | You're ready. Minor issues only. |
| 60–79 | Almost there | A few real problems. Fix the HIGHs first. |
| 40–59 | Fix before you post | Multiple real issues. Don't post yet. |
| 0–39 | Do not ship | Critical failures. Ship this and you'll regret it. |

### Per-Check Result
Every check returns one of:

- `PASS` — confirmed good
- `FAIL` — definite problem found
- `WARN` — likely problem, needs human verification
- `SKIP` — check not applicable (e.g., Supabase-specific check on a non-Supabase app, or element not found)
- `ERROR` — check threw an exception (treated as SKIP in scoring)

Every FAIL and WARN includes a **fix suggestion** — a specific, actionable step to resolve it.

### Category Breakdown
Score per category so you know where to focus.

### Shareable Link
Every audit gets a public URL (`vibecheck.dev/audit/[id]`) you can share with your team, co-founder, or investors.

---

## How Each Category Tests (Honest)

### AUTH — 18 checks

All auth checks run as an **anonymous visitor without credentials**. We probe the surface of your auth system — we do not create accounts or log in.

**What we can check:**
- Do protected routes (`/dashboard`, `/admin`, `/settings`, `/account`) redirect anonymous visitors or return HTTP 200 with real content? A 200 response with >500 chars of non-login content is a definite flag.
- Does the main page enter a redirect loop? (>5 redirects = likely auth misconfiguration)
- Are OAuth buttons present on the login page?
- Are there auth-related console errors on page load?
- Is a Supabase anon JWT key (`eyJ...`) visible in the DOM? If yes, are RLS policies actually enabled?
- Do network requests to the login endpoint return rate-limit headers?
- Are session cookies set with expiry values?
- Are reset/magic-link tokens exposed in URLs?
- Does the page handle an empty body gracefully (blank-screen check for unhandled JWT expiry)?
- Do auth-adjacent URLs (`/verify`, `/confirm`) show error elements for bad tokens?

**What we cannot check without credentials:**
- Whether server-side session invalidation actually works on logout
- Whether JWT expiry triggers a proper redirect (we can't hold a session across time)
- Whether account deletion clears all active sessions
- End-to-end email confirmation flows
- Whether "remember me" sessions actually persist across browser restarts

**Planned**: A "deep auth" mode accepts test credentials and runs a second authenticated pass. After login: does `/dashboard` load? After logout: does the old session still work? After account deletion: does the token still authenticate?

---

### PAYMENTS — 14 checks

**What we check:**
- Is a Stripe test key (`pk_test_`, `sk_test_`) visible in production page source or JS bundles?
- Does `/api/webhook`, `/api/stripe/webhook`, or `/webhooks/stripe` respond (non-404)?
- Is Stripe.js loaded from `js.stripe.com` (not self-hosted, which is TOS violation)?
- Does the page source suggest "create order before webhook" patterns?
- Is there a `/pricing` page? Does it load without error?
- Does the success/confirmation page exist?
- Are Stripe Elements or PaymentElement components present?

**Cannot check without real Stripe events:**
- Whether webhooks actually receive and process events correctly
- Whether subscriptions renew correctly
- Whether failed payments are handled

---

### DATABASE — 10 checks

**What we check:**
- Do list/table pages show an empty state when there's no data, or just nothing?
- Are pagination controls present on list views?
- Is a Supabase anon key exposed client-side?
- Do API responses include server error details or stack traces?
- Does the app handle network errors with visible feedback?

**Cannot check:**
- Actual database RLS policies (requires DB access)
- Data integrity or migration correctness
- Query performance

---

### API — 12 checks

We make direct HTTP requests to common API endpoints and inspect responses.

**What we check:**
- Do endpoints like `/api/users`, `/api/me`, `/api/data` return sensitive fields (passwords, tokens, internal IDs) without auth?
- Do error responses include stack traces or internal paths?
- Are CORS headers set to wildcard (`*`) on sensitive endpoints?
- Are rate-limit headers (`X-RateLimit-*`, `Retry-After`) present?
- Are environment variable names or values visible in page source?
- Does `/api/health` exist and return correctly?

---

### FRONTEND — 14 checks

Playwright DOM inspection and interaction.

**What we check:**
- Are there console errors on initial page load?
- Do forms protect against double-submit (button disabled on click)?
- Do modals close on Escape key?
- Are there visible loading states (spinners, skeletons) during data fetches?
- Are error states shown for network failures?
- Do empty list states show content instead of a blank area?
- Is there a 404 page?
- Are focus states visible for keyboard navigation?

---

### MOBILE — 10 checks

The browser viewport is resized to **375×812px (iPhone SE)** for these checks.

**What we check:**
- Does layout break or overflow horizontally at 375px?
- Are touch targets at least **44×44px** (Apple/Google minimum)?
- Is horizontal scrolling triggered?
- Is the viewport meta tag set correctly (`width=device-width, initial-scale=1`)?
- Does font size stay readable (no iOS auto-zoom on inputs)?
- Is Cumulative Layout Shift (CLS) under 0.1 on mobile?

---

### PERFORMANCE — 8 checks

**What we check:**
- Is the total JavaScript bundle size over 1MB?
- Are images using `loading="lazy"` where appropriate?
- Do JS and CSS files have cache-control headers set?
- Is Time To First Byte (TTFB) under 600ms?
- Is Largest Contentful Paint (LCP) under 2.5s?
- Are there unminified JS files served to the browser?

---

### SECURITY — 8 checks

**What we check:**
- Is a `Content-Security-Policy` header present?
- Does HTTP redirect to HTTPS (or is the site served over HTTP)?
- Is `X-Frame-Options` or `frame-ancestors` CSP set?
- Are there HTTP (not HTTPS) resources loaded on an HTTPS page (mixed content)?
- Do JS bundles contain patterns matching private keys (`sk_live_`, `BEGIN PRIVATE KEY`)?
- Do forms have CSRF tokens or do network requests include `x-csrf-token` headers?
- Is `/api/admin` reachable without auth?
- Is user-generated content served from a sandboxed domain?

---

### EMAIL — 6 checks

DNS checks use the **Google Public DNS API** (no auth required — DNS is publicly queryable).

**What we check:**
- Is an SPF TXT record configured for the sending domain?
- Is a DKIM record present on common selector names (`google`, `resend`, `sendgrid`, `mailgun`, etc.)?
- Does `/settings` contain unsubscribe or email preference language?
- Are `localhost:` or `127.0.0.1` URLs visible in the page source (would appear in email notification links)?
- Is a `reply-to` email configuration present?
- Does the signup form show email confirmation messaging?

---

## Example Report

```
Audit: https://myapp.com
Score: 58 / 100 — Fix before you post
Stack: Next.js · Supabase · Stripe · Vercel
Checks run: 94  |  Passed: 71  |  Failed: 8  |  Warned: 9  |  Skipped: 6
Duration: 1m 43s

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL FAILS

✗ sec-004  Sensitive env vars in client bundle
  Found: sk_live_4xK... pattern in /_next/static/chunks/main.js
  Fix:   Never bundle private keys. Move all secret calls to server-side
         API routes. Private keys must never appear in the browser.

✗ auth-018  Admin routes only hidden, not protected
  Found: /admin returned HTTP 200 with 4.2KB of content, no login redirect
  Fix:   Protect /admin in Next.js middleware, not just client-side
         conditionals. Check for session server-side before rendering.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HIGH WARNS

⚠ pay-001  Stripe test key in production
  Found: pk_test_ in page source on https://myapp.com
  Fix:   Swap for pk_live_ key. Use environment-specific env vars.

⚠ sec-001  Content-Security-Policy header missing
  Fix:   Add CSP header. Start with default-src 'self' and expand as needed.

⚠ api-003  CORS wildcard on API
  Found: Access-Control-Allow-Origin: * on /api/data
  Fix:   Restrict CORS to your own origin. Never use * on auth endpoints.

⚠ email-001  SPF record not configured
  Found: No SPF TXT record on myapp.com
  Fix:   Add: v=spf1 include:_spf.resend.com ~all (or your provider's record)

⚠ auth-008  No rate limiting on login
  Fix:   Add rate limiting to /api/auth/login. 5 attempts per 15 min per IP.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CATEGORY SCORES

Security     38/100  ████░░░░░░░░░░░░░░░░
Auth         52/100  ██████████░░░░░░░░░░
Payments     65/100  █████████████░░░░░░░
Email        45/100  █████████░░░░░░░░░░░
API          60/100  ████████████░░░░░░░░
Frontend     82/100  ████████████████░░░░
Mobile       88/100  █████████████████░░░
Performance  71/100  ██████████████░░░░░░
Database     75/100  ███████████████░░░░░

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PASSES (71 checks)
✓ HTTPS enforced
✓ No redirect loop
✓ Stripe.js loaded from js.stripe.com
✓ Mobile layout valid at 375px
✓ Touch targets ≥ 44px
✓ No console errors on load
✓ 404 page exists
... and 64 more
```

---

## What VibeCheck Is Not

**Not a penetration test.** We probe from the outside as an anonymous visitor. We don't attempt injection, fuzzing, or authenticated exploit chains. For a real pentest, hire a security firm.

**Not a guarantee.** A score of 100 means you passed all 100 heuristic checks. It does not mean your app is bug-free. Heuristics can miss things a human would catch.

**Not a replacement for your own tests.** Your unit tests, integration tests, and E2E Playwright/Cypress suite are irreplaceable. VibeCheck is the checklist you run before you *post* — it catches the stuff founders forget because they're too close to the product.

---

## Plans

| | Free | Starter ($9/mo) | Pro ($29/mo) |
|---|---|---|---|
| Audits per day | 3 | 20 | Unlimited |
| Results visibility | Public | Private | Private |
| Audit history | No | Yes | Yes |
| Email reports | No | Yes | Yes |
| Scheduled re-runs | No | No | Yes |
| Slack/webhook alerts | No | No | Yes |
| Team seats | 1 | 1 | 3 |
| Queue priority | Standard | Standard | Priority |

---

## Running Locally

```bash
# Clone and install
git clone https://github.com/sath-commits/vibetesting
cd vibetesting
npm install

# Set up environment (copy and fill in real values)
cp .env.example .env

# Apply database schema
npx prisma migrate dev

# Start the web app
npm run dev

# In a separate terminal, start the worker
cd worker
npm run dev
```

### Required Services
- **Supabase** — free tier works. Get `DATABASE_URL`, anon key, service role key.
- **Upstash Redis** — free tier works. Get the Redis connection string.
- **Stripe** — test mode. Get publishable and secret keys.

### Environment Variables
See `.env.example` for the full list. The only required ones for basic local development:
```
DATABASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
REDIS_URL
WORKER_SECRET
APP_URL=http://localhost:3000
```

---

## Deployment

**Web app** → Push to GitHub, connect to Vercel. Set all env vars in Vercel dashboard.

**Worker** → Deploy `worker/Dockerfile` to Railway (or any Docker host). The worker only needs `REDIS_URL`, `APP_URL`, `WORKER_SECRET`, and `DATABASE_URL`.

**Stripe webhooks** → Point `https://yourapp.com/api/webhook/stripe` in Stripe dashboard. Set `STRIPE_WEBHOOK_SECRET` from the webhook signing secret.

---

## Tech Stack

- [Next.js 14](https://nextjs.org) — App Router, React Server Components
- [Prisma 5](https://prisma.io) — ORM
- [Supabase](https://supabase.com) — PostgreSQL + Auth
- [BullMQ](https://bullmq.io) — Job queue
- [Playwright](https://playwright.dev) — Headless browser automation
- [Stripe](https://stripe.com) — Payments
- [Tailwind CSS](https://tailwindcss.com) — Styling
- [Upstash](https://upstash.com) — Serverless Redis
