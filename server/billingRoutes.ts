import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { getUncachableStripeClient, getStripePublishableKey, getStripeSync } from "./stripeClient";
import { subscriptionTiers, type SubscriptionTier } from "@shared/schema";
import { isAuthenticated } from "./replitAuth";

const STRIPE_PRICE_IDS: Record<string, string> = {};

async function loadStripePrices() {
  try {
    const stripeSync = await getStripeSync();
    const prices = await stripeSync.sql`
      SELECT id, nickname 
      FROM stripe.prices 
      WHERE active = true AND type = 'recurring'
    `;
    
    for (const price of prices) {
      if (price.nickname) {
        const tier = price.nickname.toLowerCase().replace(' plan', '');
        STRIPE_PRICE_IDS[tier] = price.id;
      }
    }
    console.log('Loaded Stripe price IDs:', STRIPE_PRICE_IDS);
  } catch (error) {
    console.error('Failed to load Stripe prices:', error);
  }
}

loadStripePrices();

export function registerBillingRoutes(app: Express) {
  app.get('/api/billing/config', async (req: Request, res: Response) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error('Error getting Stripe config:', error);
      res.status(500).json({ message: 'Failed to get Stripe configuration' });
    }
  });

  app.get('/api/billing/plans', async (req: Request, res: Response) => {
    try {
      const plans = Object.entries(subscriptionTiers)
        .filter(([key]) => key !== 'free' && key !== 'trial')
        .map(([key, tier]) => ({
          id: key,
          name: tier.name,
          priceMonthly: tier.priceMonthly,
          aiQueriesPerMonth: tier.aiQueriesPerMonth,
          priceId: STRIPE_PRICE_IDS[key] || null,
        }));
      
      res.json(plans);
    } catch (error) {
      console.error('Error getting plans:', error);
      res.status(500).json({ message: 'Failed to get subscription plans' });
    }
  });

  app.get('/api/billing/subscription', isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const usage = await storage.getAiUsageRemaining(userId);
      const tierConfig = subscriptionTiers[user.subscriptionTier as SubscriptionTier] || subscriptionTiers.free;

      res.json({
        tier: user.subscriptionTier || 'free',
        tierName: tierConfig.name,
        status: user.subscriptionStatus || 'inactive',
        currentPeriodEnd: user.subscriptionCurrentPeriodEnd,
        trialEndsAt: user.trialEndsAt,
        aiUsage: {
          used: usage.used,
          limit: usage.limit,
          remaining: usage.remaining,
        },
      });
    } catch (error) {
      console.error('Error getting subscription:', error);
      res.status(500).json({ message: 'Failed to get subscription status' });
    }
  });

  app.post('/api/billing/start-trial', isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (user.subscriptionTier !== 'free' || user.trialEndsAt) {
        return res.status(400).json({ message: 'Trial already used or subscription active' });
      }

      const updated = await storage.startFreeTrial(userId);
      if (!updated) {
        return res.status(500).json({ message: 'Failed to start trial' });
      }

      res.json({
        message: 'Trial started successfully',
        trialEndsAt: updated.trialEndsAt,
        tier: updated.subscriptionTier,
      });
    } catch (error) {
      console.error('Error starting trial:', error);
      res.status(500).json({ message: 'Failed to start trial' });
    }
  });

  app.post('/api/billing/create-checkout-session', isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { priceId, tier } = req.body;

      if (!priceId || !tier) {
        return res.status(400).json({ message: 'Price ID and tier are required' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const stripe = await getUncachableStripeClient();
      let customerId = user.stripeCustomerId;
      
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: {
            userId: userId,
          },
        });
        customerId = customer.id;
        await storage.updateUserStripeInfo(userId, { stripeCustomerId: customerId });
      }

      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPLIT_DOMAINS?.split(',')[0] 
          ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
          : 'http://localhost:5000';

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${baseUrl}/settings?tab=billing&status=success`,
        cancel_url: `${baseUrl}/settings?tab=billing&status=canceled`,
        metadata: {
          userId: userId,
          tier: tier,
        },
        subscription_data: {
          metadata: {
            userId: userId,
            tier: tier,
          },
        },
      });

      res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ message: 'Failed to create checkout session' });
    }
  });

  app.post('/api/billing/create-portal-session', isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.stripeCustomerId) {
        return res.status(400).json({ message: 'No billing account found' });
      }

      const stripe = await getUncachableStripeClient();
      
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPLIT_DOMAINS?.split(',')[0] 
          ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
          : 'http://localhost:5000';

      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${baseUrl}/settings?tab=billing`,
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error('Error creating portal session:', error);
      res.status(500).json({ message: 'Failed to create billing portal session' });
    }
  });

  app.get('/api/billing/usage', isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const usage = await storage.getAiUsageRemaining(userId);
      res.json(usage);
    } catch (error) {
      console.error('Error getting usage:', error);
      res.status(500).json({ message: 'Failed to get usage data' });
    }
  });

  app.post('/api/billing/webhook', async (req: Request, res: Response) => {
    try {
      const event = req.body;
      
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          const customerId = subscription.customer;
          const tier = subscription.metadata?.tier || 'starter';
          const status = subscription.status;
          const periodEnd = new Date(subscription.current_period_end * 1000);
          
          const stripeSync = await getStripeSync();
          const customers = await stripeSync.sql`
            SELECT metadata FROM stripe.customers WHERE id = ${customerId}
          `;
          
          if (customers.length > 0 && customers[0].metadata?.userId) {
            const userId = customers[0].metadata.userId;
            
            await storage.updateUserStripeInfo(userId, {
              stripeSubscriptionId: subscription.id,
              subscriptionTier: tier,
              subscriptionStatus: status === 'active' ? 'active' : status,
              subscriptionCurrentPeriodEnd: periodEnd,
            });

            if (status === 'active') {
              await storage.resetAiUsageForNewPeriod(userId, new Date(), periodEnd);
            }
          }
          break;
        }
        
        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          const customerId = subscription.customer;
          
          const stripeSync = await getStripeSync();
          const customers = await stripeSync.sql`
            SELECT metadata FROM stripe.customers WHERE id = ${customerId}
          `;
          
          if (customers.length > 0 && customers[0].metadata?.userId) {
            const userId = customers[0].metadata.userId;
            
            await storage.updateUserStripeInfo(userId, {
              stripeSubscriptionId: null,
              subscriptionTier: 'free',
              subscriptionStatus: 'canceled',
              subscriptionCurrentPeriodEnd: null,
            });
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          const customerId = invoice.customer;
          
          const stripeSync = await getStripeSync();
          const customers = await stripeSync.sql`
            SELECT metadata FROM stripe.customers WHERE id = ${customerId}
          `;
          
          if (customers.length > 0 && customers[0].metadata?.userId) {
            const userId = customers[0].metadata.userId;
            await storage.updateUserStripeInfo(userId, {
              subscriptionStatus: 'past_due',
            });
          }
          break;
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(400).json({ message: 'Webhook error' });
    }
  });
}
