'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

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

    if (setupIntent?.payment_method) {
      // Save to backend
      try {
        const res = await fetch('/api/billing/payment-method', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payment_method_id: setupIntent.payment_method,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to save payment method');
        }

        onSuccess();
      } catch (err: any) {
        setError(err.message);
      }
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

  const fetchPaymentMethods = async () => {
    try {
      const res = await fetch('/api/billing/payment-method');
      if (res.ok) {
        const data = await res.json();
        setPaymentMethods(data.payment_methods || []);
      }
    } catch (err) {
      console.error('Failed to fetch payment methods:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClick = async () => {
    try {
      const res = await fetch('/api/billing/setup-intent', {
        method: 'POST',
      });
      const data = await res.json();
      
      if (data.client_secret) {
        setClientSecret(data.client_secret);
        setShowAddForm(true);
      }
    } catch (err) {
      console.error('Failed to create setup intent:', err);
    }
  };

  const handleSuccess = () => {
    setShowAddForm(false);
    setClientSecret(null);
    fetchPaymentMethods();
  };

  const handleDelete = async (paymentMethodId: string) => {
    if (!confirm('Remove this payment method?')) return;

    try {
      const res = await fetch('/api/billing/payment-method', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method_id: paymentMethodId }),
      });

      if (res.ok) {
        fetchPaymentMethods();
      }
    } catch (err) {
      console.error('Failed to delete payment method:', err);
    }
  };

  React.useEffect(() => {
    fetchPaymentMethods();
  }, []);

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle>Payment Methods</CardTitle>
        <CardDescription>
          Manage your payment methods for weekly automation fees (10% of profits)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing Payment Methods */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : paymentMethods.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No payment methods added yet.
          </div>
        ) : (
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className="flex items-center justify-between p-4 border border-border/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-8 bg-secondary rounded flex items-center justify-center text-xs font-semibold uppercase">
                    {method.card_brand}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">•••• {method.card_last4}</span>
                      {method.is_default && (
                        <span className="text-xs px-2 py-0.5 rounded bg-profit/20 text-profit">
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
            + Add Payment Method
          </Button>
        ) : clientSecret ? (
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
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            Creating setup...
          </div>
        )}

        {/* Billing Info */}
        <div className="mt-6 p-4 bg-secondary/20 rounded-lg border border-border/30">
          <h4 className="font-semibold text-sm mb-2">Billing Schedule</h4>
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

// Fix React import
import * as React from 'react';
