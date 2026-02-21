'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditCard, Plus, ShieldCheck, Trash2 } from 'lucide-react';

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

interface PaymentMethod {
  id: string;
  stripe_payment_method_id: string;
  card_brand: string;
  card_last4: string;
  card_exp_month: number;
  card_exp_year: number;
  is_default: boolean;
  created_at: string;
}

function PaymentForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message || 'Failed to submit');
      setProcessing(false);
      return;
    }

    // Confirm the SetupIntent
    const { error: confirmError, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message || 'Failed to confirm');
      setProcessing(false);
      return;
    }

    const paymentMethodId =
      typeof setupIntent?.payment_method === 'string'
        ? setupIntent.payment_method
        : setupIntent?.payment_method?.id;

    if (paymentMethodId) {
      // Save to backend
      try {
        const res = await fetch('/api/billing/payment-method', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentMethodId,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to save payment method');
        }

        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save payment method');
      }
    } else {
      setError('Stripe did not return a valid payment method ID.');
    }

    setProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      
      {error && (
        <div className="p-3 bg-loss/10 border border-loss/30 rounded-lg text-loss text-sm">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={!stripe || processing}
        className="w-full"
      >
        {processing ? 'Adding...' : 'Add Payment Method'}
      </Button>
    </form>
  );
}

export function PaymentMethodManager() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const fetchPaymentMethods = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/payment-method');
      if (res.ok) {
        const data = await res.json();
        setPaymentMethods(data.paymentMethods || data.payment_methods || []);
      } else {
        const data = await res.json().catch(() => ({}));
        setPaymentError(data.error || 'Unable to load payment methods');
      }
    } catch (err) {
      console.error('Failed to fetch payment methods:', err);
      setPaymentError('Unable to load payment methods');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAddClick = async () => {
    setPaymentError(null);
    try {
      const res = await fetch('/api/billing/setup-intent', {
        method: 'POST',
      });
      const data = await res.json();
      
      if (data.clientSecret || data.client_secret) {
        setClientSecret(data.clientSecret || data.client_secret);
        setShowAddForm(true);
      } else {
        setPaymentError(data.error || 'Unable to initialize card setup');
      }
    } catch (err) {
      console.error('Failed to create setup intent:', err);
      setPaymentError('Unable to initialize card setup');
    }
  };

  const handleSuccess = () => {
    setPaymentError(null);
    setShowAddForm(false);
    setClientSecret(null);
    void fetchPaymentMethods();
  };

  const handleDelete = async (paymentMethodId: string) => {
    if (!confirm('Remove this payment method?')) return;

    try {
      const res = await fetch('/api/billing/payment-method', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId }),
      });

      if (res.ok) {
        void fetchPaymentMethods();
      } else {
        const data = await res.json().catch(() => ({}));
        setPaymentError(data.error || 'Unable to remove payment method');
      }
    } catch (err) {
      console.error('Failed to delete payment method:', err);
      setPaymentError('Unable to remove payment method');
    }
  };

  useEffect(() => {
    void fetchPaymentMethods();
  }, [fetchPaymentMethods]);

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Payment Methods
        </CardTitle>
        <CardDescription>
          Manage your payment methods for weekly automation fees (10% of profits)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {paymentError && (
          <div className="rounded-lg border border-loss/40 bg-loss/10 p-3 text-sm text-loss">
            {paymentError}
          </div>
        )}

        {/* Existing Payment Methods */}
        {loading ? (
          <div className="rounded-xl border border-border/40 bg-secondary/20 py-8 text-center text-muted-foreground">
            Loading payment methods...
          </div>
        ) : paymentMethods.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 bg-secondary/15 py-8 text-center">
            <p className="text-sm font-medium text-foreground">No payment methods added yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">Add a card to enable weekly billing.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className="flex items-center justify-between rounded-xl border border-border/40 bg-secondary/20 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-14 items-center justify-center rounded bg-background text-xs font-semibold uppercase">
                    {method.card_brand || 'card'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">•••• {method.card_last4}</span>
                      {method.is_default && (
                        <span className="text-xs px-2 py-0.5 rounded bg-profit/20 text-primary">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Expires {method.card_exp_month}/{method.card_exp_year}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(method.stripe_payment_method_id)}
                  className="text-loss hover:bg-loss/10"
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add Payment Method Form */}
        {!showAddForm ? (
          <Button
            onClick={handleAddClick}
            variant="outline"
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Payment Method
          </Button>
        ) : clientSecret && stripePromise ? (
          <div className="space-y-4 rounded-xl border border-border/40 bg-secondary/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">Add your card details</p>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setClientSecret(null);
                }}
              >
                Cancel
              </Button>
            </div>
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'night',
                  variables: {
                    colorPrimary: '#00ff88',
                    colorBackground: '#0a0a0a',
                    colorText: '#ffffff',
                    colorDanger: '#ff3b3b',
                  },
                },
              }}
            >
              <PaymentForm onSuccess={handleSuccess} />
            </Elements>
          </div>
        ) : !stripePublishableKey ? (
          <div className="rounded-lg border border-loss/40 bg-loss/10 p-4 text-sm text-loss">
            Billing is unavailable. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is not configured.
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            Creating setup...
          </div>
        )}

        {/* Billing Info */}
        <div className="mt-6 rounded-lg border border-border/30 bg-secondary/20 p-4">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Billing Schedule
          </h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Charged every Sunday night at 11:59 PM PST</li>
            <li>• 10% fee on weekly profits only (losses = $0 charge)</li>
            <li>• Only profitable weeks are billed</li>
            <li>• Receipts sent via email after each charge</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
