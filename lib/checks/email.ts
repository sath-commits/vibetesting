/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Check } from './types'

export const emailChecks: Check[] = [
  {
    id: 'email-001',
    slug: 'spf-not-configured',
    category: 'EMAIL',
    name: 'SPF record not configured for sending domain',
    description: 'Checks DNS TXT records for SPF configuration.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      try {
        const domain = new URL(url).hostname
        const res = await page.request.get(`https://dns.google/resolve?name=${domain}&type=TXT`, { timeout: 8000 })
        const data = await res.json() as { Answer?: Array<{ data: string }> }
        const txtRecords = data.Answer?.map((a) => a.data) || []
        const hasSpf = txtRecords.some((r) => r.includes('v=spf1'))
        if (!hasSpf) {
          return { status: 'WARN', message: `No SPF record found for ${domain}`, fixSuggestion: 'Add an SPF TXT record to your DNS to authenticate your email sending domain.' }
        }
        return { status: 'PASS', message: `SPF record found for ${domain}` }
      } catch {
        return { status: 'SKIP', message: 'Could not check SPF record' }
      }
    },
  },
  {
    id: 'email-002',
    slug: 'dkim-not-configured',
    category: 'EMAIL',
    name: 'DKIM record not configured',
    description: 'Checks for DKIM DNS records on common email provider selectors.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      try {
        const domain = new URL(url).hostname
        const selectors = ['default', 'google', 'resend', 'amazonses', 'sendgrid', 'mailgun']
        for (const sel of selectors) {
          const res = await page.request.get(`https://dns.google/resolve?name=${sel}._domainkey.${domain}&type=TXT`, { timeout: 5000 })
          const data = await res.json() as { Answer?: Array<{ data: string }> }
          if (data.Answer?.some((a) => a.data.includes('v=DKIM1'))) {
            return { status: 'PASS', message: `DKIM record found (selector: ${sel})` }
          }
        }
        return { status: 'WARN', message: `No DKIM record found for ${domain}`, fixSuggestion: 'Configure DKIM with your email provider (Resend, SendGrid, etc.) to authenticate outbound email.' }
      } catch {
        return { status: 'SKIP', message: 'Could not check DKIM record' }
      }
    },
  },
  {
    id: 'email-003',
    slug: 'no-unsubscribe-mechanism',
    category: 'EMAIL',
    name: 'No unsubscribe mechanism detectable in email flows',
    description: 'Checks settings/notifications pages for unsubscribe options.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const base = new URL(url).origin
      try {
        const settingsRes = await page.request.get(base + '/settings', { timeout: 5000 })
        if (settingsRes.status() === 200) {
          const text = await settingsRes.text()
          const hasUnsub = text.toLowerCase().includes('unsubscribe') || text.toLowerCase().includes('email notification') || text.toLowerCase().includes('opt out')
          if (!hasUnsub) {
            return { status: 'WARN', message: 'No unsubscribe or email preference options found in /settings', fixSuggestion: 'Add email preference management to comply with CAN-SPAM and GDPR requirements.' }
          }
          return { status: 'PASS', message: 'Email unsubscribe options found in settings' }
        }
      } catch {}
      return { status: 'SKIP', message: 'Settings page not accessible or found' }
    },
  },
  {
    id: 'email-004',
    slug: 'notification-links-localhost',
    category: 'EMAIL',
    name: 'Notification links point to localhost or staging',
    description: 'Checks page source for localhost URLs in email/notification templates.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const source = await page.content()
      const hasLocalhost = source.includes('localhost:') || source.includes('127.0.0.1') || source.includes('.local/')
      if (hasLocalhost) {
        return { status: 'FAIL', message: 'Localhost URLs found in page source — may appear in email notifications', fixSuggestion: 'Replace localhost URLs with environment variables that use production values in deployment.' }
      }
      const stagingPatterns = /https?:\/\/(staging|dev|test|preview)\./
      const hasStagingUrl = stagingPatterns.test(source)
      if (hasStagingUrl) {
        return { status: 'WARN', message: 'Staging/dev URLs found in page source', fixSuggestion: 'Use NEXT_PUBLIC_APP_URL env var for all absolute URLs to ensure they use production values.' }
      }
      return { status: 'PASS', message: 'No localhost or staging URLs in page source' }
    },
  },
  {
    id: 'email-005',
    slug: 'no-reply-to-address',
    category: 'EMAIL',
    name: 'No reply-to address on transactional emails',
    description: 'Checks for reply-to configuration in email setup code.',
    severity: 'LOW',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const source = await page.content()
      const hasReplyTo = source.includes('replyTo') || source.includes('reply_to') || source.includes('Reply-To')
      if (hasReplyTo) {
        return { status: 'PASS', message: 'Reply-to configuration detected' }
      }
      return { status: 'WARN', message: 'No reply-to email configuration detected in source', fixSuggestion: 'Set a reply-to address on transactional emails so replies go to a monitored inbox.' }
    },
  },
  {
    id: 'email-006',
    slug: 'email-confirm-flow-broken',
    category: 'EMAIL',
    name: 'Email confirmation flow broken or unreachable',
    description: 'Checks if signup triggers an email confirmation step.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const signupPage = await page.$('form input[type="email"], form input[name*="email"]')
      if (!signupPage) return { status: 'SKIP', message: 'No signup form found' }
      const hasConfirmText = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase()
        return text.includes('confirm') || text.includes('verify') || text.includes('check your email')
      })
      if (!hasConfirmText) {
        return { status: 'WARN', message: 'Signup form found but no email confirmation messaging visible', fixSuggestion: 'Show clear messaging after signup to check email for confirmation link.' }
      }
      return { status: 'PASS', message: 'Email confirmation flow messaging present' }
    },
  },
]