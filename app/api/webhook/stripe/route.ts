import { NextResponse } from 'next/server'

// Payments disabled during testing — restore original route when ready to enable Stripe
export async function POST() {
  return NextResponse.json({ received: true })
}
