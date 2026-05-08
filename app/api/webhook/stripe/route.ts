import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'subscription' && session.customer_email) {
          const plan = session.metadata?.plan as 'STARTER' | 'PRO' | undefined
          if (plan) {
            await prisma.user.upsert({
              where: { email: session.customer_email },
              update: {
                plan,
                stripeCustomerId: session.customer as string,
              },
              create: {
                email: session.customer_email,
                plan,
                stripeCustomerId: session.customer as string,
              },
            })
          }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string
        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: { plan: 'FREE' },
        })
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string
        const priceId = sub.items.data[0]?.price?.id
        let plan: 'FREE' | 'STARTER' | 'PRO' = 'FREE'
        if (priceId === process.env.STRIPE_PRO_PRICE_ID) plan = 'PRO'
        else if (priceId === process.env.STRIPE_STARTER_PRICE_ID) plan = 'STARTER'
        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: { plan },
        })
        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
  }

  return NextResponse.json({ received: true })
}
