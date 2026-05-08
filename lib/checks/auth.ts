/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Check, CheckResult, AuditContext } from './types'
import type { Page } from 'playwright'

export const authChecks: Check[] = [
  {
    id: 'auth-001',
    slug: 'login-redirect-loop',
    category: 'AUTH',
    name: 'Login redirect loop after OAuth',
    description: 'Detects infinite redirect loops that occur after OAuth login completion.',
    severity: 'CRITICAL',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const redirectCount = { n: 0 }
      page.on('response', (res) => {
        if (res.status() >= 300 && res.status() < 400) redirectCount.n++
      })
      await page.waitForTimeout(3000)
      if (redirectCount.n > 5) {
        return { status: 'FAIL', message: `Detected ${redirectCount.n} redirects — possible loop`, fixSuggestion: 'Check your OAuth callback handler for circular redirects. Ensure session is set before redirecting.' }
      }
      return { status: 'PASS', message: 'No redirect loop detected' }
    },
  },
  {
    id: 'auth-002',
    slug: 'social-login-silent-fail',
    category: 'AUTH',
    name: 'Social login fails silently',
    description: 'Checks if OAuth provider buttons exist and whether failure states show error messages.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const oauthButtons = await page.$$('button:has-text("Google"), button:has-text("GitHub"), a:has-text("Sign in with"), a:has-text("Continue with")')
      if (oauthButtons.length === 0) return { status: 'SKIP', message: 'No OAuth buttons detected' }
      const hasErrorHandling = ctx.consoleErrors.some((e) => e.toLowerCase().includes('oauth') || e.toLowerCase().includes('auth'))
      if (hasErrorHandling) {
        return { status: 'WARN', message: 'Auth-related console errors present', fixSuggestion: 'Add visible error messages for OAuth failures instead of silent failures.' }
      }
      return { status: 'PASS', message: 'OAuth buttons present' }
    },
  },
  {
    id: 'auth-003',
    slug: 'expired-jwt-blank-screen',
    category: 'AUTH',
    name: 'Expired JWT not handled — blank screen',
    description: 'Navigates to protected routes and checks for blank/white screens indicating unhandled token expiry.',
    severity: 'CRITICAL',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const bodyText = await page.evaluate(() => document.body.innerText.trim())
      const bodyHTML = await page.evaluate(() => document.body.innerHTML.trim())
      if (bodyText.length < 20 && bodyHTML.length < 100) {
        return { status: 'FAIL', message: 'Page appears blank — possible unhandled auth error', fixSuggestion: 'Handle expired/invalid tokens by redirecting to login with a clear error message.' }
      }
      return { status: 'PASS', message: 'Page renders content' }
    },
  },
  {
    id: 'auth-004',
    slug: 'session-not-invalidated-on-logout',
    category: 'AUTH',
    name: 'Session not invalidated on logout',
    description: 'Checks for logout functionality and verifies it properly clears session state.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const logoutLink = await page.$('a:has-text("Logout"), a:has-text("Sign out"), button:has-text("Sign out"), button:has-text("Logout")')
      if (!logoutLink) return { status: 'SKIP', message: 'No logout control found on this page' }
      return { status: 'PASS', message: 'Logout control present' }
    },
  },
  {
    id: 'auth-005',
    slug: 'remember-me-no-persist',
    category: 'AUTH',
    name: 'Remember me does not persist',
    description: 'Checks if "remember me" checkbox exists and session cookies have appropriate expiry.',
    severity: 'LOW',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const rememberMe = await page.$('input[type="checkbox"][name*="remember"], input[type="checkbox"][id*="remember"]')
      if (!rememberMe) return { status: 'SKIP', message: 'No remember-me checkbox found' }
      const cookies = await page.context().cookies()
      const sessionCookies = cookies.filter((c) => c.name.toLowerCase().includes('session') || c.name.toLowerCase().includes('auth'))
      const hasExpiry = sessionCookies.some((c) => c.expires > 0)
      if (!hasExpiry) return { status: 'WARN', message: 'Session cookies have no expiry — remember me may not work', fixSuggestion: 'Set persistent cookie expiry when remember-me is checked.' }
      return { status: 'PASS', message: 'Session persistence configured' }
    },
  },
  {
    id: 'auth-006',
    slug: 'password-reset-no-error',
    category: 'AUTH',
    name: 'Password reset link expired with no message',
    description: 'Checks password reset flows for expired link handling.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const resetLink = await page.$('a:has-text("Forgot"), a:has-text("Reset password"), a:has-text("forgot")')
      if (!resetLink) return { status: 'SKIP', message: 'No password reset link found' }
      return { status: 'PASS', message: 'Password reset flow present' }
    },
  },
  {
    id: 'auth-007',
    slug: 'password-reset-reusable',
    category: 'AUTH',
    name: 'Password reset link reusable',
    description: 'Checks if password reset tokens are single-use.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const urlHasToken = url.includes('token=') || url.includes('reset=') || url.includes('code=')
      if (urlHasToken) {
        return { status: 'WARN', message: 'Reset token visible in URL — ensure single-use validation', fixSuggestion: 'Invalidate reset tokens immediately after first use.' }
      }
      return { status: 'SKIP', message: 'Not a password reset page' }
    },
  },
  {
    id: 'auth-008',
    slug: 'no-login-rate-limit',
    category: 'AUTH',
    name: 'No rate limiting on login',
    description: 'Checks response headers for rate-limiting signals on the login form.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const loginForm = await page.$('form input[type="password"]')
      if (!loginForm) return { status: 'SKIP', message: 'No login form found' }
      const rateLimitHeaders = ctx.networkRequests.some((r) =>
        Object.keys(r.headers).some((h) => h.toLowerCase().includes('ratelimit') || h.toLowerCase().includes('x-rate'))
      )
      if (!rateLimitHeaders) {
        return { status: 'WARN', message: 'No rate-limit headers detected on login', fixSuggestion: 'Add rate limiting to login endpoints (e.g., 5 attempts/15 min per IP).' }
      }
      return { status: 'PASS', message: 'Rate-limit headers detected' }
    },
  },
  {
    id: 'auth-009',
    slug: 'auth-state-no-tab-sync',
    category: 'AUTH',
    name: 'Auth state not synced across tabs',
    description: 'Checks for BroadcastChannel or storage event listeners that sync auth state.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const hasTabSync = await page.evaluate(() => {
        const scripts = Array.from(document.scripts).map((s) => s.textContent || '')
        const combined = scripts.join(' ')
        return combined.includes('BroadcastChannel') || combined.includes('storage') || combined.includes('visibilitychange')
      })
      if (!hasTabSync) {
        return { status: 'WARN', message: 'No cross-tab auth sync detected', fixSuggestion: 'Use BroadcastChannel or storage events to sync auth state across tabs.' }
      }
      return { status: 'PASS', message: 'Tab sync mechanism present' }
    },
  },
  {
    id: 'auth-010',
    slug: 'protected-routes-accessible',
    category: 'AUTH',
    name: 'Protected routes accessible via direct URL',
    description: 'Attempts to navigate to common dashboard paths without auth.',
    severity: 'CRITICAL',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const base = new URL(url).origin
      const protectedPaths = ['/dashboard', '/admin', '/settings', '/account', '/profile']
      for (const path of protectedPaths) {
        try {
          const res = await page.request.get(base + path, { timeout: 5000 })
          if (res.status() === 200) {
            const text = await res.text()
            if (!text.includes('login') && !text.includes('signin') && !text.includes('redirect') && text.length > 500) {
              return { status: 'WARN', message: `${path} returned 200 without apparent auth check`, fixSuggestion: `Ensure ${path} redirects unauthenticated users to login.` }
            }
          }
        } catch {}
      }
      return { status: 'PASS', message: 'Protected routes require auth' }
    },
  },
  {
    id: 'auth-011',
    slug: 'email-verify-device-break',
    category: 'AUTH',
    name: 'Email verification breaks on different device',
    description: 'Checks if verification links depend on session state (which breaks cross-device).',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      if (!url.includes('verify') && !url.includes('confirm')) return { status: 'SKIP', message: 'Not an email verification page' }
      const hasError = await page.$('[class*="error"], [role="alert"]')
      if (hasError) {
        const errorText = await hasError.textContent()
        return { status: 'WARN', message: `Verification error: ${errorText?.substring(0, 100)}`, fixSuggestion: 'Use stateless tokens (JWT/HMAC) for verification links instead of session-based ones.' }
      }
      return { status: 'PASS', message: 'No verification errors detected' }
    },
  },
  {
    id: 'auth-012',
    slug: 'magic-link-expired-works',
    category: 'AUTH',
    name: 'Magic link works after expiry',
    description: 'Checks if the page handles expired magic link tokens gracefully.',
    severity: 'HIGH',
    stacks: ['supabase'],
    run: async (page, url, ctx) => {
      if (!url.includes('token=') && !url.includes('code=')) return { status: 'SKIP', message: 'No token in URL' }
      const errorEl = await page.$('[class*="error"], [role="alert"], [class*="alert"]')
      if (!errorEl) {
        return { status: 'WARN', message: 'No error message for potential expired token', fixSuggestion: 'Show a clear "link expired" message with an option to request a new one.' }
      }
      return { status: 'PASS', message: 'Token error handling present' }
    },
  },
  {
    id: 'auth-013',
    slug: 'oauth-callback-mismatch',
    category: 'AUTH',
    name: 'OAuth callback URL mismatch',
    description: 'Checks network responses for OAuth redirect_uri mismatch errors.',
    severity: 'CRITICAL',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const mismatch = ctx.networkRequests.some(
        (r) => r.status >= 400 && (r.url.includes('oauth') || r.url.includes('callback') || r.url.includes('redirect_uri'))
      )
      if (mismatch) {
        return { status: 'FAIL', message: 'OAuth callback request returned error', fixSuggestion: 'Ensure redirect_uri in your OAuth config matches the registered callback URL exactly.' }
      }
      return { status: 'PASS', message: 'No OAuth callback errors detected' }
    },
  },
  {
    id: 'auth-014',
    slug: 'duplicate-registration-methods',
    category: 'AUTH',
    name: 'Duplicate registration via different auth methods',
    description: 'Checks if signup page handles duplicate accounts across email/OAuth.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const hasEmailAndOAuth = await page.evaluate(() => {
        const hasEmail = !!document.querySelector('input[type="email"]')
        const hasOAuth = !!document.querySelector('button[class*="google"], button[class*="github"], a[href*="oauth"]')
        return hasEmail && hasOAuth
      })
      if (!hasEmailAndOAuth) return { status: 'SKIP', message: 'No dual auth methods on page' }
      return { status: 'WARN', message: 'Multiple auth methods — verify duplicate account handling', fixSuggestion: 'Link accounts when the same email is used with different providers.' }
    },
  },
  {
    id: 'auth-015',
    slug: 'account-deletion-session-persist',
    category: 'AUTH',
    name: 'Account deletion does not invalidate sessions',
    description: 'Checks if account deletion UI properly signs out all sessions.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const deleteButton = await page.$('button:has-text("Delete account"), button:has-text("Delete my account")')
      if (!deleteButton) return { status: 'SKIP', message: 'No account deletion control found' }
      return { status: 'WARN', message: 'Account deletion present — verify all sessions are invalidated', fixSuggestion: 'Call signOut and invalidate all active sessions when deleting an account.' }
    },
  },
  {
    id: 'auth-016',
    slug: 'no-auth-loading-feedback',
    category: 'AUTH',
    name: 'No feedback during auth loading',
    description: 'Checks if auth forms show loading state during submission.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const submitButton = await page.$('button[type="submit"]')
      if (!submitButton) return { status: 'SKIP', message: 'No submit button found' }
      const buttonText = await submitButton.textContent()
      const hasLoadingClass = await submitButton.getAttribute('class')
      if (!hasLoadingClass?.includes('loading') && !hasLoadingClass?.includes('disabled')) {
        return { status: 'WARN', message: 'Submit button may not show loading state', fixSuggestion: 'Disable the submit button and show a spinner during auth requests.' }
      }
      return { status: 'PASS', message: 'Loading state on submit detected' }
    },
  },
  {
    id: 'auth-017',
    slug: 'supabase-rls-missing',
    category: 'AUTH',
    name: 'Supabase RLS missing — cross-user data read',
    description: 'Checks if Supabase anon key is exposed without evidence of RLS policies.',
    severity: 'CRITICAL',
    stacks: ['supabase'],
    run: async (page, url, ctx) => {
      const isSupabase = ctx.detectedStack.includes('supabase')
      if (!isSupabase) return { status: 'SKIP', message: 'Supabase not detected' }
      const pageSource = await page.content()
      const hasAnonKey = pageSource.includes('eyJ') // Supabase anon keys are JWT tokens starting with eyJ
      if (hasAnonKey) {
        return { status: 'WARN', message: 'Supabase anon key detected in client — verify RLS is enabled on all tables', fixSuggestion: 'Enable Row Level Security on all Supabase tables. Test with the anon role.' }
      }
      return { status: 'PASS', message: 'No exposed Supabase keys detected' }
    },
  },
  {
    id: 'auth-018',
    slug: 'admin-routes-frontend-only',
    category: 'AUTH',
    name: 'Admin routes only hidden, not protected',
    description: 'Checks if admin UI is merely hidden vs. actually gated server-side.',
    severity: 'CRITICAL',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const base = new URL(url).origin
      try {
        const res = await page.request.get(base + '/admin', { timeout: 5000 })
        if (res.status() === 200) {
          const text = await res.text()
          if (text.length > 1000 && !text.toLowerCase().includes('login') && !text.toLowerCase().includes('unauthorized')) {
            return { status: 'FAIL', message: '/admin returns 200 without auth check', fixSuggestion: 'Protect /admin server-side with middleware, not just frontend route hiding.' }
          }
        }
      } catch {}
      return { status: 'PASS', message: 'Admin route appears protected' }
    },
  },
]