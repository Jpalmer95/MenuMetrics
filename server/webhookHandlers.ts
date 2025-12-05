import { getStripeSync } from './stripeClient';
import { db } from './db';
import { users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string, uuid: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature, uuid);
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
