import { authChecks } from './auth'
import { paymentChecks } from './payments'
import { databaseChecks } from './database'
import { apiChecks } from './api'
import { frontendChecks } from './frontend'
import { mobileChecks } from './mobile'
import { performanceChecks } from './performance'
import { securityChecks } from './security'
import { emailChecks } from './email'
import type { Check, CheckCategory } from './types'

export const ALL_CHECKS: Check[] = [
  ...authChecks,
  ...paymentChecks,
  ...databaseChecks,
  ...apiChecks,
  ...frontendChecks,
  ...mobileChecks,
  ...performanceChecks,
  ...securityChecks,
  ...emailChecks,
]

export function getChecksForStack(stack: string[]): Check[] {
  return ALL_CHECKS.filter((check) => {
    return check.stacks.includes('all') || check.stacks.some((s) => stack.includes(s))
  })
}

export function getChecksByCategory(category: CheckCategory): Check[] {
  return ALL_CHECKS.filter((c) => c.category === category)
}

export function getCheckById(id: string): Check | undefined {
  return ALL_CHECKS.find((c) => c.id === id)
}

export const CHECK_CATEGORIES: Record<CheckCategory, { label: string; description: string; icon: string }> = {
  AUTH: {
    label: 'Authentication',
    description: 'Login flows, session management, OAuth, magic links',
    icon: 'Lock',
  },
  PAYMENTS: {
    label: 'Payments',
    description: 'Stripe integration, webhooks, subscription management',
    icon: 'CreditCard',
  },
  DATABASE: {
    label: 'Database',
    description: 'RLS policies, pagination, error states, validation',
    icon: 'Database',
  },
  API: {
    label: 'API',
    description: 'Endpoint security, CORS, rate limiting, error handling',
    icon: 'Zap',
  },
  FRONTEND: {
    label: 'Frontend',
    description: 'Loading states, error boundaries, form UX, accessibility',
    icon: 'Monitor',
  },
  MOBILE: {
    label: 'Mobile',
    description: 'Responsive layout, touch targets, viewport, iOS issues',
    icon: 'Smartphone',
  },
  PERFORMANCE: {
    label: 'Performance',
    description: 'Bundle size, image optimization, TTFB, LCP, caching',
    icon: 'Gauge',
  },
  SECURITY: {
    label: 'Security',
    description: 'CSP, HTTPS, CSRF, mixed content, admin protection',
    icon: 'Shield',
  },
  EMAIL: {
    label: 'Email',
    description: 'SPF, DKIM, unsubscribe, confirmation flows',
    icon: 'Mail',
  },
}

export type { Check, CheckCategory }
