import Stripe from 'stripe';
import { getStripeSecretKey } from './stripeClient';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Native Stripe webhook handling — verifies signatures locally with the
// STRIPE_WEBHOOK_SECRET and processes subscription lifecycle events.
// (Signature-verified, host-agnostic.)

export class WebhookHandlers {
  /** Verify the Stripe signature and return the parsed event. Throws on mismatch. */
  static async verifyAndParse(payload: Buffer, signature: string): Promise<Stripe.Event> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }
    const stripe = new Stripe(await getStripeSecretKey());
    return stripe.webhooks.constructEvent(payload, signature, secret);
  }

  static async handleSubscriptionUpdated(subscriptionId: string, customerId: string, status: string, currentPeriodEnd: Date | null, priceId: string | null) {
    const tierFromPrice = priceId ? WebhookHandlers.getTierFromPriceId(priceId) : 'free';

    await db.update(users)
      .set({
        subscriptionStatus: status,
        subscriptionTier: tierFromPrice,
        subscriptionCurrentPeriodEnd: currentPeriodEnd,
        stripeSubscriptionId: subscriptionId,
        updatedAt: new Date(),
      })
      .where(eq(users.stripeCustomerId, customerId));
  }

  static async handleSubscriptionDeleted(customerId: string) {
    await db.update(users)
      .set({
        subscriptionStatus: 'canceled',
        subscriptionTier: 'free',
        stripeSubscriptionId: null,
        updatedAt: new Date(),
      })
      .where(eq(users.stripeCustomerId, customerId));
  }

  static getTierFromPriceId(priceId: string): string {
    const priceToTierMap: Record<string, string> = {
      [process.env.STRIPE_STARTER_PRICE_ID || '']: 'starter',
      [process.env.STRIPE_PROFESSIONAL_PRICE_ID || '']: 'professional',
      [process.env.STRIPE_BUSINESS_PRICE_ID || '']: 'business',
    };
    return priceToTierMap[priceId] || 'free';
  }
}
