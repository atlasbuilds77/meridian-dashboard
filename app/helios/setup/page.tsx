'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Zap, Link2, Wallet, ToggleRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { fetchWithCsrf, useCsrfToken } from '@/hooks/use-csrf-token';

// ─── Broker capability map ───────────────────────────────────────────────────
// Source: SnapTrade brokerage support matrix (options trading column)
// status: 'full' = SPX/SPXW execution supported
//         'spy'  = SPY proxy used (SPX ÷ 10 strike)
//         'none' = read-only via SnapTrade API, cannot execute
const BROKERS_WITH_OPTIONS: { name: string; status: 'full' | 'spy' | 'none'; note?: string }[] = [
  { name: 'Tastytrade',           status: 'full' },
  { name: 'Interactive Brokers',  status: 'full' },
  { name: 'TD Ameritrade',        status: 'full' },
  { name: 'Charles Schwab',       status: 'full' },
  { name: 'Tradier',              status: 'full' },
  { name: 'Alpaca',               status: 'full' },
  { name: 'Webull',               status: 'full', note: 'Uses SPXW (identical SPX weekly contracts)' },
  { name: 'Fidelity',             status: 'spy',  note: 'SPY proxy used (same signal, 1/10 strike)' },
  { name: 'Robinhood',            status: 'none', note: 'Requires unofficial API integration — coming soon' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface SnapAccount {
  id: string;
  name: string;
  number?: string;
  institution_name?: string;
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = [
  { icon: Zap,          label: 'Welcome'        },
  { icon: Link2,        label: 'Connect Broker' },
  { icon: Wallet,       label: 'Select Account' },
  { icon: ToggleRight,  label: 'Enable'         },
];

function StepDots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const done    = i < current;
        const active  = i === current;
        return (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full border text-xs font-bold transition-all
              ${done   ? 'bg-orange-500 border-orange-500 text-white' : ''}
              ${active ? 'border-orange-500 text-orange-500'          : ''}
              ${!done && !active ? 'border-zinc-700 text-zinc-600'    : ''}
            `}>
              {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
            </div>
            <span className={`text-xs hidden sm:inline ${active ? 'text-orange-400' : done ? 'text-zinc-400' : 'text-zinc-600'}`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <div className={`w-6 h-px ${done ? 'bg-orange-500' : 'bg-zinc-700'}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HeliosSetupPage() {
  const router  = useRouter();
  const { token: csrfToken } = useCsrfToken();

  const [step,     setStep]     = useState(0);
  const [accounts, setAccounts] = useState<SnapAccount[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  // ── Check if already set up ───────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch('/api/user/snaptrade/accounts');
        const data = await res.json();
        if (data.connected && data.heliosAccount && data.heliosAutoExecute) {
          router.replace('/helios');          // already done
        } else if (data.connected) {
          setConnected(true);
          setAccounts(data.accounts || []);
          if (data.heliosAccount) setSelected(data.heliosAccount);
          setStep(2);                         // skip to account selection
        }
      } catch { /* first visit */ }
    })();
  }, [router]);

  // ── Step 0: Welcome ───────────────────────────────────────────────────────
  const StepWelcome = () => (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
          <Zap className="w-8 h-8 text-orange-500" />
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Welcome to Helios</h2>
        <p className="text-zinc-400 max-w-sm mx-auto text-sm leading-relaxed">
          You have Helios access. Let&apos;s connect your brokerage account so trades execute automatically — no clicking required.
        </p>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-left space-y-2 max-w-sm mx-auto">
        {[
          'Helios fires a signal',
          'Your broker receives the order instantly',
          'You see the result in your account',
        ].map((t, i) => (
          <div key={i} className="flex items-center gap-3 text-sm text-zinc-300">
            <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
              {i + 1}
            </span>
            {t}
          </div>
        ))}
      </div>
      <Button onClick={() => setStep(1)} className="bg-orange-500 hover:bg-orange-600 text-white px-8">
        Get Started →
      </Button>
    </div>
  );

  // ── Step 1: Connect Broker ────────────────────────────────────────────────
  const handleConnect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/user/snaptrade/connect', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get connection URL');
      // Redirect to SnapTrade portal; they come back to /helios/setup?step=2
      window.location.href = data.redirectUrl + '&redirectURI=' +
        encodeURIComponent(window.location.origin + '/helios/setup?step=2');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const StepConnect = () => (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
          <Link2 className="w-8 h-8 text-orange-400" />
        </div>
      </div>
      <div>
        <h2 className="text-xl font-bold text-white mb-2">Connect Your Broker</h2>
        <p className="text-zinc-400 text-sm max-w-sm mx-auto">
          We use SnapTrade to securely connect to 50+ brokerages. Your credentials are never stored here.
        </p>
      </div>
      {/* Broker capability grid */}
      <div className="max-w-sm mx-auto space-y-2 text-xs">
        <p className="text-zinc-500 uppercase tracking-wide text-[10px] text-left mb-1">Options execution supported:</p>
        {BROKERS_WITH_OPTIONS.map(b => (
          <div key={b.name} className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-zinc-200">{b.name}</span>
              <div className="flex items-center gap-1.5">
                {b.status === 'full' && <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /><span className="text-green-400">Full execution</span></>}
                {b.status === 'spy'  && <><span className="text-yellow-400">SPY proxy</span></>}
                {b.status === 'none' && <><span className="text-zinc-500">Not supported</span></>}
              </div>
            </div>
            {b.note && <p className="text-zinc-500 text-[10px] mt-0.5">{b.note}</p>}
          </div>
        ))}
        <p className="text-zinc-600 text-[10px] text-left pt-1">Robinhood requires a custom integration not yet available. Switch to a supported broker to enable auto-execute.</p>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <Button onClick={handleConnect} disabled={loading} className="bg-orange-500 hover:bg-orange-600 text-white px-8">
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Connecting…</> : 'Connect Broker →'}
      </Button>
    </div>
  );

  // ── Step 2: Select Account ────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 2 || accounts.length > 0) return;
    (async () => {
      try {
        const res  = await fetch('/api/user/snaptrade/accounts');
        const data = await res.json();
        setAccounts(data.accounts || []);
        if (data.heliosAccount) setSelected(data.heliosAccount);
      } catch { /* noop */ }
    })();
  }, [step, accounts.length]);

  // Handle ?step=2 redirect from SnapTrade portal
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('step') === '2') {
      setConnected(true);
      setStep(2);
    }
  }, []);

  const handleSelectAccount = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithCsrf('/api/user/snaptrade/select-system-account', {
        method: 'POST',
        body: JSON.stringify({ accountId: selected, system: 'helios' }),
      }, csrfToken);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save account');
      setStep(3);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save account');
    } finally {
      setLoading(false);
    }
  }, [selected, csrfToken]);

  const StepSelectAccount = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-2">Select Trading Account</h2>
        <p className="text-zinc-400 text-sm">Which account should Helios trade in?</p>
      </div>
      {accounts.length === 0 ? (
        <div className="text-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500 mx-auto mb-2" />
          <p className="text-zinc-500 text-sm">Loading your accounts…</p>
        </div>
      ) : (
        <div className="space-y-2 max-w-sm mx-auto">
          {accounts.map((acct) => (
            <button
              key={acct.id}
              onClick={() => setSelected(acct.id)}
              className={`w-full text-left p-4 rounded-lg border transition-all ${
                selected === acct.id
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600'
              }`}
            >
              <div className="font-medium text-white text-sm">{acct.name || acct.institution_name}</div>
              {acct.number && <div className="text-xs text-zinc-500 mt-0.5">••••{acct.number.slice(-4)}</div>}
            </button>
          ))}
        </div>
      )}
      {/* Options support warning based on institution name */}
      {accounts.some(a => {
        const name = (a.institution_name || a.name || '').toLowerCase();
        const noOptions = ['robinhood','fidelity'];
        return a.id === selected && noOptions.some(n => name.includes(n));
      }) && (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 max-w-sm mx-auto text-xs text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>This broker may not support options execution via SnapTrade. Helios trades 0DTE options — consider Tastytrade, IBKR, or Alpaca for full execution.</span>
        </div>
      )}

      {!connected && (
        <p className="text-center text-sm text-zinc-500">
          Don&apos;t see your account?{' '}
          <button onClick={() => setStep(1)} className="text-orange-400 hover:underline">Re-connect broker</button>
        </p>
      )}
      {error && <p className="text-center text-red-400 text-sm">{error}</p>}
      <div className="flex justify-center">
        <Button
          onClick={handleSelectAccount}
          disabled={!selected || loading}
          className="bg-orange-500 hover:bg-orange-600 text-white px-8"
        >
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : 'Use This Account →'}
        </Button>
      </div>
    </div>
  );

  // ── Step 3: Enable Auto-Execute ───────────────────────────────────────────
  const [preferSpy, setPreferSpy] = useState(false);
  const [savingPref, setSavingPref] = useState(false);

  const handleSpyToggle = async (val: boolean) => {
    setSavingPref(true);
    try {
      await fetchWithCsrf('/api/user/settings/prefer-spy', {
        method: 'POST',
        body: JSON.stringify({ prefer_spy: val }),
      }, csrfToken);
      setPreferSpy(val);
    } catch { /* noop */ } finally {
      setSavingPref(false);
    }
  };

  const handleEnable = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithCsrf('/api/user/settings/auto-execute', {
        method: 'POST',
        body: JSON.stringify({ system: 'helios', enabled: true }),
      }, csrfToken);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to enable');
      setStep(4);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to enable auto-execute');
    } finally {
      setLoading(false);
    }
  }, [csrfToken]);

  const StepEnable = () => (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
          <ToggleRight className="w-8 h-8 text-orange-500" />
        </div>
      </div>
      <div>
        <h2 className="text-xl font-bold text-white mb-2">Enable Auto-Execute</h2>
        <p className="text-zinc-400 text-sm max-w-sm mx-auto">
          When Helios fires a signal, your broker will receive the order automatically. You can disable this anytime in Settings.
        </p>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-left max-w-sm mx-auto space-y-2 text-sm text-zinc-300">
        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-orange-500 flex-shrink-0" /> Market orders only</div>
        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-orange-500 flex-shrink-0" /> 1 contract per signal (default)</div>
        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-orange-500 flex-shrink-0" /> All trades logged in your dashboard</div>
        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-orange-500 flex-shrink-0" /> Disable anytime in Settings</div>
      </div>

      {/* SPX vs SPY preference */}
      <div className="max-w-sm mx-auto w-full">
        <p className="text-zinc-400 text-xs mb-2 text-left">Which instrument should Helios trade?</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleSpyToggle(false)}
            disabled={savingPref}
            className={`p-3 rounded-lg border text-left transition-all ${
              !preferSpy ? 'border-orange-500 bg-orange-500/10' : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600'
            }`}
          >
            <p className="text-sm font-bold text-white">SPX</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">Index options. Higher premium per contract. Webull uses SPXW (identical).</p>
          </button>
          <button
            onClick={() => handleSpyToggle(true)}
            disabled={savingPref}
            className={`p-3 rounded-lg border text-left transition-all ${
              preferSpy ? 'border-orange-500 bg-orange-500/10' : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600'
            }`}
          >
            <p className="text-sm font-bold text-white">SPY</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">Same signal, 1/10 strike. Lower premium. Works on all brokers including Robinhood-style platforms.</p>
          </button>
        </div>
        <p className="text-zinc-600 text-[10px] mt-1.5 text-left">You can change this anytime in Settings.</p>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <Button onClick={handleEnable} disabled={loading} className="bg-orange-500 hover:bg-orange-600 text-white px-8">
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enabling…</> : '⚡ Enable Helios Auto-Execute'}
      </Button>
    </div>
  );

  // ── Step 4: Done ──────────────────────────────────────────────────────────
  const StepDone = () => (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">You&apos;re Live! ⚡</h2>
        <p className="text-zinc-400 text-sm max-w-sm mx-auto">
          Helios will now auto-execute trades in your connected account. You&apos;ll see all activity in your dashboard.
        </p>
      </div>
      <Button onClick={() => router.push('/helios')} className="bg-orange-500 hover:bg-orange-600 text-white px-8">
        Go to Helios Dashboard →
      </Button>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      case 0: return <StepWelcome />;
      case 1: return <StepConnect />;
      case 2: return <StepSelectAccount />;
      case 3: return <StepEnable />;
      case 4: return <StepDone />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-orange-500" />
            <span className="text-orange-500 font-bold tracking-widest text-xs uppercase">Helios Setup</span>
          </div>
        </div>

        {step < 4 && <StepDots current={step} />}

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-8">
            {renderStep()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
