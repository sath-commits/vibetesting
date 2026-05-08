import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // @ts-expect-error — API version string varies by Stripe SDK version
  apiVersion: '2024-06-20',
  typescript: true,
})

export const PLANS = {
  STARTER: {
    name: 'Starter',
    price: 9,
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    auditsPerDay: 20,
    features: ['20 audits/day', 'Private results', 'Audit history', 'Email reports', 'Re-run diff view'],
  },
  PRO: {
    name: 'Pro',
    price: 29,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    auditsPerDay: -1,
    features: [
      'Unlimited audits',
      'Scheduled re-runs',
      'Slack/webhook notifications',
      '3 team seats',
      'Priority queue',
    ],
  },
} as const
