import Stripe from 'stripe';

// Stripe configuration — deployment-agnostic.
// Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY in the environment.

async function getCredentials(): Promise<{ publishableKey: string; secretKey: string }> {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (secretKey && publishableKey) {
    return { publishableKey, secretKey };
  }
  throw new Error(
    'Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY in the environment.'
  );
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  // Use the Stripe SDK's default API version (keeps the SDK in lockstep).
  return new Stripe(secretKey);
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}
