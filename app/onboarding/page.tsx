'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from 'next/navigation';

const RISK_TYPES = [
  { id: 'options_trading_risk', label: 'I understand options trading involves substantial risk, including total loss of capital' },
  { id: 'no_investment_advice', label: 'I understand Meridian is an automated technology platform, NOT an investment adviser' },
  { id: 'user_sole_responsibility', label: 'I am solely responsible for all investment decisions and outcomes' },
  { id: 'past_performance_disclaimer', label: 'I understand past performance does not guarantee future results' },
  { id: 'system_downtime_risk', label: 'I accept that system failures, bugs, or API outages may occur' },
  { id: 'no_fdic_insurance', label: 'I understand there is NO FDIC insurance on trading accounts' },
];

type OnboardingStepData =
  | { risks: string[] }
  | { accepted: true }
  | { signatureName: string; certifyAge: boolean };

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  
  // Step 2: Risk Acknowledgments
  const [selectedRisks, setSelectedRisks] = useState<Set<string>>(new Set());
  const [riskDisclosureAccepted, setRiskDisclosureAccepted] = useState(false);
  
  // Step 3: Terms
  const [tosAccepted, setTosAccepted] = useState(false);
  
  // Step 4: Fees
  const [feesAccepted, setFeesAccepted] = useState(false);
  
  // Step 5: Signature
  const [signatureName, setSignatureName] = useState('');
  const [certifyAge, setCertifyAge] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkOnboardingStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/onboarding/status');
      const data = await response.json();
      
      if (data.hasCompleted) {
        router.push('/'); // Already completed, redirect to dashboard
        return;
      }
      
      if (data.inProgressSession) {
        setCurrentStep(data.inProgressSession.currentStep);
      }
    } catch (err) {
      console.error('Status check error:', err);
    }
  }, [router]);

  useEffect(() => {
    void checkOnboardingStatus();
  }, [checkOnboardingStatus]);

  async function startOnboarding() {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/onboarding/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAgent: navigator.userAgent
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start onboarding');
      }
      
      setCurrentStep(data.currentStep ?? 2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start onboarding');
    } finally {
      setLoading(false);
    }
  }

  async function submitStep(step: number, data: OnboardingStepData) {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/onboarding/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step,
          data
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit step');
      }
      
      if (result.completed) {
        // Onboarding complete!
        router.push('/?onboarding=complete');
      } else if (result.nextStep) {
        setCurrentStep(result.nextStep);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit step');
    } finally {
      setLoading(false);
    }
  }

  function renderStep() {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">Welcome to Meridian</h2>
              <p className="text-muted-foreground">
                Before you start trading, please review and accept our legal agreements.
              </p>
              <p className="text-sm text-muted-foreground">
                This will take about 2-3 minutes.
              </p>
            </div>
            <Button 
              onClick={startOnboarding} 
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? 'Starting...' : 'Continue'}
            </Button>
          </div>
        );
        
      case 2:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Risk Acknowledgments</h2>
              <p className="text-sm text-muted-foreground">
                Please read and acknowledge the following risks:
              </p>
            </div>
            
            <div className="space-y-4">
              {RISK_TYPES.map((risk) => (
                <div key={risk.id} className="flex items-start space-x-3 border border-border rounded-lg p-4">
                  <Checkbox 
                    id={risk.id}
                    checked={selectedRisks.has(risk.id)}
                    onCheckedChange={(checked) => {
                      const newRisks = new Set(selectedRisks);
                      if (checked) {
                        newRisks.add(risk.id);
                      } else {
                        newRisks.delete(risk.id);
                      }
                      setSelectedRisks(newRisks);
                    }}
                  />
                  <label 
                    htmlFor={risk.id}
                    className="text-sm leading-relaxed cursor-pointer"
                  >
                    {risk.label}
                  </label>
                </div>
              ))}
              
              <div className="flex items-start space-x-3 border border-border rounded-lg p-4 bg-secondary/20">
                <Checkbox
                  id="risk-disclosure"
                  checked={riskDisclosureAccepted}
                  onCheckedChange={(checked) => setRiskDisclosureAccepted(checked)}
                />
                <label htmlFor="risk-disclosure" className="text-sm">
                  I have read the full{' '}
                  <button type="button" className="text-primary hover:underline" onClick={() => window.open('/legal/risk-disclosure', '_blank')}>
                    Risk Disclosure
                  </button>
                  {' '}(click to view)
                </label>
              </div>
            </div>
            
            <Button 
              onClick={() => submitStep(2, { risks: Array.from(selectedRisks) })}
              disabled={selectedRisks.size !== RISK_TYPES.length || !riskDisclosureAccepted || loading}
              className="w-full"
            >
              {loading ? 'Saving...' : 'Continue'}
            </Button>
          </div>
        );
        
      case 3:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Terms of Service</h2>
            </div>
            
            <div className="space-y-4 border border-border rounded-lg p-6 bg-secondary/10">
              <p className="text-sm font-semibold">Key points:</p>
              <ul className="space-y-2 text-sm list-disc list-inside">
                <li>Mandatory arbitration for disputes</li>
                <li>No class action lawsuits</li>
                <li>Liability limited to $1,200 or lifetime fees paid</li>
                <li>All sales final, no refunds</li>
                <li>User responsible for compliance with all laws</li>
              </ul>
            </div>
            
            <div className="flex items-start space-x-3 border border-border rounded-lg p-4">
              <Checkbox 
                id="tos"
                checked={tosAccepted}
                onCheckedChange={(checked) => setTosAccepted(!!checked)}
              />
              <label htmlFor="tos" className="text-sm">
                I have read and agree to the{' '}
                <button type="button" className="text-primary hover:underline" onClick={() => window.open('/legal/terms', '_blank')}>
                  Terms of Service
                </button>
              </label>
            </div>
            
            <Button 
              onClick={() => submitStep(3, { accepted: true })}
              disabled={!tosAccepted || loading}
              className="w-full"
            >
              {loading ? 'Saving...' : 'Continue'}
            </Button>
          </div>
        );
        
      case 4:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Fee Agreement</h2>
            </div>
            
            <div className="space-y-4 border border-border rounded-lg p-6 bg-secondary/10">
              <div className="space-y-3">
                <div>
                  <p className="font-semibold">MERIDIAN FEE STRUCTURE</p>
                </div>
                <div className="space-y-2 text-sm">
                  <p><span className="font-semibold">Monthly Membership:</span> $1,200/month (monthly plan)</p>
                  <p><span className="font-semibold">Lifetime Membership:</span> one-time purchase, same platform access as monthly members, no recurring monthly membership charge</p>
                  <p><span className="font-semibold">Automation Service Fee:</span> 10% of weekly profits (applies to both monthly and lifetime members)</p>
                </div>
                
                <div className="pt-3 border-t border-border/50">
                  <p className="text-sm font-semibold mb-2">How the automation fee works:</p>
                  <ul className="space-y-1 text-sm list-disc list-inside">
                    <li>Calculated Monday-Friday each week</li>
                    <li>If profitable: 10% charged Sunday night</li>
                    <li>If losing week: $0 automation fee</li>
                    <li>Charged automatically via Stripe</li>
                  </ul>
                </div>
                
                <div className="pt-3 border-t border-border/50">
                  <p className="text-sm font-semibold mb-2">Example:</p>
                  <ul className="space-y-1 text-sm">
                    <li>Week 1: +$800 profit → $80 automation fee</li>
                    <li>Week 2: -$200 loss → $0 automation fee</li>
                    <li>Week 3: +$1,500 profit → $150 automation fee</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 border border-border rounded-lg p-4">
              <Checkbox 
                id="fees"
                checked={feesAccepted}
                onCheckedChange={(checked) => setFeesAccepted(!!checked)}
              />
              <label htmlFor="fees" className="text-sm">
                I understand and agree to this fee structure
              </label>
            </div>
            
            <Button 
              onClick={() => submitStep(4, { accepted: true })}
              disabled={!feesAccepted || loading}
              className="w-full"
            >
              {loading ? 'Saving...' : 'Continue'}
            </Button>
          </div>
        );
        
      case 5:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Electronic Signature</h2>
            </div>
            
            <div className="space-y-4 border border-border rounded-lg p-6 bg-secondary/10">
              <p className="text-sm">
                By typing your full legal name below, you electronically sign and agree to:
              </p>
              <ul className="space-y-1 text-sm list-disc list-inside">
                <li>Terms of Service</li>
                <li>Risk Disclosure Agreement</li>
                <li>Privacy Policy</li>
                <li>Fee Agreement</li>
              </ul>
              <p className="text-sm pt-2">
                This has the same legal effect as a handwritten signature.
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold block mb-2">
                  Your full legal name:
                </label>
                <Input 
                  placeholder="Enter your full name"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  className="font-serif text-lg"
                />
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p>Date: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              </div>
              
              <div className="flex items-start space-x-3 border border-border rounded-lg p-4">
                <Checkbox 
                  id="age"
                  checked={certifyAge}
                  onCheckedChange={(checked) => setCertifyAge(!!checked)}
                />
                <label htmlFor="age" className="text-sm">
                  I certify that I am 18 years or older
                </label>
              </div>
            </div>
            
            <Button 
              onClick={() => submitStep(5, { signatureName, certifyAge })}
              disabled={!signatureName || !certifyAge || loading}
              className="w-full"
              size="lg"
            >
              {loading ? 'Completing...' : 'Sign & Complete Onboarding'}
            </Button>
          </div>
        );
        
      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8 flex items-center justify-center bg-background">
      <div className="max-w-2xl w-full space-y-6">
        {/* Progress Indicator */}
        {currentStep > 1 && (
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  step < currentStep ? 'bg-primary text-background' :
                  step === currentStep ? 'bg-primary/20 text-primary border-2 border-primary' :
                  'bg-secondary text-muted-foreground'
                }`}>
                  {step < currentStep ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-semibold">{step}</span>
                  )}
                </div>
                {step < 5 && (
                  <div className={`w-12 md:w-24 h-1 ${
                    step < currentStep ? 'bg-primary' : 'bg-secondary'
                  }`} />
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Main Card */}
        <Card>
          <CardContent className="p-6 md:p-8">
            {error && (
              <div className="mb-6 p-4 bg-loss/10 border border-loss/50 rounded-lg text-loss text-sm">
                {error}
              </div>
            )}
            
            {renderStep()}
          </CardContent>
        </Card>
        
        {/* Help Text */}
        {currentStep > 1 && (
          <p className="text-center text-sm text-muted-foreground">
            Step {currentStep} of 5
          </p>
        )}
      </div>
    </div>
  );
}
