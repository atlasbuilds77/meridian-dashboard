'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Wallet,
  ArrowRight,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Globe,
  Shield,
} from 'lucide-react';
import { useState } from 'react';

function StepCard({ 
  step, 
  title, 
  children,
  status = 'pending'
}: { 
  step: number; 
  title: string; 
  children: React.ReactNode;
  status?: 'pending' | 'complete';
}) {
  return (
    <div className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
          status === 'complete' 
            ? 'border-profit bg-profit/20 text-profit' 
            : 'border-primary bg-primary/20 text-primary'
        }`}>
          {status === 'complete' ? <CheckCircle2 className="h-4 w-4" /> : step}
        </div>
        <div className="mt-2 h-full w-px bg-border/50" />
      </div>
      <div className="pb-8">
        <h4 className="font-semibold text-foreground">{title}</h4>
        <div className="mt-2 text-sm text-muted-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-secondary/50 px-2 py-1 text-xs font-mono hover:bg-secondary transition-colors"
    >
      {text}
      {copied ? <CheckCircle2 className="h-3 w-3 text-profit" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export function PolymarketSetupGuide() {
  return (
    <Card className="border-primary/30 bg-[rgba(19,19,28,0.72)] backdrop-blur">
      <CardHeader className="border-b border-primary/20 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <Wallet className="h-5 w-5 text-primary" />
            Polymarket Setup Guide
          </CardTitle>
          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
            ~10 min setup
          </Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Follow these steps to connect your wallet and start copy-trading prediction markets.
        </p>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-0">
          
          {/* Step 0: VPN Setup */}
          <StepCard step={1} title="Set Up a VPN (Required)">
            <p className="mb-3">
              Polymarket is restricted in some regions. You'll need a VPN for initial setup.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <a 
                href="https://nordvpn.com/download/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-sm text-blue-400 hover:bg-blue-500/20 transition-colors"
              >
                NordVPN (Recommended) <ExternalLink className="h-3 w-3" />
              </a>
              <a 
                href="https://protonvpn.com/download" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-sm text-purple-400 hover:bg-purple-500/20 transition-colors"
              >
                ProtonVPN (Free tier available) <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="rounded-lg border border-profit/30 bg-profit/10 p-3">
              <p className="text-xs text-profit">
                <strong>Connect to:</strong> Netherlands, Germany, or UK servers work best. Once your account is set up and connected here, <strong>we handle all trading server-side</strong> - you won't need VPN for ongoing use.
              </p>
            </div>
          </StepCard>

          {/* Step 2: Create Wallet */}
          <StepCard step={2} title="Create a Polygon Wallet">
            <p className="mb-3">
              You need a wallet that supports the <strong>Polygon network</strong>. We recommend:
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <a 
                href="https://phantom.app/download" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-sm text-purple-400 hover:bg-purple-500/20 transition-colors"
              >
                Phantom (Recommended) <ExternalLink className="h-3 w-3" />
              </a>
              <a 
                href="https://www.coinbase.com/wallet" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-sm text-blue-400 hover:bg-blue-500/20 transition-colors"
              >
                Coinbase Wallet <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="flex items-start gap-2 text-xs text-amber-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span><strong>Save your seed phrase!</strong> Write it down and store it safely. Never share it with anyone. We will never ask for your seed phrase.</span>
              </p>
            </div>
          </StepCard>

          {/* Step 3: Add Polygon Network */}
          <StepCard step={3} title="Add Polygon Network">
            <p className="mb-3">
              Add the Polygon network to your wallet. Phantom and Coinbase Wallet auto-detect Polygon, but if needed:
            </p>
            <div className="space-y-2 rounded-lg border border-border/50 bg-secondary/30 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Network Name:</span>
                <CopyButton text="Polygon Mainnet" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">RPC URL:</span>
                <CopyButton text="https://polygon-rpc.com" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Chain ID:</span>
                <CopyButton text="137" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Currency:</span>
                <CopyButton text="MATIC" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Explorer:</span>
                <CopyButton text="https://polygonscan.com" />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Or just go to <a href="https://chainlist.org/chain/137" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">chainlist.org</a> and click "Add to Wallet" for Polygon.
            </p>
          </StepCard>

          {/* Step 4: Buy USDC */}
          <StepCard step={4} title="Buy USDC on Polygon">
            <p className="mb-3">
              Polymarket uses <strong>USDC on Polygon</strong>. You need USDC to place bets.
            </p>
            
            <div className="space-y-3">
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <DollarSign className="h-4 w-4 text-profit" />
                  Option A: Buy directly (easiest)
                </p>
                <p className="mt-1 text-xs">
                  Use <a href="https://app.uniswap.org" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Uniswap</a> or <a href="https://www.coinbase.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Coinbase</a> to buy USDC and withdraw to Polygon.
                </p>
              </div>
              
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <Globe className="h-4 w-4 text-blue-400" />
                  Option B: Bridge from Ethereum
                </p>
                <p className="mt-1 text-xs">
                  If you have USDC on Ethereum, use the <a href="https://wallet.polygon.technology/bridge" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Polygon Bridge</a> to move it.
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-3">
              <p className="text-xs text-primary">
                <strong>Recommended starting amount:</strong> $100-500 USDC. Start small while testing.
              </p>
            </div>
          </StepCard>

          {/* Step 5: Get MATIC for gas */}
          <StepCard step={5} title="Get MATIC for Gas Fees">
            <p className="mb-3">
              You need a small amount of <strong>MATIC</strong> (Polygon's native token) to pay for transaction fees.
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Gas fees on Polygon are very cheap (~$0.01-0.05 per trade)</li>
              <li>$5-10 of MATIC will last you hundreds of trades</li>
              <li>Buy MATIC on <a href="https://www.coinbase.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Coinbase</a> or <a href="https://www.kraken.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Kraken</a> and send to your Polygon wallet</li>
            </ul>
          </StepCard>

          {/* Step 6: Create Polymarket Account */}
          <StepCard step={6} title="Create Polymarket Account (VPN On)">
            <p className="mb-3">
              Go to <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">polymarket.com</a> and connect your wallet.
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Click "Connect Wallet" and select your wallet</li>
              <li>Sign the message to verify ownership</li>
              <li>Deposit USDC when prompted</li>
              <li>You're ready to trade!</li>
            </ul>
            <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
              <p className="flex items-start gap-2 text-xs text-blue-400">
                <Globe className="mt-0.5 h-4 w-4 shrink-0" />
                <span><strong>Regional restrictions:</strong> Polymarket may require a VPN to access from certain regions. You only need this for initial setup - once connected here, <strong>we handle all trade execution server-side</strong>.</span>
              </p>
            </div>
          </StepCard>

          {/* Step 7: Generate CLOB API Credentials */}
          <StepCard step={7} title="Generate API Credentials (VPN On)">
            <p className="mb-3">
              To enable copy-trading, generate API credentials on Polymarket:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-xs mb-3">
              <li>Go to <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">polymarket.com</a> (with VPN connected)</li>
              <li>Click your profile icon → <strong>Settings</strong></li>
              <li>Go to <strong>API Keys</strong> section</li>
              <li>Click <strong>Create API Key</strong></li>
              <li>Sign the message with your wallet</li>
              <li>Copy the <strong>API Key</strong>, <strong>Secret</strong>, and <strong>Passphrase</strong></li>
            </ol>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="flex items-start gap-2 text-xs text-amber-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span><strong>Save these immediately!</strong> The secret and passphrase are only shown once. Store them somewhere safe before closing the page.</span>
              </p>
            </div>
          </StepCard>

          {/* Step 8: Connect Here */}
          <StepCard step={8} title="Connect & Enable Copy-Trading">
            <p className="mb-3">
              Enter your credentials in the connection box above:
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs mb-3">
              <li><strong>Wallet Address</strong> - Your 0x address</li>
              <li><strong>API Key</strong> - From Polymarket settings</li>
              <li><strong>API Secret</strong> - From Polymarket settings</li>
              <li><strong>Passphrase</strong> - From Polymarket settings</li>
            </ul>
            <div className="rounded-lg border border-profit/30 bg-profit/10 p-3">
              <p className="flex items-start gap-2 text-xs text-profit">
                <Shield className="mt-0.5 h-4 w-4 shrink-0" />
                <span><strong>Your credentials are encrypted</strong> and stored securely. We use them only to execute copy-trades on your behalf. You can revoke API access anytime from Polymarket settings.</span>
              </p>
            </div>
          </StepCard>

        </div>

        {/* Quick Links */}
        <div className="mt-6 rounded-xl border border-border/50 bg-secondary/20 p-4">
          <h4 className="text-sm font-semibold text-foreground mb-3">Quick Links</h4>
          <div className="flex flex-wrap gap-2">
            <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-border/50 bg-secondary/50 px-3 py-1.5 text-xs hover:bg-secondary transition-colors">
              Polymarket <ExternalLink className="h-3 w-3" />
            </a>
            <a href="https://phantom.app" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-border/50 bg-secondary/50 px-3 py-1.5 text-xs hover:bg-secondary transition-colors">
              Phantom <ExternalLink className="h-3 w-3" />
            </a>
            <a href="https://chainlist.org/chain/137" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-border/50 bg-secondary/50 px-3 py-1.5 text-xs hover:bg-secondary transition-colors">
              Add Polygon <ExternalLink className="h-3 w-3" />
            </a>
            <a href="https://polygonscan.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-border/50 bg-secondary/50 px-3 py-1.5 text-xs hover:bg-secondary transition-colors">
              Polygon Explorer <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
