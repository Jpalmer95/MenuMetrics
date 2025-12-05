import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { subscriptionTiers, type SubscriptionTier } from "@shared/schema";

export async function checkAiUsage(req: any, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({ 
        message: "Authentication required",
        error: "not_authenticated" 
      });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ 
        message: "User not found",
        error: "user_not_found" 
      });
    }

    const tier = (user.subscriptionTier as SubscriptionTier) || 'free';
    const tierConfig = subscriptionTiers[tier] || subscriptionTiers.free;
    
    if (tier === 'free' || tierConfig.aiQueriesPerMonth === 0) {
      return res.status(403).json({
        message: "AI features require an active subscription. Start a free trial or upgrade your plan.",
        error: "subscription_required",
        tier: tier,
        upgradeRequired: true,
      });
    }

    const now = new Date();
    if (user.subscriptionStatus === 'trialing' && user.trialEndsAt) {
      if (new Date(user.trialEndsAt) < now) {
        return res.status(403).json({
          message: "Your free trial has ended. Please upgrade to continue using AI features.",
          error: "trial_expired",
          tier: tier,
          upgradeRequired: true,
        });
      }
    }

    if (user.subscriptionStatus === 'past_due') {
      return res.status(403).json({
        message: "Your subscription payment is past due. Please update your payment method.",
        error: "payment_past_due",
        tier: tier,
        upgradeRequired: false,
      });
    }

    if (user.subscriptionStatus === 'canceled' && tier !== 'trial') {
      return res.status(403).json({
        message: "Your subscription has been canceled. Please resubscribe to continue using AI features.",
        error: "subscription_canceled",
        tier: tier,
        upgradeRequired: true,
      });
    }

    const canUse = await storage.canUseAi(userId);
    if (!canUse) {
      const usage = await storage.getAiUsageRemaining(userId);
      return res.status(429).json({
        message: `You've reached your monthly AI query limit (${usage.limit} queries). Upgrade your plan for more queries.`,
        error: "usage_limit_exceeded",
        tier: tier,
        usage: usage,
        upgradeRequired: true,
      });
    }

    next();
  } catch (error) {
    console.error("AI usage check error:", error);
    next();
  }
}

export async function recordAiUsage(req: any, res: Response, next: NextFunction) {
  const originalSend = res.send;
  
  res.send = function(data: any) {
    const statusCode = res.statusCode;
    
    if (statusCode >= 200 && statusCode < 300) {
      const userId = req.user?.claims?.sub;
      if (userId) {
        storage.incrementAiUsage(userId).catch(err => {
          console.error("Failed to record AI usage:", err);
        });
      }
    }
    
    return originalSend.call(this, data);
  };
  
  next();
}

export const aiUsageMiddleware = [checkAiUsage, recordAiUsage];
