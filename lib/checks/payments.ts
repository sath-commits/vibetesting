/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Check } from './types'

export const paymentChecks: Check[] = [
  {
    id: 'pay-001',
    slug: 'stripe-test-keys-production',
    category: 'PAYMENTS',
    name: 'Stripe test keys in production',
    description: 'Detects sk_test_ or pk_test_ keys exposed in page source or network requests.',
    severity: 'CRITICAL',
    stacks: ['stripe', 'all'],
    run: async (page, url, ctx) => {
      const source = await page.content()
      if (source.includes('sk_test_')) {
        return { status: 'FAIL', message: 'Stripe SECRET test key found in page source', fixSuggestion: 'Never expose sk_test_ in client-side code. Move to server-side environment variables only.' }
      }
      if (source.includes('pk_test_')) {
        return { status: 'WARN', message: 'Stripe PUBLISHABLE test key in source — ensure this is not production', fixSuggestion: 'Replace pk_test_ with pk_live_ in your production environment.' }
      }
      const networkLeak = ctx.networkRequests.some((r) => JSON.stringify(r).includes('sk_test_'))
      if (networkLeak) {
        return { status: 'FAIL', message: 'Stripe test secret key found in network request', fixSuggestion: 'Secret keys must never leave your server.' }
      }
      return { status: 'PASS', message: 'No Stripe test keys detected in client-side' }
    },
  },
  {
    id: 'pay-002',
    slug: 'webhook-not-reachable',
    category: 'PAYMENTS',
    name: 'Webhook endpoint not reachable',
    description: 'Makes a HEAD request to /api/webhook/stripe to verify it responds.',
    severity: 'HIGH',
    stacks: ['stripe'],
    run: async (page, url, ctx) => {
      const base = new URL(url).origin
      const paths = ['/api/webhook/stripe', '/api/webhooks/stripe', '/api/stripe/webhook', '/webhooks/stripe']
      for (const path of paths) {
        try {
          const res = await page.request.head(base + path, { timeout: 5000 })
          if (res.status() < 500) {
            return { status: 'PASS', message: `Webhook endpoint ${path} is reachable (${res.status()})` }
          }
        } catch {}
      }
      return { status: 'WARN', message: 'Stripe webhook endpoint not found at common paths', fixSuggestion: 'Ensure /api/webhook/stripe is deployed and publicly reachable.' }
    },
  },
  {
    id: 'pay-003',
    slug: 'success-before-webhook',
    category: 'PAYMENTS',
    name: 'Success redirect fires before webhook',
    description: 'Checks if checkout success page grants access immediately without waiting for webhook.',
    severity: 'HIGH',
    stacks: ['stripe'],
    run: async (page, url, ctx) => {
      if (!url.includes('success') && !url.includes('checkout')) return { status: 'SKIP', message: 'Not a checkout/success page' }
      const grantsAccess = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase()
        return text.includes('access granted') || text.includes('subscription active') || text.includes('welcome to')
      })
      if (grantsAccess) {
        return { status: 'WARN', message: 'Success page shows access granted — ensure this is webhook-confirmed not URL-triggered', fixSuggestion: 'Grant access only after receiving and verifying the checkout.session.completed webhook.' }
      }
      return { status: 'PASS', message: 'Success page does not immediately grant access' }
    },
  },
  {
    id: 'pay-004',
    slug: 'failed-payment-generic-error',
    category: 'PAYMENTS',
    name: 'Failed payment shows generic error only',
    description: 'Checks payment forms for specific error message handling.',
    severity: 'MEDIUM',
    stacks: ['stripe'],
    run: async (page, url, ctx) => {
      const paymentForm = await page.$('form [data-elements-stable-field-name], #payment-form, .stripe-element')
      if (!paymentForm) return { status: 'SKIP', message: 'No Stripe payment element found' }
      return { status: 'WARN', message: 'Payment form present — verify specific error messages for declined cards', fixSuggestion: 'Show card-specific errors like "insufficient funds" or "card declined" from the Stripe error object.' }
    },
  },
  {
    id: 'pay-005',
    slug: 'no-3ds-sca-handling',
    category: 'PAYMENTS',
    name: 'No 3DS/SCA handling detected',
    description: 'Checks if payment flow handles Strong Customer Authentication challenges.',
    severity: 'HIGH',
    stacks: ['stripe'],
    run: async (page, url, ctx) => {
      const source = await page.content()
      const has3DS = source.includes('handleNextAction') || source.includes('confirmCardPayment') || source.includes('payment_intent')
      if (!has3DS) {
        const hasStripe = source.includes('stripe.js') || source.includes('js.stripe.com')
        if (hasStripe) {
          return { status: 'WARN', message: 'Stripe detected but no 3DS/SCA action handler found', fixSuggestion: 'Use stripe.confirmCardPayment() and handle the requires_action state for 3DS.' }
        }
        return { status: 'SKIP', message: 'Stripe not detected on this page' }
      }
      return { status: 'PASS', message: '3DS/SCA handling detected' }
    },
  },
  {
    id: 'pay-006',
    slug: 'cancel-no-revoke',
    category: 'PAYMENTS',
    name: 'Subscription cancel does not revoke access',
    description: 'Checks cancel flow for immediate vs. period-end access revocation.',
    severity: 'HIGH',
    stacks: ['stripe'],
    run: async (page, url, ctx) => {
      const cancelButton = await page.$('button:has-text("Cancel"), button:has-text("cancel subscription"), a:has-text("Cancel plan")')
      if (!cancelButton) return { status: 'SKIP', message: 'No subscription cancel control found' }
      return { status: 'WARN', message: 'Cancel control present — verify access is revoked at period end via webhook', fixSuggestion: 'Listen to customer.subscription.deleted webhook to revoke access.' }
    },
  },
  {
    id: 'pay-007',
    slug: 'free-trial-not-enforced',
    category: 'PAYMENTS',
    name: 'Free trial expiry not enforced',
    description: 'Checks if trial state is verified server-side.',
    severity: 'HIGH',
    stacks: ['stripe'],
    run: async (page, url, ctx) => {
      const hasTrial = await page.evaluate(() => document.body.innerText.toLowerCase().includes('trial'))
      if (!hasTrial) return { status: 'SKIP', message: 'No trial messaging detected' }
      return { status: 'WARN', message: 'Trial messaging present — ensure trial_end is enforced server-side', fixSuggestion: 'Check subscription.status and trial_end from Stripe server-side, not client-side.' }
    },
  },
  {
    id: 'pay-008',
    slug: 'promo-invalid-silent',
    category: 'PAYMENTS',
    name: 'Promo field accepts invalid codes silently',
    description: 'Checks if promo/coupon input provides feedback for invalid codes.',
    severity: 'MEDIUM',
    stacks: ['stripe'],
    run: async (page, url, ctx) => {
      const promoInput = await page.$('input[name*="promo"], input[name*="coupon"], input[placeholder*="promo"], input[placeholder*="coupon"]')
      if (!promoInput) return { status: 'SKIP', message: 'No promo code input found' }
      return { status: 'WARN', message: 'Promo input present — verify invalid code shows an error', fixSuggestion: 'Display a clear error when an invalid promo code is entered.' }
    },
  },
  {
    id: 'pay-009',
    slug: 'currency-mismatch',
    category: 'PAYMENTS',
    name: 'Currency mismatch in display vs. charge',
    description: 'Checks if displayed currency matches Stripe locale.',
    severity: 'MEDIUM',
    stacks: ['stripe'],
    run: async (page, url, ctx) => {
      const priceEls = await page.$$('[class*="price"], [class*="amount"], [data-price]')
      if (priceEls.length === 0) return { status: 'SKIP', message: 'No price elements found' }
      return { status: 'PASS', message: 'Price elements found — manual verification required for currency match' }
    },
  },
  {
    id: 'pay-010',
    slug: 'no-confirmation-email',
    category: 'PAYMENTS',
    name: 'No confirmation email flow detectable',
    description: 'Checks for evidence of email confirmation after purchase.',
    severity: 'MEDIUM',
    stacks: ['stripe'],
    run: async (page, url, ctx) => {
      if (!url.includes('success') && !url.includes('thank')) return { status: 'SKIP', message: 'Not a purchase completion page' }
      const hasEmailMention = await page.evaluate(() =>
        document.body.innerText.toLowerCase().includes('email') || document.body.innerText.toLowerCase().includes('inbox')
      )
      if (!hasEmailMention) {
        return { status: 'WARN', message: 'No email confirmation mention on success page', fixSuggestion: 'Send a receipt email on checkout.session.completed and mention it on the success page.' }
      }
      return { status: 'PASS', message: 'Email confirmation mentioned on success page' }
    },
  },
  {
    id: 'pay-011',
    slug: 'checkout-session-expiry',
    category: 'PAYMENTS',
    name: 'Checkout session expiry not handled',
    description: 'Checks if expired Stripe Checkout sessions show a proper error.',
    severity: 'MEDIUM',
    stacks: ['stripe'],
    run: async (page, url, ctx) => {
      const hasStripe = (await page.content()).includes('stripe')
      if (!hasStripe) return { status: 'SKIP', message: 'Stripe not detected' }
      return { status: 'PASS', message: 'Stripe present — session expiry requires manual testing' }
    },
  },
  {
    id: 'pay-012',
    slug: 'payment-no-https',
    category: 'PAYMENTS',
    name: 'Missing HTTPS on payment pages',
    description: 'Verifies payment pages are served over HTTPS.',
    severity: 'CRITICAL',
    stacks: ['stripe', 'all'],
    run: async (page, url, ctx) => {
      const paymentForm = await page.$('form input[name*="card"], #payment-form, .stripe-element, [data-stripe]')
      if (!paymentForm) return { status: 'SKIP', message: 'No payment form detected' }
      if (!url.startsWith('https://')) {
        return { status: 'FAIL', message: 'Payment form served over HTTP', fixSuggestion: 'Always serve payment pages over HTTPS. Stripe requires it.' }
      }
      return { status: 'PASS', message: 'Payment form served over HTTPS' }
    },
  },
  {
    id: 'pay-013',
    slug: 'payment-form-no-auth',
    category: 'PAYMENTS',
    name: 'Payment form accessible without auth',
    description: 'Checks if payment/upgrade page requires authentication.',
    severity: 'MEDIUM',
    stacks: ['stripe'],
    run: async (page, url, ctx) => {
      const paymentForm = await page.$('#payment-form, .stripe-element, [data-stripe]')
      if (!paymentForm) return { status: 'SKIP', message: 'No payment form detected' }
      const isLoggedIn = await page.evaluate(() => {
        return document.cookie.includes('session') || document.cookie.includes('auth') || !!document.querySelector('[data-user-id]')
      })
      if (!isLoggedIn) {
        return { status: 'WARN', message: 'Payment form accessible without detected auth session', fixSuggestion: 'Require authentication before showing payment forms.' }
      }
      return { status: 'PASS', message: 'Payment form appears auth-gated' }
    },
  },
  {
    id: 'pay-014',
    slug: 'no-payment-loading-state',
    category: 'PAYMENTS',
    name: 'No loading state during payment submission',
    description: 'Checks if payment submit button shows loading/disabled state.',
    severity: 'MEDIUM',
    stacks: ['stripe'],
    run: async (page, url, ctx) => {
      const submitBtn = await page.$('button[type="submit"]:near(#payment-form), button:has-text("Pay"), button:has-text("Subscribe")')
      if (!submitBtn) return { status: 'SKIP', message: 'No payment submit button found' }
      const hasLoadingAttr = await submitBtn.getAttribute('data-loading')
      const hasDisabledLogic = await page.evaluate(() =>
        document.body.innerHTML.includes('isLoading') || document.body.innerHTML.includes('isSubmitting')
      )
      if (!hasLoadingAttr && !hasDisabledLogic) {
        return { status: 'WARN', message: 'Payment button may not show loading state', fixSuggestion: 'Disable the button and show a spinner after payment submission to prevent double charges.' }
      }
      return { status: 'PASS', message: 'Payment button loading state detected' }
    },
  },
]