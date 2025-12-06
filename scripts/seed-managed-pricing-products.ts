import { getUncachableStripeClient } from '../server/stripeClient';
import { managedPricingTiers } from '../shared/schema';

async function seedManagedPricingProducts() {
  console.log('Creating Stripe products and prices for MenuMetrics Managed Pricing add-ons...');
  
  const stripe = await getUncachableStripeClient();

  const existingProducts = await stripe.products.search({ query: "name:'Managed Pricing'" });
  if (existingProducts.data.length > 0) {
    console.log('Managed Pricing products already exist. Listing existing products:');
    for (const product of existingProducts.data) {
      const prices = await stripe.prices.list({ product: product.id, active: true });
      console.log(`  ${product.name}: Product ${product.id}, Prices: ${prices.data.map(p => p.id).join(', ')}`);
    }
    return;
  }

  const createdPrices: Record<string, string> = {};

  console.log('\nCreating Small Business tier ($29/month)...');
  const smallProduct = await stripe.products.create({
    name: 'Managed Pricing - Small Business',
    description: managedPricingTiers.small.description,
    metadata: {
      tier: 'small',
      max_items: '100',
      addon_type: 'managed_pricing',
    },
  });

  const smallPrice = await stripe.prices.create({
    product: smallProduct.id,
    unit_amount: managedPricingTiers.small.priceMonthly,
    currency: 'usd',
    recurring: { interval: 'month' },
    nickname: 'Managed Pricing Small',
    metadata: { tier: 'small', addon_type: 'managed_pricing' },
  });
  createdPrices.small = smallPrice.id;
  console.log(`Small: Product ${smallProduct.id}, Price ${smallPrice.id}`);

  console.log('Creating Medium Business tier ($79/month)...');
  const mediumProduct = await stripe.products.create({
    name: 'Managed Pricing - Medium Business',
    description: managedPricingTiers.medium.description,
    metadata: {
      tier: 'medium',
      max_items: '500',
      addon_type: 'managed_pricing',
    },
  });

  const mediumPrice = await stripe.prices.create({
    product: mediumProduct.id,
    unit_amount: managedPricingTiers.medium.priceMonthly,
    currency: 'usd',
    recurring: { interval: 'month' },
    nickname: 'Managed Pricing Medium',
    metadata: { tier: 'medium', addon_type: 'managed_pricing' },
  });
  createdPrices.medium = mediumPrice.id;
  console.log(`Medium: Product ${mediumProduct.id}, Price ${mediumPrice.id}`);

  console.log('Creating Large Business tier ($149/month)...');
  const largeProduct = await stripe.products.create({
    name: 'Managed Pricing - Large Business',
    description: managedPricingTiers.large.description,
    metadata: {
      tier: 'large',
      max_items: '1000',
      addon_type: 'managed_pricing',
    },
  });

  const largePrice = await stripe.prices.create({
    product: largeProduct.id,
    unit_amount: managedPricingTiers.large.priceMonthly,
    currency: 'usd',
    recurring: { interval: 'month' },
    nickname: 'Managed Pricing Large',
    metadata: { tier: 'large', addon_type: 'managed_pricing' },
  });
  createdPrices.large = largePrice.id;
  console.log(`Large: Product ${largeProduct.id}, Price ${largePrice.id}`);

  console.log('Creating Enterprise tier ($249/month)...');
  const enterpriseProduct = await stripe.products.create({
    name: 'Managed Pricing - Enterprise',
    description: managedPricingTiers.enterprise.description,
    metadata: {
      tier: 'enterprise',
      max_items: 'unlimited',
      addon_type: 'managed_pricing',
    },
  });

  const enterprisePrice = await stripe.prices.create({
    product: enterpriseProduct.id,
    unit_amount: managedPricingTiers.enterprise.priceMonthly,
    currency: 'usd',
    recurring: { interval: 'month' },
    nickname: 'Managed Pricing Enterprise',
    metadata: { tier: 'enterprise', addon_type: 'managed_pricing' },
  });
  createdPrices.enterprise = enterprisePrice.id;
  console.log(`Enterprise: Product ${enterpriseProduct.id}, Price ${enterprisePrice.id}`);

  console.log('\n========================================');
  console.log('IMPORTANT: Add these environment variables:');
  console.log('========================================');
  console.log(`STRIPE_MANAGED_PRICING_SMALL_PRICE_ID=${createdPrices.small}`);
  console.log(`STRIPE_MANAGED_PRICING_MEDIUM_PRICE_ID=${createdPrices.medium}`);
  console.log(`STRIPE_MANAGED_PRICING_LARGE_PRICE_ID=${createdPrices.large}`);
  console.log(`STRIPE_MANAGED_PRICING_ENTERPRISE_PRICE_ID=${createdPrices.enterprise}`);
  console.log('========================================\n');

  console.log('Managed Pricing Stripe products created successfully!');
}

seedManagedPricingProducts().catch(console.error);
