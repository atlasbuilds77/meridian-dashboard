import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (stripeClient) {
    return stripeClient;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: '2026-01-28.clover',
    typescript: true,
  });

  return stripeClient;
}

export async function createCustomer(params: {
  email: string;
  name: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Customer> {
  return await getStripeClient().customers.create({
    email: params.email,
    name: params.name,
    metadata: params.metadata || {},
  });
}

export async function createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
  return await getStripeClient().setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
    usage: 'off_session', // For charging later
  });
}

export async function attachPaymentMethod(
  paymentMethodId: string,
  customerId: string
): Promise<Stripe.PaymentMethod> {
  return await getStripeClient().paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });
}

export async function setDefaultPaymentMethod(
  customerId: string,
  paymentMethodId: string
): Promise<Stripe.Customer> {
  return await getStripeClient().customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });
}

export async function chargeCustomer(params: {
  customerId: string;
  paymentMethodId: string;
  amount: number; // in cents
  currency?: string;
  description: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.PaymentIntent> {
  return await getStripeClient().paymentIntents.create({
    amount: params.amount,
    currency: params.currency || 'usd',
    customer: params.customerId,
    payment_method: params.paymentMethodId,
    off_session: true,
    confirm: true,
    description: params.description,
    metadata: params.metadata || {},
    receipt_email: undefined, // Will use customer's email
  });
}

export async function refundPayment(
  paymentIntentId: string,
  amount?: number // optional partial refund
): Promise<Stripe.Refund> {
  return await getStripeClient().refunds.create({
    payment_intent: paymentIntentId,
    amount: amount, // undefined = full refund
  });
}

export async function getPaymentMethod(
  paymentMethodId: string
): Promise<Stripe.PaymentMethod> {
  return await getStripeClient().paymentMethods.retrieve(paymentMethodId);
}

export async function detachPaymentMethod(
  paymentMethodId: string
): Promise<Stripe.PaymentMethod> {
  return await getStripeClient().paymentMethods.detach(paymentMethodId);
}
