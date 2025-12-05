import { getUncachableStripeClient } from '../server/stripeClient';

async function seedProducts() {
  console.log('Creating Stripe products and prices for MenuMetrics subscriptions...');
  
  const stripe = await getUncachableStripeClient();

  const existingProducts = await stripe.products.search({ query: "name:'MenuMetrics'" });
  if (existingProducts.data.length > 0) {
    console.log('MenuMetrics products already exist. Skipping seed.');
    console.log('Existing products:', existingProducts.data.map(p => p.name));
    return;
  }

  console.log('Creating Starter plan ($19/month)...');
  const starterProduct = await stripe.products.create({
    name: 'MenuMetrics Starter',
    description: 'Perfect for solo food trucks and small cafes. Includes 50 AI queries per month.',
    metadata: {
      tier: 'starter',
      ai_queries_per_month: '50',
    },
  });

  const starterPrice = await stripe.prices.create({
    product: starterProduct.id,
    unit_amount: 1900,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { tier: 'starter' },
  });
  console.log(`Starter: Product ${starterProduct.id}, Price ${starterPrice.id}`);

  console.log('Creating Professional plan ($49/month)...');
  const professionalProduct = await stripe.products.create({
    name: 'MenuMetrics Professional',
    description: 'Great for growing restaurants and bakeries. Includes 200 AI queries per month.',
    metadata: {
      tier: 'professional',
      ai_queries_per_month: '200',
    },
  });

  const professionalPrice = await stripe.prices.create({
    product: professionalProduct.id,
    unit_amount: 4900,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { tier: 'professional' },
  });
  console.log(`Professional: Product ${professionalProduct.id}, Price ${professionalPrice.id}`);

  console.log('Creating Business plan ($99/month)...');
  const businessProduct = await stripe.products.create({
    name: 'MenuMetrics Business',
    description: 'For multi-location or high-volume restaurants. Includes 500 AI queries per month plus priority support.',
    metadata: {
      tier: 'business',
      ai_queries_per_month: '500',
    },
  });

  const businessPrice = await stripe.prices.create({
    product: businessProduct.id,
    unit_amount: 9900,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { tier: 'business' },
  });
  console.log(`Business: Product ${businessProduct.id}, Price ${businessPrice.id}`);

  console.log('\n========================================');
  console.log('IMPORTANT: Add these environment variables:');
  console.log('========================================');
  console.log(`STRIPE_STARTER_PRICE_ID=${starterPrice.id}`);
  console.log(`STRIPE_PROFESSIONAL_PRICE_ID=${professionalPrice.id}`);
  console.log(`STRIPE_BUSINESS_PRICE_ID=${businessPrice.id}`);
  console.log('========================================\n');

  console.log('Stripe products created successfully!');
}

seedProducts().catch(console.error);
