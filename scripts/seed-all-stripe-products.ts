import { getUncachableStripeClient } from '../server/stripeClient';
import { subscriptionTiers, managedPricingTiers } from '../shared/schema';

async function seedAllStripeProducts() {
  console.log('='.repeat(60));
  console.log('MenuMetrics - Creating All Stripe Products');
  console.log('='.repeat(60));
  
  const stripe = await getUncachableStripeClient();

  // ===== PART 1: AI Subscription Plans (3 products) =====
  console.log('\n📊 PART 1: AI Subscription Plans\n');

  const aiTiers = ['starter', 'professional', 'business'] as const;
  
  for (const tierKey of aiTiers) {
    const tier = subscriptionTiers[tierKey];
    const productName = `MenuMetrics ${tier.name} Plan`;
    const nickname = `${tierKey} plan`;
    
    // Check if product already exists
    const existing = await stripe.products.search({ query: `name:'${productName}'` });
    if (existing.data.length > 0) {
      const prices = await stripe.prices.list({ product: existing.data[0].id, active: true });
      console.log(`✓ ${tier.name} Plan already exists`);
      console.log(`  Product: ${existing.data[0].id}`);
      console.log(`  Price: ${prices.data[0]?.id || 'None'}`);
      continue;
    }

    console.log(`Creating ${tier.name} Plan ($${tier.priceMonthly / 100}/month)...`);
    
    const product = await stripe.products.create({
      name: productName,
      description: `${tier.aiQueriesPerMonth} AI queries per month for recipe analysis and menu optimization`,
      metadata: {
        tier: tierKey,
        type: 'ai_subscription',
        ai_queries: String(tier.aiQueriesPerMonth),
      },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: tier.priceMonthly,
      currency: 'usd',
      recurring: { interval: 'month' },
      nickname: nickname,
      metadata: { tier: tierKey, type: 'ai_subscription' },
    });

    console.log(`✓ ${tier.name} Plan created`);
    console.log(`  Product: ${product.id}`);
    console.log(`  Price: ${price.id}`);
  }

  // ===== PART 2: Managed Pricing Service (4 products) =====
  console.log('\n💰 PART 2: Managed Pricing Service\n');

  const managedTiers = ['small', 'medium', 'large', 'enterprise'] as const;
  
  for (const tierKey of managedTiers) {
    const tier = managedPricingTiers[tierKey];
    const productName = `Managed Pricing - ${tier.name}`;
    
    // Check if product already exists
    const existing = await stripe.products.search({ query: `name:'${productName}'` });
    if (existing.data.length > 0) {
      const prices = await stripe.prices.list({ product: existing.data[0].id, active: true });
      console.log(`✓ ${tier.name} already exists`);
      console.log(`  Product: ${existing.data[0].id}`);
      console.log(`  Price: ${prices.data[0]?.id || 'None'}`);
      continue;
    }

    console.log(`Creating ${tier.name} ($${tier.priceMonthly / 100}/month)...`);
    
    const product = await stripe.products.create({
      name: productName,
      description: tier.description,
      metadata: {
        tier: tierKey,
        addon_type: 'managed_pricing',
        max_items: tier.maxItems !== null ? String(tier.maxItems) : 'unlimited',
      },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: tier.priceMonthly,
      currency: 'usd',
      recurring: { interval: 'month' },
      nickname: `Managed Pricing ${tierKey.charAt(0).toUpperCase() + tierKey.slice(1)}`,
      metadata: { tier: tierKey, addon_type: 'managed_pricing' },
    });

    console.log(`✓ ${tier.name} created`);
    console.log(`  Product: ${product.id}`);
    console.log(`  Price: ${price.id}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ All 7 Stripe products created successfully!');
  console.log('='.repeat(60));
  console.log('\nAI Plans:');
  console.log('  • Starter ($19/month) - 50 AI queries');
  console.log('  • Professional ($49/month) - 200 AI queries');
  console.log('  • Business ($99/month) - 500 AI queries');
  console.log('\nManaged Pricing Service:');
  console.log('  • Small Business ($29/month) - Up to 100 items');
  console.log('  • Medium Business ($79/month) - Up to 500 items');
  console.log('  • Large Business ($149/month) - Up to 1000 items');
  console.log('  • Enterprise ($249/month) - Unlimited items');
  console.log('\n🚀 Your subscription products are now available in Stripe!');
  console.log('   Visit your Stripe Dashboard to see them: https://dashboard.stripe.com/products\n');
}

seedAllStripeProducts().catch(console.error);
