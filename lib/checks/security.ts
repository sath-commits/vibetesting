/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Check } from './types'

export const securityChecks: Check[] = [
  {
    id: 'sec-001',
    slug: 'csp-missing',
    category: 'SECURITY',
    name: 'Content-Security-Policy header missing',
    description: 'Checks HTTP response headers for CSP.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const res = await page.request.get(url, { timeout: 10000 })
      const headers = res.headers()
      if (!headers['content-security-policy'] && !headers['x-content-security-policy']) {
        return { status: 'FAIL', message: 'Content-Security-Policy header missing', fixSuggestion: 'Add a CSP header to prevent XSS. Start with a restrictive policy and loosen as needed.' }
      }
      return { status: 'PASS', message: 'CSP header present' }
    },
  },
  {
    id: 'sec-002',
    slug: 'no-https-redirect',
    category: 'SECURITY',
    name: 'HTTP accessible — no HTTPS redirect',
    description: 'Checks if HTTP version of the URL redirects to HTTPS.',
    severity: 'CRITICAL',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      if (!url.startsWith('https://')) {
        return { status: 'FAIL', message: 'Page served over HTTP — not HTTPS', fixSuggestion: 'Enable HTTPS and redirect all HTTP traffic to HTTPS.' }
      }
      const httpUrl = url.replace('https://', 'http://')
      try {
        const res = await page.request.get(httpUrl, { timeout: 8000, maxRedirects: 0 })
        if (res.status() < 300 || res.status() >= 400) {
          return { status: 'WARN', message: 'HTTP version does not redirect to HTTPS', fixSuggestion: 'Set up a 301 redirect from HTTP to HTTPS at your server or CDN level.' }
        }
      } catch {}
      return { status: 'PASS', message: 'HTTPS enforced' }
    },
  },
  {
    id: 'sec-003',
    slug: 'x-frame-options-missing',
    category: 'SECURITY',
    name: 'X-Frame-Options header missing',
    description: 'Checks for clickjacking protection headers.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const res = await page.request.get(url, { timeout: 10000 })
      const headers = res.headers()
      if (!headers['x-frame-options'] && !headers['content-security-policy']?.includes('frame-ancestors')) {
        return { status: 'WARN', message: 'X-Frame-Options header missing — clickjacking risk', fixSuggestion: 'Add X-Frame-Options: DENY or use CSP frame-ancestors directive.' }
      }
      return { status: 'PASS', message: 'Clickjacking protection present' }
    },
  },
  {
    id: 'sec-004',
    slug: 'sensitive-env-in-bundle',
    category: 'SECURITY',
    name: 'Sensitive env vars in client bundle',
    description: 'Scans JavaScript bundles for private key patterns.',
    severity: 'CRITICAL',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const scripts = await page.$$eval('script[src]', (els) =>
        els.map((el) => (el as HTMLScriptElement).src)
      )
      const patterns = [/sk_live_[A-Za-z0-9]+/, /-----BEGIN PRIVATE KEY-----/, /-----BEGIN RSA PRIVATE KEY-----/]
      for (const src of scripts.slice(0, 10)) {
        try {
          const res = await page.request.get(src, { timeout: 8000 })
          const text = await res.text()
          for (const pattern of patterns) {
            if (pattern.test(text)) {
              return { status: 'FAIL', message: `Sensitive key pattern found in JS bundle: ${src.substring(0, 60)}`, fixSuggestion: 'Never bundle private keys or secret tokens. Use server-side API routes.' }
            }
          }
        } catch {}
      }
      return { status: 'PASS', message: 'No sensitive keys found in client bundles' }
    },
  },
  {
    id: 'sec-005',
    slug: 'csrf-protection-absent',
    category: 'SECURITY',
    name: 'CSRF protection absent on forms',
    description: 'Checks for CSRF tokens in forms and headers.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const forms = await page.$$('form')
      if (forms.length === 0) return { status: 'SKIP', message: 'No forms found' }
      let hasCSRF = false
      for (const form of forms.slice(0, 3)) {
        const csrfInput = await form.$('input[name*="csrf"], input[name*="_token"], input[name*="authenticity"]')
        if (csrfInput) { hasCSRF = true; break }
      }
      const hasCSRFHeader = ctx.networkRequests.some((r) =>
        Object.keys(r.headers).some((h) => h.toLowerCase().includes('csrf') || h.toLowerCase().includes('x-xsrf'))
      )
      if (!hasCSRF && !hasCSRFHeader) {
        return { status: 'WARN', message: 'No CSRF tokens detected in forms', fixSuggestion: 'Add CSRF protection using Next.js built-in patterns or a CSRF library.' }
      }
      return { status: 'PASS', message: 'CSRF protection detected' }
    },
  },
  {
    id: 'sec-006',
    slug: 'user-content-same-origin',
    category: 'SECURITY',
    name: 'User content served from same origin (XSS risk)',
    description: 'Checks if user-generated content is served from a sandboxed domain.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const hasUserContent = await page.evaluate(() => {
        const html = document.documentElement.innerHTML
        return html.includes('user-content') || html.includes('user_content') || html.includes('dangerouslySetInnerHTML') || html.includes('v-html')
      })
      if (hasUserContent) {
        return { status: 'WARN', message: 'User content detected — verify served from sandboxed origin', fixSuggestion: 'Serve user-generated content from a separate sandboxed domain (e.g., userusercontent.example.com).' }
      }
      return { status: 'PASS', message: 'No user-content patterns detected' }
    },
  },
  {
    id: 'sec-007',
    slug: 'admin-frontend-only-guard',
    category: 'SECURITY',
    name: 'Admin UI role-gated only on frontend',
    description: 'Checks if admin functionality has server-side guards.',
    severity: 'CRITICAL',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const source = await page.content()
      const hasAdminUI = source.includes('admin') || source.includes('Admin')
      if (!hasAdminUI) return { status: 'SKIP', message: 'No admin UI detected' }
      const base = new URL(url).origin
      try {
        const res = await page.request.get(base + '/api/admin', { timeout: 5000 })
        if (res.status() === 200) {
          return { status: 'WARN', message: '/api/admin returned 200 without auth', fixSuggestion: 'Protect all admin API routes server-side with role checks, not just client-side conditionals.' }
        }
      } catch {}
      return { status: 'PASS', message: 'Admin routes appear server-side protected' }
    },
  },
  {
    id: 'sec-008',
    slug: 'mixed-content',
    category: 'SECURITY',
    name: 'Mixed content warnings (HTTP on HTTPS page)',
    description: 'Checks for HTTP resources loaded on an HTTPS page.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      if (!url.startsWith('https://')) return { status: 'SKIP', message: 'Page not on HTTPS' }
      const httpResources = ctx.networkRequests.filter((r) => r.url.startsWith('http://') && !r.url.startsWith('http://localhost'))
      if (httpResources.length > 0) {
        return {
          status: 'FAIL',
          message: `${httpResources.length} HTTP resource(s) on HTTPS page`,
          detail: httpResources.slice(0, 3).map((r) => r.url).join('\n'),
          fixSuggestion: 'Update all resource URLs to HTTPS. Add upgrade-insecure-requests to your CSP.',
        }
      }
      return { status: 'PASS', message: 'No mixed content detected' }
    },
  },
]